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

export type PlaneAiRole = 'chase-player' | 'attack-caravan' | 'rookie' | 'hunter' | 'ace' | 'boss';

export interface Plane {
  id: EntityId;
  faction: PlaneFaction;
  kinematic: PlaneKinematic;
  hp: number;
  maxHp: number;
  weaponCooldown: number; // seconds until next shot allowed
  bombCooldown?: number;  // seconds until next bomb allowed (legacy)
  specialCooldown?: number; // seconds until next rocket salvo allowed
  ammo?: number;          // rounds left in the magazine (player only)
  reloadTimer?: number;   // seconds left while reloading (player only); >0 = reloading
  wingRockets?: number;   // straight wing rockets left under the wings (player only)
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
  /** <1 = armored (takes less damage). Алые Шакалы run with ~0.8. Default 1. */
  incomingDamageMultiplier?: number;
  /** Scales the airframe's top speed (level + dive caps). Алые Шакалы ~0.9. Default 1. */
  speedMultiplier?: number;
  /** Enemy only: this plane can launch homing rockets at the player. */
  firesRockets?: boolean;
  /** Enemy only: seconds until the next rocket launch is allowed. */
  rocketCooldown?: number;
  /** Enemy only: fires the heavy Алые Шакалы "boom" slugs (fat ember balls, harder per
   *  shot, slower cadence). Set when С.О.В. is the player — the red opponents ARE Jackals. */
  firesHeavy?: boolean;
}
