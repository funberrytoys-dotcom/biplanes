import type { Vec2 } from '@biplanes/shared';

/**
 * «Волчья комета» — the Jackal pirate sky-CARRIER boss for the campaign mission.
 *
 * It is NOT a single hitbox: it is a slowly-drifting leviathan made of destructible
 * SECTIONS — broadside turrets, engine pods, and a bridge CORE. Turrets fire at the
 * player; the core is only vulnerable once every turret and engine is gone; killing the
 * core sinks the ship (mission win). This module is the pure, deterministic STATE engine
 * (no DOM/render) — the app pins the rendered sprite + turret sprites to these sections,
 * spawns fighter waves, and reads `defeated` to end the mission.
 *
 * Section positions are stored as FRACTIONS of the airship's bounding box (0..1, origin =
 * top-left), so the layout is resolution-independent — the app multiplies by the on-screen
 * sprite size. All magnitudes are named constants → easy to tune for "epic but beatable".
 */

export type WolfCometSectionKind = 'turret' | 'engine' | 'core';

export interface WolfCometSection {
  id: string;
  kind: WolfCometSectionKind;
  fx: number; // 0..1 across the hull (0 = bow side per sprite, 1 = stern side)
  fy: number; // 0..1 down the hull
  hp: number;
  maxHp: number;
  alive: boolean;
  fireCooldown: number; // seconds until this turret may fire again (turrets only)
  fireInterval: number; // base seconds between shots (turrets only)
}

export interface WolfComet {
  position: Vec2; // world pos of the airship bounding-box top-left
  velocity: Vec2; // slow drift
  width: number;  // world-units span of the airship
  height: number;
  sections: WolfCometSection[];
  coreExposed: boolean; // true once all turrets+engines are dead
  defeated: boolean;    // true once the core is dead → mission win
}

// === Balance knobs (epic but beatable with a built-up С.О.В. run gun) ===
export const WOLF_COMET_TURRET_HP = 220;
export const WOLF_COMET_ENGINE_HP = 320;
export const WOLF_COMET_CORE_HP = 2600;
export const WOLF_COMET_TURRET_FIRE_INTERVAL = 1.6; // sec between turret shots
export const WOLF_COMET_DRIFT_SPEED = 26;           // px/sec slow horizontal drift
export const WOLF_COMET_TURRET_COUNT = 6;
export const WOLF_COMET_ENGINE_COUNT = 2;

/** Fractional layout on the carrier sprite (matches wolf_comet_carrier.png: balloon on
 *  top, battleship gondola below with a row of cannon ports, bridge tower, rear props). */
function buildSections(): WolfCometSection[] {
  const sections: WolfCometSection[] = [];
  // 6 broadside turrets spread along the gondola's gun row (lower band).
  for (let i = 0; i < WOLF_COMET_TURRET_COUNT; i++) {
    const fx = 0.30 + (i / (WOLF_COMET_TURRET_COUNT - 1)) * 0.46; // 0.30 → 0.76
    sections.push({
      id: `turret${i}`, kind: 'turret', fx, fy: 0.80,
      hp: WOLF_COMET_TURRET_HP, maxHp: WOLF_COMET_TURRET_HP, alive: true,
      // stagger the opening shots so they don't all fire on the same frame
      fireCooldown: 0.4 + i * 0.25, fireInterval: WOLF_COMET_TURRET_FIRE_INTERVAL,
    });
  }
  // 2 engine pods at the stern (rear propellers).
  sections.push({ id: 'engineTop', kind: 'engine', fx: 0.93, fy: 0.30, hp: WOLF_COMET_ENGINE_HP, maxHp: WOLF_COMET_ENGINE_HP, alive: true, fireCooldown: 0, fireInterval: 0 });
  sections.push({ id: 'engineBot', kind: 'engine', fx: 0.93, fy: 0.62, hp: WOLF_COMET_ENGINE_HP, maxHp: WOLF_COMET_ENGINE_HP, alive: true, fireCooldown: 0, fireInterval: 0 });
  // The bridge CORE (conning tower) — the final weak point.
  sections.push({ id: 'core', kind: 'core', fx: 0.45, fy: 0.52, hp: WOLF_COMET_CORE_HP, maxHp: WOLF_COMET_CORE_HP, alive: true, fireCooldown: 0, fireInterval: 0 });
  return sections;
}

export function createWolfComet(originX: number, originY: number, width: number, height: number): WolfComet {
  return {
    position: { x: originX, y: originY },
    velocity: { x: WOLF_COMET_DRIFT_SPEED, y: 0 },
    width, height,
    sections: buildSections(),
    coreExposed: false,
    defeated: false,
  };
}

/** World position of a section's centre, given the airship's current position + size. */
export function wolfCometSectionWorldPos(comet: WolfComet, s: WolfCometSection): Vec2 {
  return { x: comet.position.x + s.fx * comet.width, y: comet.position.y + s.fy * comet.height };
}

function recomputeFlags(comet: WolfComet): void {
  const turretsAndEngines = comet.sections.filter(s => s.kind === 'turret' || s.kind === 'engine');
  comet.coreExposed = turretsAndEngines.every(s => !s.alive);
  const core = comet.sections.find(s => s.kind === 'core');
  comet.defeated = !!core && !core.alive;
}

/** Advance the airship: drift + turret cooldowns. Returns a new object (immutable-friendly). */
export function stepWolfComet(comet: WolfComet, dt: number): WolfComet {
  const next: WolfComet = {
    ...comet,
    position: { x: comet.position.x + comet.velocity.x * dt, y: comet.position.y + comet.velocity.y * dt },
    sections: comet.sections.map(s =>
      s.kind === 'turret' && s.alive ? { ...s, fireCooldown: Math.max(0, s.fireCooldown - dt) } : { ...s },
    ),
  };
  recomputeFlags(next);
  return next;
}

/**
 * Apply damage to one section. The CORE is invulnerable until it is exposed (all turrets +
 * engines dead) — so the player must strip the ship before the finale. Returns a new comet.
 */
export function damageWolfCometSection(comet: WolfComet, id: string, dmg: number): WolfComet {
  const next: WolfComet = { ...comet, sections: comet.sections.map(s => ({ ...s })) };
  const s = next.sections.find(sec => sec.id === id);
  if (s && s.alive) {
    if (s.kind === 'core' && !comet.coreExposed) {
      // shielded — no damage until exposed
    } else {
      s.hp = Math.max(0, s.hp - Math.max(0, dmg));
      if (s.hp === 0) s.alive = false;
    }
  }
  recomputeFlags(next);
  return next;
}

/** Mark a turret as having just fired (resets its cooldown). Returns a new comet. */
export function wolfCometTurretFired(comet: WolfComet, id: string): WolfComet {
  return {
    ...comet,
    sections: comet.sections.map(s => (s.id === id ? { ...s, fireCooldown: s.fireInterval } : { ...s })),
  };
}

/** Alive turrets whose cooldown has elapsed — the app makes these fire at the player. */
export function wolfCometTurretsReadyToFire(comet: WolfComet): WolfCometSection[] {
  return comet.sections.filter(s => s.kind === 'turret' && s.alive && s.fireCooldown <= 0);
}

/** Overall boss health 0..1 (for the mission HUD bar). */
export function wolfCometHealthFraction(comet: WolfComet): number {
  const total = comet.sections.reduce((a, s) => a + s.maxHp, 0);
  const left = comet.sections.reduce((a, s) => a + s.hp, 0);
  return total > 0 ? left / total : 0;
}
