import type { EntityId } from '@biplanes/shared';
import { XP_PICKUP_MAGNET_RANGE } from '@biplanes/shared';
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

  appliedUpgradeIds: string[];      // chronological list of upgrade IDs picked
  damageMultiplier: number;         // 1.0 base, multiplies bullet damage
  fireRateMultiplier: number;       // 1.0 base, divides cooldown
  hpMultiplier: number;             // 1.0 base, multiplies max HP on apply
  xpMagnetRange: number;            // base XP_PICKUP_MAGNET_RANGE
  hasDrone: boolean;                // future flag for drone companion

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
    appliedUpgradeIds: [],
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    hpMultiplier: 1,
    xpMagnetRange: XP_PICKUP_MAGNET_RANGE,
    hasDrone: false,
    gameOver: false,
  };
}
