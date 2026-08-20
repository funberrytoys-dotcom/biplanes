import { describe, it, expect } from 'vitest';
import {
  elevIndex,
  nextRollIndex,
  nextStick,
  poseFrame,
  rollIndex,
  STICK_ON,
  STICK_OFF,
  type Stick,
} from './pose.js';

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

describe('nextRollIndex — the anti-buzz rules', () => {
  it('walks one row at a time instead of teleporting', () => {
    expect(nextRollIndex(6, -22, ROLL)).toBe(5);
    expect(nextRollIndex(5, -22, ROLL)).toBe(4);
    expect(nextRollIndex(0, 22, ROLL)).toBe(1);
  });

  it('gets all the way across if the bank stays there', () => {
    let row = 6;
    for (let i = 0; i < 30; i++) row = nextRollIndex(row, -22, ROLL);
    expect(ROLL[row]).toBe(-22);
  });

  it('holds still when the bank sits exactly on a boundary', () => {
    const boundary = ((ROLL[6] ?? 0) + (ROLL[7] ?? 0)) / 2;   // between 0 and 1.8
    let row = 6;
    for (let i = 0; i < 50; i++) row = nextRollIndex(row, boundary, ROLL);
    expect(row).toBe(6);
  });

  it('does not flicker on a bank that jitters across a boundary', () => {
    const boundary = ((ROLL[6] ?? 0) + (ROLL[7] ?? 0)) / 2;
    const gap = Math.abs((ROLL[7] ?? 0) - (ROLL[6] ?? 0));
    let row = 6;
    let changes = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = boundary + Math.sin(i * 1.7) * gap * 0.25;   // wobbles either side
      const next = nextRollIndex(row, noisy, ROLL);
      if (next !== row) changes++;
      row = next;
    }
    expect(changes).toBe(0);
  });

  it('still follows a bank that genuinely sweeps across', () => {
    let row = 6;
    const seen = new Set<number>([row]);
    for (let t = 0; t < 400; t++) {
      row = nextRollIndex(row, Math.sin(t / 40) * 22, ROLL);
      seen.add(row);
    }
    expect(seen.size).toBeGreaterThan(8);   // it really does travel
  });

  it('survives a row index handed to it out of range', () => {
    expect(nextRollIndex(-5, 0, ROLL)).toBeGreaterThanOrEqual(0);
    expect(nextRollIndex(99, 0, ROLL)).toBeLessThan(ROLL.length);
  });
});

describe('nextStick — minimum dwell', () => {
  it('refuses to change again before it has held long enough', () => {
    expect(nextStick(0, -5, true, 0.01)).toBe(0);
    expect(nextStick(0, -5, true, 1)).toBe(-1);
  });

  it('does not buzz when the pitch rate hovers on the threshold', () => {
    let stick: Stick = 0;
    let held = 0;
    let changes = 0;
    for (let i = 0; i < 600; i++) {
      const rate = STICK_ON + Math.sin(i * 2.1) * 0.2;   // straddles the line
      held += 1 / 60;
      const next = nextStick(stick, rate, true, held);
      if (next !== stick) { changes++; held = 0; stick = next; }
    }
    expect(changes).toBeLessThanOrEqual(2);
  });

  it('still centres promptly on the ground whatever the dwell', () => {
    expect(nextStick(-1, -5, false, 0)).toBe(0);
  });
});
