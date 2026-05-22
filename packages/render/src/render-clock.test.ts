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

  it('subsequent hitPause within 150ms cooldown is suppressed', () => {
    const c = createRenderClock();
    c.hitPause(2);
    // No tick between the calls → no real time elapsed → cooldown blocks the 5.
    c.hitPause(5);
    let totalPaused = 0;
    for (let i = 0; i < 5; i++) if (c.tick(0.016) === 0) totalPaused++;
    expect(totalPaused).toBe(2);
  });

  it('hitPause fires again after the cooldown elapses', () => {
    const c = createRenderClock();
    c.hitPause(2);
    // Drain the first pause (2 frames at 16ms = 32ms) and then advance real time
    // past the 150ms cooldown by ticking unpaused frames.
    for (let i = 0; i < 12; i++) c.tick(0.016); // ~192ms total
    c.hitPause(3);
    let paused = 0;
    for (let i = 0; i < 5; i++) if (c.tick(0.016) === 0) paused++;
    expect(paused).toBe(3);
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
