import type { EntityId, Vec2 } from '@biplanes/shared';

export interface Bullet {
  id: EntityId;
  ownerId: EntityId;
  position: Vec2;
  velocity: Vec2;
  lifetime: number;       // seconds remaining
  damage: number;
  alive: boolean;
}
