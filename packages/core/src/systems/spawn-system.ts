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

  // Face the player along x-axis: if player is to our right, face right.
  const facing: 2 | 3 = around.x >= px ? 3 : 2;
  const speed = 850 + Math.floor(rng.next() * 100); // 850-950, slower than player, varies a bit
  // f = 0 = horizontal forward (left if facing=2, right if facing=3)
  const f = 0;
  // Initial velocity/heading consistent with BT model at f=0
  // facing=3: BT deg=90 (right) -> screen rad = 0; vx = sin(90°)*g = g, vy = -cos(90°)*g = 0
  // facing=2: BT deg=270 (left) -> screen rad = π; vx = sin(270°)*g = -g, vy = 0
  const btDeg = facing === 3 ? 90 : 270;
  const screenHeading = ((btDeg - 90) * Math.PI) / 180;
  const sinH = Math.sin((btDeg * Math.PI) / 180);
  const cosH = Math.cos((btDeg * Math.PI) / 180);
  const vx = sinH * speed;
  const vy = -cosH * speed;

  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: px, y: py },
      velocity: { x: vx, y: vy },
      heading: screenHeading,
      throttleOn: true,
      g: speed,
      f,
      facing,
      turnCdSec: 0,
      throttle: true,
      rotateAccumulator: 0,
    },
    hp: ENEMY_INITIAL_HP_LIGHT,
    maxHp: ENEMY_INITIAL_HP_LIGHT,
    weaponCooldown: 0.5 + rng.next() * 1.0,
    alive: true,
  };
}
