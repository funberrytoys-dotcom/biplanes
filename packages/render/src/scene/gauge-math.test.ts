import { describe, it, expect } from 'vitest';
import {
  clamp01,
  normalize,
  lerp,
  gaugeAngle,
  damp,
  dampAngle,
  padDigits,
} from './gauge-math.js';

describe('clamp01', () => {
  it('clamps below 0 and above 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBeCloseTo(0.3);
  });
});

describe('normalize', () => {
  it('maps value across range into 0..1', () => {
    expect(normalize(50, 0, 100)).toBeCloseTo(0.5);
  });
  it('clamps out-of-range values', () => {
    expect(normalize(-10, 0, 100)).toBe(0);
    expect(normalize(200, 0, 100)).toBe(1);
  });
  it('returns 0 for degenerate range', () => {
    expect(normalize(5, 10, 10)).toBe(0);
  });
});

describe('lerp', () => {
  it('interpolates between a and b', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('gaugeAngle', () => {
  it('maps fraction across sweep from start', () => {
    expect(gaugeAngle(0, 1, 2)).toBeCloseTo(1);
    expect(gaugeAngle(1, 1, 2)).toBeCloseTo(3);
    expect(gaugeAngle(0.5, 1, 2)).toBeCloseTo(2);
  });
  it('clamps fraction', () => {
    expect(gaugeAngle(5, 0, 2)).toBeCloseTo(2);
  });
});

describe('damp', () => {
  it('moves current toward target by factor', () => {
    expect(damp(0, 10, 0.5)).toBeCloseTo(5);
  });
  it('converges over repeated application', () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = damp(v, 10, 0.3);
    expect(v).toBeCloseTo(10, 3);
  });
});

describe('dampAngle', () => {
  it('takes the short way around the circle', () => {
    const next = dampAngle(0, Math.PI * 1.9, 0.5);
    expect(next).toBeLessThan(0);
  });
  it('converges to target modulo 2PI', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) a = dampAngle(a, 1.2, 0.3);
    expect(Math.cos(a)).toBeCloseTo(Math.cos(1.2), 3);
    expect(Math.sin(a)).toBeCloseTo(Math.sin(1.2), 3);
  });
});

describe('padDigits', () => {
  it('left-pads to width', () => {
    expect(padDigits(7, 4)).toBe('0007');
    expect(padDigits(1234, 4)).toBe('1234');
  });
  it('rounds and clamps negatives to 0', () => {
    expect(padDigits(12.6, 3)).toBe('013');
    expect(padDigits(-5, 2)).toBe('00');
  });
});
