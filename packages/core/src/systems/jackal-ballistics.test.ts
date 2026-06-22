import { describe, it, expect } from 'vitest';
import { stepBullets } from './weapon-system.js';
import { JACKAL_BULLET_SPEED_MULT, JACKAL_BULLET_GRAVITY_MULT, BULLET_SPEED } from '@biplanes/shared';
import type { Bullet } from '../entities/bullet.js';

function mk(vx: number, gravityScale: number): Bullet {
  return { id: 1, ownerId: 0, ownerFaction: 'player', position: { x: 0, y: 0 }, velocity: { x: vx, y: 0 }, lifetime: 10, damage: 10, alive: true, gravityScale };
}

// Fire horizontally; record the vertical DROP when the bullet first passes x = targetX.
function dropAt(b0: Bullet, targetX: number): number {
  let b = b0;
  for (let i = 0; i < 600; i++) {
    const next = stepBullets([b]);
    if (next.length === 0) break;
    b = next[0]!;
    if (b.position.x >= targetX) return b.position.y;
  }
  return Infinity;
}

describe('Jackal bullet parabola matches С.О.В.', () => {
  it('drops by roughly the same amount at the same distance (aim-able)', () => {
    const sov = mk(BULLET_SPEED, 1);
    const jk = mk(BULLET_SPEED * JACKAL_BULLET_SPEED_MULT, JACKAL_BULLET_GRAVITY_MULT);
    for (const x of [300, 600, 900]) {
      const dSov = dropAt(sov, x);
      const dJk = dropAt(jk, x);
      // Within 15% of the С.О.В. drop at each distance → same parabola, just a heavy slow ball.
      expect(Math.abs(dJk - dSov) / Math.max(1, dSov)).toBeLessThan(0.15);
    }
  });
});
