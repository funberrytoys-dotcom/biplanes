import type { EntityId, Vec2 } from '@biplanes/shared';
import type { Faction } from './pilot.js';

export interface Bomb {
  id: EntityId;
  ownerId: EntityId;
  ownerFaction: Faction;
  position: Vec2;
  velocity: Vec2;
  lifetime: number; // seconds remaining (fallback if it doesn't hit ground)
  alive: boolean;
}
