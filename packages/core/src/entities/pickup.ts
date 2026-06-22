import type { EntityId, Vec2 } from '@biplanes/shared';

/** What a collected pickup gives the player. 'level' grants a bonus card pick (handled
 *  app-side via the collect event — the core just signals it). */
export type PickupKind = 'ammo' | 'repair' | 'rapidfire' | 'level';

/**
 * A supply balloon: a chest hanging under a balloon, drifting across the arena.
 * The player shoots it; at 0 HP it pops and drops floating {@link Pickup}s.
 */
export interface SupplyBalloon {
  id: EntityId;
  position: Vec2;        // logical centre (chest); the balloon bobs around it visually
  velocity: Vec2;        // gentle horizontal drift (px/sec)
  bobPhase: number;      // advanced by dt; drives the vertical bob
  hp: number;            // pops at <= 0
  alive: boolean;
}

/**
 * A dropped bonus item, gently floating down after a balloon popped. The player
 * grabs it by flying within PICKUP_RADIUS. Despawns when its lifetime runs out
 * or it reaches the ground.
 */
export interface Pickup {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  kind: PickupKind;
  lifetime: number;      // seconds left before it fades
  bobPhase: number;      // advanced by dt; drives a small horizontal sway
  collected: boolean;
}
