import { HP_REGEN_PER_SEC, WINGMAN_MAX_COUNT } from '@biplanes/shared';
import type { WorldState } from '../world/world-state.js';
import type { UpgradeId } from './upgrade-pool.js';
import { createWingman } from '../entities/wingman.js';

export function applyUpgrade(state: WorldState, id: UpgradeId): WorldState {
  let damageMultiplier = state.damageMultiplier;
  let fireRateMultiplier = state.fireRateMultiplier;
  let boostHeatMultiplier = state.boostHeatMultiplier;
  let boostCoolingMultiplier = state.boostCoolingMultiplier;
  let boostPowerMultiplier = state.boostPowerMultiplier;
  let collisionDamageMultiplier = state.collisionDamageMultiplier;
  let hasDrone = state.hasDrone;
  let hasHomingRockets = state.hasHomingRockets;
  let hasFlameTrail = state.hasFlameTrail;
  let hasHeavyCannon = state.hasHeavyCannon;
  let player = state.player;
  let xpMagnetRange = state.xpMagnetRange;
  let hpRegenPerSec = state.hpRegenPerSec;
  let droneCount = state.droneCount;
  let wingmanCount = state.wingmanCount;
  let allies = state.allies;
  let nextEntityId = state.nextEntityId;
  let multishotExtra = state.multishotExtra;
  let lifestealPerKill = state.lifestealPerKill;
  let salvoCooldownMultiplier = state.salvoCooldownMultiplier;

  switch (id) {
    case 'damage_plus_25': damageMultiplier *= 1.25; break;
    case 'damage_plus_50': damageMultiplier *= 1.5; break;
    case 'fire_rate_plus_25': fireRateMultiplier *= 1.25; break;
    case 'fire_rate_plus_50': fireRateMultiplier *= 1.5; break;
    case 'hp_plus_25': {
      const newMax = player.maxHp * 1.25;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'hp_plus_50': {
      const newMax = player.maxHp * 1.5;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'magnet_range_plus':
      // Repurposed: "Полевой ремонт" — passive HP regen (the old XP-magnet was a dead no-op).
      hpRegenPerSec += HP_REGEN_PER_SEC;
      break;
    case 'drone_wingman':
      hasDrone = true;
      droneCount = Math.max(droneCount, 1);
      break;
    case 'wingman': {
      // «Ведомый» — the Jackal signature. A real AI-flown ALLY plane (NOT a drone):
      // it flies your wing, picks its own targets, and is mortal — it lives one round
      // or until shot down (the host relaunches a fresh one each round). Each stack adds
      // another wingman, up to WINGMAN_MAX_COUNT. See [[feedback-wingmen-are-ai-planes]].
      if (wingmanCount < WINGMAN_MAX_COUNT) {
        const heavy = state.playerFaction === 'jackals';
        allies = [...allies, createWingman(nextEntityId, player, wingmanCount, heavy)];
        nextEntityId += 1;
        wingmanCount += 1;
      }
      break;
    }
    case 'multishot': multishotExtra += 1; break;
    case 'lifesteal': lifestealPerKill += 8; break;
    case 'quick_salvo': salvoCooldownMultiplier *= 0.78; break;
    case 'piercing_bullets': /* handled dynamically in collision-system */ break;
    case 'heavy_bomb': /* handled in tick drop logic */ break;
    case 'heavy_cannon':
      hasHeavyCannon = true;
      break;
    case 'homing_rocket':
      hasHomingRockets = true;
      break;
    case 'flame_trail':
      hasFlameTrail = true;
      break;
    case 'tracer_belt':
      fireRateMultiplier *= 1.15;
      break;
    case 'cluster_bomb':
      damageMultiplier *= 1.15;
      break;
    case 'coolant_injector':
      boostHeatMultiplier *= 0.72;
      boostCoolingMultiplier *= 1.45;
      break;
    case 'boost_supercharger':
      boostPowerMultiplier *= 1.18;
      break;
    case 'reinforced_struts': {
      collisionDamageMultiplier *= 0.68;
      const newMax = player.maxHp * 1.18;
      player = { ...player, maxHp: newMax, hp: Math.max(player.hp, newMax) };
      break;
    }
    case 'gatling_evolution':
      damageMultiplier *= 1.5;
      fireRateMultiplier *= 2.0;
      break;
    case 'bullet_storm':
      fireRateMultiplier *= 1.6;
      damageMultiplier *= 1.2;
      multishotExtra += 1;
      break;
    case 'fire_screen':
      hasFlameTrail = true;
      damageMultiplier *= 1.25;
      break;
    case 'chico_wing':
      hasDrone = true;
      droneCount = Math.max(droneCount, 2);
      hpRegenPerSec += HP_REGEN_PER_SEC * 1.6;
      break;
    case 'redline_engine':
      boostHeatMultiplier *= 0.82;
      boostCoolingMultiplier *= 1.25;
      boostPowerMultiplier *= 1.25;
      break;
  }

  return {
    ...state,
    player,
    allies,
    wingmanCount,
    nextEntityId,
    damageMultiplier,
    fireRateMultiplier,
    boostHeatMultiplier,
    boostCoolingMultiplier,
    boostPowerMultiplier,
    collisionDamageMultiplier,
    hasDrone,
    hasHomingRockets,
    hasFlameTrail,
    hasHeavyCannon,
    xpMagnetRange,
    hpRegenPerSec,
    droneCount,
    multishotExtra,
    lifestealPerKill,
    salvoCooldownMultiplier,
    appliedUpgradeIds: [...state.appliedUpgradeIds, id],
    pendingLevelUp: false,
  };
}
