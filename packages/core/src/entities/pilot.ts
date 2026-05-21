import type { EntityId, Vec2 } from '@biplanes/shared';

/**
 * Lifecycle of an ejected pilot.
 *  - 'parachute' — descending under canopy, player steers L/R drift.
 *  - 'walking'   — on the ground, autonomously walking toward hangar (player steer can override direction).
 *  - 'dead'      — shot down or KIA; ticking down deathTimer until cleanup.
 *  - 'safe'      — reached hangar, will trigger plane respawn next tick.
 */
export type PilotState = 'parachute' | 'walking' | 'dead' | 'safe';

export interface Pilot {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  state: PilotState;
  facing: 1 | -1;          // direction the pilot is walking
  hp: number;              // pilot has tiny HP — basically one-hit kill from any bullet
  deathTimer: number;      // seconds remaining in 'dead' state before removal
}
