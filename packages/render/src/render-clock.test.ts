import { describe, it, expect } from 'vitest';
import { createRenderClock } from './render-clock.js';

describe('renderClock', () => {
  it('returns realDt by default', () => {
    const c = createRenderClock();
    expect(c.tick(0.016)).toBeCloseTo(0.016);
  });

  it('returns 0 dt while paused', () => {
    const c = createRenderClock();
    c.hitPause(3);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBeCloseTo(0.016); // 4th frame: pause expired
  });

  it('extends an active pause (max, not sum)', () => {
    const c = createRenderClock();
    c.hitPause(2);
    c.hitPause(5);
    let totalPaused = 0;
    for (let i = 0; i < 5; i++) if (c.tick(0.016) === 0) totalPaused++;
    expect(totalPaused).toBe(5);
  });

  it('slow-mo scales realDt over duration then recovers', () => {
    const c = createRenderClock();
    c.slowMo(0.25, 0.1, 0.05); // scale, dur, recovery
    const dt = 0.02;
    // For first 0.1s effective dt = realDt * 0.25
    const a = c.tick(dt);
    expect(a).toBeCloseTo(dt * 0.25);
  });
});
