import { describe, it, expect } from 'vitest';
import { computeSpawnsThisTick, makeEnemyPlane } from './spawn-system.js';
import { createRng } from '../rng/mulberry32.js';

describe('spawn-system', () => {
  it('spawns nothing in first 2 seconds (warmup)', () => {
    const rng = createRng(42);
    const result = computeSpawnsThisTick(1.0, 0, rng, { x: 500, y: 500 });
    expect(result.count).toBe(0);
  });

  it('spawns more often as time progresses', () => {
    const rng = createRng(42);
    const earlyCount = computeSpawnsThisTick(10, 9.5, rng, { x: 500, y: 500 }).count;
    const lateCount = computeSpawnsThisTick(120, 119.5, rng, { x: 500, y: 500 }).count;
    expect(lateCount).toBeGreaterThanOrEqual(earlyCount);
  });

  it('makeEnemyPlane creates valid enemy near player but off-screen', () => {
    const rng = createRng(42);
    const e = makeEnemyPlane(99, { x: 500, y: 500 }, rng);
    expect(e.faction).toBe('enemy');
    expect(e.alive).toBe(true);
    expect(e.hp).toBeGreaterThan(0);
    const dx = e.kinematic.position.x - 500;
    const dy = e.kinematic.position.y - 500;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(400); // spawned off-screen
    expect(dist).toBeLessThan(1200);
  });
});
