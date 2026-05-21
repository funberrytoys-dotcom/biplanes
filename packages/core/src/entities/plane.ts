import type { EntityId } from '@biplanes/shared';
import type { PlaneKinematic } from '../physics/plane-physics.js';

export type PlaneFaction = 'player' | 'enemy';

export interface Plane {
  id: EntityId;
  faction: PlaneFaction;
  kinematic: PlaneKinematic;
  hp: number;
  maxHp: number;
  weaponCooldown: number; // seconds until next shot allowed
  alive: boolean;
}
