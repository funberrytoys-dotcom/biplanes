import {
  ENEMY_INITIAL_HP_LIGHT,
  type EntityId,
  type Vec2,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Rng } from '../rng/mulberry32.js';

const WARMUP_SECONDS = 2;

export interface SpawnResult {
  count: number;
}

/**
 * Returns how many enemies should spawn during the interval [prevTime, nowTime].
 * Difficulty ramps over time: 1 enemy every 3s at t=0, every 0.6s at t=180.
 */
export function computeSpawnsThisTick(
  nowTime: number,
  prevTime: number,
  _rng: Rng,
  _playerPos: Vec2
): SpawnResult {
  if (nowTime < WARMUP_SECONDS) return { count: 0 };

  const targetInterval = Math.max(0.6, 3.0 - nowTime / 60); // shrinks over time
  const spawnsPerSec = 1 / targetInterval;
  const dt = nowTime - prevTime;
  const expected = spawnsPerSec * dt;

  // Stochastic discretization
  const count = Math.floor(expected) + (_rng.next() < (expected % 1) ? 1 : 0);
  return { count };
}

export function makeEnemyPlane(id: EntityId, around: Vec2, rng: Rng): Plane {
  const angle = rng.next() * Math.PI * 2;
  const distance = 600 + rng.next() * 200;
  const px = around.x + Math.cos(angle) * distance;
  const py = around.y + Math.sin(angle) * distance;

  // Velocity points roughly toward player
  const dx = around.x - px;
  const dy = around.y - py;
  const ndist = Math.sqrt(dx * dx + dy * dy);
  const heading = Math.atan2(dy, dx);
  const speed = 220;

  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: px, y: py },
      velocity: { x: (dx / ndist) * speed, y: (dy / ndist) * speed },
      heading,
      throttleOn: true,
    },
    hp: ENEMY_INITIAL_HP_LIGHT,
    maxHp: ENEMY_INITIAL_HP_LIGHT,
    weaponCooldown: 0.5 + rng.next() * 1.0,
    alive: true,
  };
}
