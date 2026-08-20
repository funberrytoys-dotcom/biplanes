import { describe, it, expect } from 'vitest';
import { elevIndex, nextStick, poseFrame, rollIndex, STICK_ON, STICK_OFF, type Stick } from './pose.js';

const ROLL = [-22, -14, -8, -3.5, 0, 3.5, 8, 14, 22];

describe('nextStick', () => {
  it('centres on the ground', () => {
    expect(nextStick(-1, -5, false)).toBe(0);
  });

  it('goes back when the nose swings up, forward when it swings down', () => {
    expect(nextStick(0, -(STICK_ON + 0.1), true)).toBe(-1);
    expect(nextStick(0, STICK_ON + 0.1, true)).toBe(1);
  });

  it('holds through the gap instead of flickering', () => {
    const between = (STICK_ON + STICK_OFF) / 2;
    expect(nextStick(-1, -between, true)).toBe(-1);
    expect(nextStick(0, between, true)).toBe(0);
  });

  it('never flickers on the wander of ordinary flight', () => {
    let stick: Stick = 0;
    const seen = new Set<Stick>();
    for (let t = 0; t < 4; t += 1 / 60) {
      stick = nextStick(stick, Math.sin(t * 2) * (STICK_OFF * 0.9), true);
      seen.add(stick);
    }
    expect([...seen]).toEqual([0]);
  });
});

describe('elevIndex', () => {
  it('takes the ends of the baked travel and the middle for centred', () => {
    expect(elevIndex(-1, 3)).toBe(0);
    expect(elevIndex(0, 3)).toBe(1);
    expect(elevIndex(1, 3)).toBe(2);
  });

  it('copes with a sheet that has only one elevator step', () => {
    expect(elevIndex(-1, 1)).toBe(0);
    expect(elevIndex(1, 1)).toBe(0);
  });
});

describe('rollIndex', () => {
  it('finds the nearest baked bank', () => {
    expect(ROLL[rollIndex(0, ROLL)]).toBe(0);
    expect(ROLL[rollIndex(-3.4, ROLL)]).toBe(-3.5);
    expect(ROLL[rollIndex(9, ROLL)]).toBe(8);
  });

  it('clamps to the steepest pose it has', () => {
    expect(ROLL[rollIndex(-90, ROLL)]).toBe(-22);
    expect(ROLL[rollIndex(90, ROLL)]).toBe(22);
  });

  it('covers every baked step as the bank sweeps across', () => {
    const seen = new Set<number>();
    for (let d = -22; d <= 22; d += 0.25) seen.add(rollIndex(d, ROLL));
    expect(seen.size).toBe(ROLL.length);
  });
});

describe('poseFrame', () => {
  it('lays the grid out row by row', () => {
    expect(poseFrame(0, 0, 3)).toBe(0);
    expect(poseFrame(0, 2, 3)).toBe(2);
    expect(poseFrame(1, 0, 3)).toBe(3);
    expect(poseFrame(8, 2, 3)).toBe(26);
  });

  it('never runs off the end of a 9x3 sheet', () => {
    for (let r = 0; r < 9; r++) for (let e = 0; e < 3; e++) {
      const f = poseFrame(r, e, 3);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(27);
    }
  });
});
