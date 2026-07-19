import { describe, expect, it } from 'vitest';
import {
  resolveThrottleZone,
  THROTTLE_CAREFUL_FRAC,
  THROTTLE_HOLD_FRAC,
  THROTTLE_STALL_LINE_FRAC,
} from './throttle-gauge.js';

describe('throttle gauge zones', () => {
  it('full gas reads as the green "holds altitude" zone', () => {
    expect(resolveThrottleZone(1)).toBe('hold');
    expect(resolveThrottleZone(THROTTLE_HOLD_FRAC)).toBe('hold');
  });

  it('mid throttle reads as the amber "careful" zone', () => {
    expect(resolveThrottleZone((THROTTLE_HOLD_FRAC + THROTTLE_CAREFUL_FRAC) / 2)).toBe('careful');
    expect(resolveThrottleZone(THROTTLE_CAREFUL_FRAC)).toBe('careful');
  });

  it('idle throttle reads as the red "stalling" zone', () => {
    expect(resolveThrottleZone(0)).toBe('stall');
    expect(resolveThrottleZone(THROTTLE_CAREFUL_FRAC - 0.01)).toBe('stall');
  });

  it('exposes a stall-line fraction inside the lever range', () => {
    expect(THROTTLE_STALL_LINE_FRAC).toBeGreaterThan(0);
    expect(THROTTLE_STALL_LINE_FRAC).toBeLessThanOrEqual(1);
  });

  it('honest gauge: green "holds altitude" starts exactly at the physics stall line', () => {
    // The colour must not claim you hold altitude where level cruise would actually sink.
    expect(THROTTLE_HOLD_FRAC).toBeCloseTo(THROTTLE_STALL_LINE_FRAC, 5);
    expect(resolveThrottleZone(THROTTLE_STALL_LINE_FRAC - 0.02)).not.toBe('hold');
  });
});
