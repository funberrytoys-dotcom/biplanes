import type { EntityId } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

export interface WorldState {
  timeSec: number;          // wall clock since run started
  tickCount: number;
  nextEntityId: EntityId;
  rngSeed: number;
  rngState: number;         // current PRNG state (for replay)

  player: Plane;
  enemies: Plane[];
  bullets: Bullet[];

  xpCollected: number;
  level: number;
  pendingLevelUp: boolean;  // true between earning level-up and choosing upgrade

  gameOver: boolean;
}

export function createWorldState(seed: number, player: Plane): WorldState {
  return {
    timeSec: 0,
    tickCount: 0,
    nextEntityId: player.id + 1,
    rngSeed: seed,
    rngState: seed,
    player,
    enemies: [],
    bullets: [],
    xpCollected: 0,
    level: 1,
    pendingLevelUp: false,
    gameOver: false,
  };
}
