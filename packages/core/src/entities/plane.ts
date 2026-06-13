import type { EntityId } from '@biplanes/shared';
import type { PlaneKinematic } from '../physics/plane-physics.js';

export type PlaneFaction = 'player' | 'enemy';

/**
 * Lifecycle state of a plane.
 * - 'taxi'     — on the runway, ground roll, automatic throttle until liftoff.
 * - 'flying'   — normal dogfight physics.
 * - 'dying'    — lethal hit absorbed; plane spins down trailing fire for DYING_DURATION_SEC, then transitions to 'crashed'.
 * - 'crashed'  — invisible, can't fire, ticking down respawnTimer.
 * - 'spawning' — transient one-tick state used to reset to runway.
 */
export type PlaneState = 'taxi' | 'flying' | 'crashed' | 'spawning' | 'dying';

export type PlaneAiRole = 'chase-player' | 'attack-caravan';

export interface Plane {
  id: EntityId;
  faction: PlaneFaction;
  kinematic: PlaneKinematic;
  hp: number;
  maxHp: number;
  weaponCooldown: number; // seconds until next shot allowed
  bombCooldown?: number;  // seconds until next bomb allowed
  alive: boolean;

  state: PlaneState;
  respawnTimer: number;   // seconds until respawn (only meaningful when state === 'crashed')
  dyingTimer?: number;    // seconds remaining in death-spin (only meaningful when state === 'dying')
  boostHeat?: number;     // 0..1 engine heat from boost use
  boostActive?: boolean;
  noThrottleSec?: number; // time spent flying with throttle at zero
  aiRole?: PlaneAiRole;
  isBoss?: boolean;
  visualScale?: number;
  bossName?: string;
}
