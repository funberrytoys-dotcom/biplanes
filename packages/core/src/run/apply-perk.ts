/**
 * APPLY-PERK — turns a chosen perk into real, immediate gameplay effects.
 *
 * DESIGN NOTE (fidelity & safety): every one of the 32 perks is mapped onto the EXISTING
 * WorldState combat modifiers (damage / fire-rate / maxHp / regen / drones / wingman /
 * multishot / salvo / pierce / flame-trail / collision). This keeps the new system:
 *   • DETERMINISTIC — no new state enters the replay-critical path,
 *   • FREEZE-SAFE   — no new per-tick logic (the freeze history demands caution),
 *   • PLAYABLE NOW  — every perk changes how the run feels, on a stable base.
 *
 * The bespoke signature mechanics (heat «Домна», hit-marks, stall-reward triggers, zone
 * fields, ram-as-attack, time-freeze ult, drone-focus, ace fire-orders) are realised here
 * as INTENT-PRESERVING APPROXIMATIONS. Each `// approx:` line marks where the full bespoke
 * behaviour is the next deepening pass; see docs for the fidelity ledger. The catalog,
 * gating, rarity, synergy and UI layers are all real, so deepening a mechanic later is a
 * localised change, not a rework.
 */

import { HP_REGEN_PER_SEC, WINGMAN_MAX_COUNT } from '@biplanes/shared';
import type { WorldState } from '../world/world-state.js';
import { createWingman } from '../entities/wingman.js';
import type { PerkId } from './perks.js';

/** Marquee synergy bonuses: owning BOTH ids in a pair grants a small extra kick on top of
 *  the two perks' own effects. Build-craft made real (owner: «проработать с синергиями»). */
const SYNERGY_BONUSES: { pair: [PerkId, PerkId]; apply: (s: Mutable) => void }[] = [
  // Раскрутка + Радиатор-турбина → темп раскрутки бьёт выше потолка.
  { pair: ['raskrutka', 'radiator-turbina'], apply: (m) => { m.fireRateMultiplier *= 1.1; } },
  // Трассирующий замок + Жало роя → рой добивает помеченную цель злее.
  { pair: ['trassiruyuschiy-zamok', 'zhalo-roya'], apply: (m) => { m.damageMultiplier *= 1.1; } },
  // Домна + Перегрев=залп → контролируемый перегрев = чистый бонус урона.
  { pair: ['domna', 'peregrev-zalp'], apply: (m) => { m.damageMultiplier *= 1.12; } },
  // Звено асов + Огневой приказ → слаженный фокус-бурст звена.
  { pair: ['zveno-asov', 'ognevoy-prikaz'], apply: (m) => { m.damageMultiplier *= 1.08; } },
  // Броненос + Таранный киль → летающий таран, почти не пробить.
  { pair: ['bronenos', 'tarannyy-kil'], apply: (m) => { m.collisionDamageMultiplier *= 0.7; } },
  // Чистый срыв + Эгида → выход из срыва крепче держит щит.
  { pair: ['chistyy-sryv', 'egida'], apply: (m) => { m.collisionDamageMultiplier *= 0.92; } },
];

interface Mutable {
  damageMultiplier: number;
  fireRateMultiplier: number;
  boostHeatMultiplier: number;
  boostCoolingMultiplier: number;
  boostPowerMultiplier: number;
  collisionDamageMultiplier: number;
  hpRegenPerSec: number;
  lifestealPerKill: number;
  salvoCooldownMultiplier: number;
  multishotExtra: number;
}

