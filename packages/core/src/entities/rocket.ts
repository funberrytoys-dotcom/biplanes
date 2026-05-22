import type { EntityId, Vec2 } from '@biplanes/shared';
import type { Faction } from './pilot.js';

export interface Rocket {
  id: EntityId;
  ownerId: EntityId;
  ownerFaction: Faction;
  position: Vec2;
  velocity: Vec2;
  heading: number;
  lifetime: number; // seconds remaining
  alive: boolean;
  damage: number;
}
