import { describe, it, expect } from 'vitest';
import { createRng } from './mulberry32.js';

describe('mulberry32 PRNG', () => {
  it('produces deterministic sequence for same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBeCloseTo(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const aVals = Array.from({ length: 5 }, () => a.next());
    const bVals = Array.from({ length: 5 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() returns integer in [min, max)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(5, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('range() with a degenerate span (max<=min) returns min without breaking the stream', () => {
    const rng = createRng(123);
    // max==min and max<min both yield min (span clamped to 0)…
    expect(rng.range(5, 5)).toBe(5);
    expect(rng.range(9, 3)).toBe(9);
    // …and each still consumed exactly one draw, so a parallel rng stays in lock-step.
    const a = createRng(555);
    const b = createRng(555);
    a.range(4, 4); // degenerate draw on `a`
    b.next();      // one plain draw on `b`
    expect(a.next()).toBeCloseTo(b.next());
  });

  it('pick() returns one of provided items', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('pickN() returns n distinct items', () => {
    const rng = createRng(11);
    const items = [1, 2, 3, 4, 5];
    const picked = rng.pickN(items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach(p => expect(items).toContain(p));
  });
});
