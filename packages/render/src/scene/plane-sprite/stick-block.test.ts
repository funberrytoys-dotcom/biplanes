import { describe, it, expect } from 'vitest';
import { nextStickBlock, STICK_ON, STICK_OFF, type StickBlock } from './stick-block.js';

describe('nextStickBlock', () => {
  it('centres the elevator on the ground', () => {
    expect(nextStickBlock('up', -5, false)).toBe('level');
  });

  it('pulls the stick back when the nose swings up', () => {
    expect(nextStickBlock('level', -(STICK_ON + 0.1), true)).toBe('up');
  });

  it('pushes it forward when the nose swings down', () => {
    expect(nextStickBlock('level', STICK_ON + 0.1, true)).toBe('down');
  });

  it('holds the deflection through the gap instead of flickering', () => {
    const between = (STICK_ON + STICK_OFF) / 2;
    expect(nextStickBlock('up', -between, true)).toBe('up');
    expect(nextStickBlock('down', between, true)).toBe('down');
    expect(nextStickBlock('level', between, true)).toBe('level');
  });

  it('centres again once the aircraft settles', () => {
    expect(nextStickBlock('up', -(STICK_OFF - 0.05), true)).toBe('level');
    expect(nextStickBlock('down', 0, true)).toBe('level');
  });

  it('never flickers on the wander of ordinary flight', () => {
    // A slow sine of pitch rate that peaks between the two thresholds: the
    // elevator should be picked once and then stay put.
    let block: StickBlock = 'level';
    const seen = new Set<StickBlock>();
    for (let t = 0; t < 4; t += 1 / 60) {
      block = nextStickBlock(block, Math.sin(t * 2) * (STICK_OFF * 0.9), true);
      seen.add(block);
    }
    expect([...seen]).toEqual(['level']);
  });
});
