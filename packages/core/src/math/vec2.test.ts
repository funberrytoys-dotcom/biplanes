import { describe, it, expect } from 'vitest';
import { add, sub, scale, length, normalize, rotate, angleOf, dot } from './vec2.js';

describe('vec2', () => {
  it('adds two vectors', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it('subtracts two vectors', () => {
    expect(sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
  });

  it('scales a vector', () => {
    expect(scale({ x: 2, y: -3 }, 4)).toEqual({ x: 8, y: -12 });
  });

  it('computes length', () => {
    expect(length({ x: 3, y: 4 })).toBeCloseTo(5);
    expect(length({ x: 0, y: 0 })).toBe(0);
  });

  it('normalizes a vector to unit length', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    expect(length(n)).toBeCloseTo(1);
  });

  it('returns zero vector when normalizing zero', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('rotates by angle (radians)', () => {
    const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });

  it('computes angle of a vector', () => {
    expect(angleOf({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(angleOf({ x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('computes dot product', () => {
    expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
  });
});
