import type { EntityId, Vec2 } from '@biplanes/shared';

/**
 * Lifecycle of an ejected pilot.
 *  - 'parachute' — descending under canopy, player steers L/R drift.
 *  - 'walking'   — on the ground, controlled by input (or AI for enemy pilot).
 *  - 'dead'      — shot down or KIA; ticking down deathTimer until cleanup.
 *  - 'safe'      — reached own hangar, will trigger plane respawn next tick.
 */
export type PilotState = 'parachute' | 'walking' | 'dead' | 'safe';

export type Faction = 'player' | 'enemy';

export interface Pilot {
  id: EntityId;
  faction: Faction;
  position: Vec2;
  velocity: Vec2;
  state: PilotState;
  facing: 1 | -1;                 // direction the pilot is walking/facing
  hp: number;                     // pilot has tiny HP — one-hit kill from any bullet
  deathTimer: number;             // seconds remaining in 'dead' state before removal
  groundedJumpCooldown: number;   // seconds until pilot can jump again (only when grounded)
}

/** Find the (at most one) pilot of a given faction in the pilots array. */
export function findPilot(pilots: readonly Pilot[], faction: Faction): Pilot | undefined {
  return pilots.find(p => p.faction === faction);
}