export function applyPerk(state: WorldState, id: PerkId): WorldState {
  const m: Mutable = {
    damageMultiplier: state.damageMultiplier,
    fireRateMultiplier: state.fireRateMultiplier,
    boostHeatMultiplier: state.boostHeatMultiplier,
    boostCoolingMultiplier: state.boostCoolingMultiplier,
    boostPowerMultiplier: state.boostPowerMultiplier,
    collisionDamageMultiplier: state.collisionDamageMultiplier,
    hpRegenPerSec: state.hpRegenPerSec,
    lifestealPerKill: state.lifestealPerKill,
    salvoCooldownMultiplier: state.salvoCooldownMultiplier,
    multishotExtra: state.multishotExtra,
  };
  let player = state.player;
  let hasDrone = state.hasDrone;
  let droneCount = state.droneCount;
  let wingmanCount = state.wingmanCount;
  let allies = state.allies;
  let nextEntityId = state.nextEntityId;
  let hasHomingRockets = state.hasHomingRockets;
  let hasFlameTrail = state.hasFlameTrail;
  let hasHeavyCannon = state.hasHeavyCannon;

  // Raise max HP and top off to the new max — matches the legacy applyUpgrade HP behaviour.
  const bumpHp = (mult: number) => {
    const newMax = player.maxHp * mult;
    player = { ...player, maxHp: newMax, hp: newMax };
  };
  const addWingman = () => {
    if (wingmanCount < WINGMAN_MAX_COUNT) {
      allies = [...allies, createWingman(nextEntityId, player, wingmanCount, state.playerFaction === 'jackals')];
      nextEntityId += 1;
      wingmanCount += 1;
    }
  };

  switch (id) {
    // ============================ С.О.В. — Пулемёт ============================
    case 'raskrutka': m.fireRateMultiplier *= 1.22; break;                 // approx: ramp → flat tempo
    case 'sparennyy-stvol': m.multishotExtra += 1; m.damageMultiplier *= 0.85; break; // REAL fan (2 pellets ×0.85 = +70% per spec)
    case 'trassiruyuschiy-zamok': m.damageMultiplier *= 1.18; break;       // approx: focus-mark → flat dmg
    case 'radiator-turbina': m.fireRateMultiplier *= 1.12; m.boostPowerMultiplier *= 1.05; break; // approx: speed→tempo
    case 'gatling-shtorm': m.damageMultiplier *= 1.25; m.fireRateMultiplier *= 1.4; break; // approx: windowed burst → modest sustained (toned from 1.4/1.7)
    // ============================ С.О.В. — Ракеты / Звено / Пилотаж ============================
    case 'osinyy-zalp': hasHomingRockets = true; m.salvoCooldownMultiplier *= 0.82; break; // approx: 6 micro → homing+fast
    case 'osinoe-gnezdo': hasDrone = true; droneCount = Math.max(droneCount, 2); break;     // REAL drones
    case 'zhalo-roya': droneCount = Math.max(droneCount, 3); m.damageMultiplier *= 1.05; break; // approx: focus → +drone+dmg
    case 'remontnyy-dron': hasDrone = true; droneCount = Math.max(droneCount, 1); m.hpRegenPerSec += HP_REGEN_PER_SEC; break; // REAL regen
    case 'polnyy-roy': hasDrone = true; droneCount = Math.max(droneCount, 5); m.fireRateMultiplier *= 1.1; break; // REAL-ish swarm
    case 'perezalp': m.salvoCooldownMultiplier *= 0.7; break;              // approx: stall-reload → faster salvo
    case 'britva': m.boostPowerMultiplier *= 1.08; m.collisionDamageMultiplier *= 0.95; break; // approx: handling
    // ============================ Шакалы — Пушка ============================
    case 'domna': m.damageMultiplier *= 1.2; break;                        // approx: heat resource → hot shots
    case 'peregrev-zalp': m.damageMultiplier *= 1.18; break;               // approx: overheat blast → flat dmg
    case 'dvustvolka-kartech': m.multishotExtra += 2; m.damageMultiplier *= 0.6; hasFlameTrail = true; break; // REAL-ish fan+luji (3 pellets ×0.6 = +80% per spec)
    case 'grom-pushka': hasHeavyCannon = true; m.damageMultiplier *= 1.3; break; // REAL pierce (heavy cannon)
    // ============================ Шакалы — Ракеты ============================
    case 'chugunnyy-gostinets': m.salvoCooldownMultiplier *= 1.15; m.damageMultiplier *= 1.12; break; // approx: one heavy rocket
    case 'napalmovyy-kover': hasFlameTrail = true; break;                  // REAL flame trail
    case 'ipritnyy-kolokol': m.damageMultiplier *= 1.15; break;            // approx: zone vuln → flat dmg
    // ============================ Шакалы — Звено / Корпус ============================
    case 'zveno-asov': addWingman(); break;                                // REAL ace ally plane
    case 'ognevoy-prikaz': m.damageMultiplier *= 1.15; break;              // approx: focus-order → flat dmg
    case 'bratskaya-bronya': m.collisionDamageMultiplier *= 0.9; bumpHp(1.08); break; // approx: per-ace armor
    case 'bronenos': bumpHp(1.4); m.collisionDamageMultiplier *= 0.75; m.boostPowerMultiplier *= 0.9; break; // REAL-ish heavy armor
    case 'tarannyy-kil': m.collisionDamageMultiplier *= 0.5; bumpHp(1.1); break; // approx: ram (you survive rams)
    // ============================ Общие — Корпус ============================
    case 'broneplastiny': bumpHp(1.25); break;                             // REAL +HP (stacks ×3)
    case 'polevoy-remont': m.hpRegenPerSec += HP_REGEN_PER_SEC; bumpHp(1.05); break; // REAL regen
    case 'feniks': m.lifestealPerKill += 4; bumpHp(1.1); break;            // approx: revive → survival (lifesteal); true 1-shot revive is the deepening pass
    // ============================ Общие — Пилотаж ============================
    case 'chistyy-sryv': m.boostPowerMultiplier *= 1.12; m.boostCoolingMultiplier *= 1.1; break; // approx: stall speed-burst
    case 'egida': m.collisionDamageMultiplier *= 0.9; bumpHp(1.05); break; // approx: 1-hit shield
    case 'dymzavesa': m.collisionDamageMultiplier *= 0.92; break;          // approx: smoke evade
    case 'mertvaya-petlya': m.salvoCooldownMultiplier *= 0.85; break;      // approx: loop-recharge
    case 'zahvat-tseley': hasHomingRockets = true; m.damageMultiplier *= 1.2; m.salvoCooldownMultiplier *= 0.85; break; // approx: time-freeze ult
  }

  // Apply any marquee synergy bonus whose pair is now fully owned (this pick completed it).
  const ownedAfter = new Set<string>([...state.appliedUpgradeIds, id]);
  for (const { pair, apply } of SYNERGY_BONUSES) {
    if ((pair[0] === id || pair[1] === id) && ownedAfter.has(pair[0]) && ownedAfter.has(pair[1])) {
      apply(m);
    }
  }

  return {
    ...state,
    player,
    allies,
    wingmanCount,
    nextEntityId,
    hasDrone,
    droneCount,
    hasHomingRockets,
    hasFlameTrail,
    hasHeavyCannon,
    damageMultiplier: m.damageMultiplier,
    fireRateMultiplier: m.fireRateMultiplier,
    boostHeatMultiplier: m.boostHeatMultiplier,
    boostCoolingMultiplier: m.boostCoolingMultiplier,
    boostPowerMultiplier: m.boostPowerMultiplier,
    collisionDamageMultiplier: m.collisionDamageMultiplier,
    hpRegenPerSec: m.hpRegenPerSec,
    lifestealPerKill: m.lifestealPerKill,
    salvoCooldownMultiplier: m.salvoCooldownMultiplier,
    multishotExtra: m.multishotExtra,
    appliedUpgradeIds: [...state.appliedUpgradeIds, id],
    pendingLevelUp: false,
  };
}
