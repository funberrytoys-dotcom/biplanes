import type { EntityId, Vec2 } from '@biplanes/shared';
import type { Faction } from './pilot.js';

export interface Bullet {
  id: EntityId;
  ownerId: EntityId;
  ownerFaction: Faction;  // who fired this — used for friendly-fire prevention against pilots
  position: Vec2;
  velocity: Vec2;
  lifetime: number;       // seconds remaining
  damage: number;
  alive: boolean;
  isHeavy?: boolean;
  pierceCount?: number;
}

