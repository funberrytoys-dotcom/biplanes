import type { EntityId } from '@biplanes/shared';
import type { PlaneKinematic } from '../physics/plane-physics.js';

export type PlaneFaction = 'player' | 'enemy';

/**
 * Lifecycle state of a plane.
 * - 'taxi'     — on the runway, ground roll, automatic throttle until liftoff.
 * - 'flying'   — normal dogfight physics.
 * - 'crashed'  — invisible, can't fire, ticking down respawnTimer.
 * - 'spawning' — transient one-tick state used to reset to runway.
 */
export type PlaneState = 'taxi' | 'flying' | 'crashed' | 'spawning';

export interface Plane {
  id: EntityId;
  faction: PlaneFaction;
  kinematic: PlaneKinematic;
  hp: number;
  maxHp: number;
  weaponCooldown: number; // seconds until next shot allowed
  alive: boolean;
  state: PlaneState;
  respawnTimer: number;   // seconds until respawn (only meaningful when state === 'crashed')
}
