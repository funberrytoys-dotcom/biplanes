import { describe, it, expect } from 'vitest';
import {
  easePropRev,
  nextPropPhase,
  propFrameIndex,
  propRevsPerSecond,
  CRISP_BELOW,
  FULL_REV,
  IDLE_REV,
} from './prop-spin.js';

const STEPS = 10;
const BLUR = 3;

describe('propRevsPerSecond', () => {
  it('stands still with the engine out', () => {
    expect(propRevsPerSecond(false, 1)).toBe(0);
  });

  it('ticks over at idle and winds right up at full gas', () => {
    expect(propRevsPerSecond(true, 0)).toBe(IDLE_REV);
    expect(propRevsPerSecond(true, 1)).toBe(FULL_REV);
    expect(propRevsPerSecond(true, 0.5)).toBeGreaterThan(IDLE_REV);
    expect(propRevsPerSecond(true, 0.5)).toBeLessThan(FULL_REV);
  });

  it('ignores a throttle outside its range', () => {
    expect(propRevsPerSecond(true, 5)).toBe(FULL_REV);
    expect(propRevsPerSecond(true, -3)).toBe(IDLE_REV);
  });
});

describe('easePropRev', () => {
  it('spools up towards the target instead of snapping there', () => {
    const one = easePropRev(0, FULL_REV, 1 / 60);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(FULL_REV * 0.5);
  });

  it('gets there in about a second of full gas', () => {
    let r = 0;
    for (let i = 0; i < 60; i++) r = easePropRev(r, FULL_REV, 1 / 60);
    expect(r).toBeGreaterThan(FULL_REV * 0.9);
  });

  it('freewheels down far slower than it spools up', () => {
    let up = 0, down = FULL_REV;
    for (let i = 0; i < 30; i++) {
      up = easePropRev(up, FULL_REV, 1 / 60);
      down = easePropRev(down, 0, 1 / 60);
    }
    expect(up / FULL_REV).toBeGreaterThan(1 - down / FULL_REV);
  });
});

describe('propFrameIndex', () => {
  it('walks the crisp blade steps while it is turning slowly', () => {
    let phase = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 120; i++) {
      phase = nextPropPhase(phase, 1.5, 1 / 60);
      seen.add(propFrameIndex(1.5, phase, STEPS, BLUR));
    }
    expect(seen.size).toBe(STEPS);
    expect(Math.max(...seen)).toBeLessThan(STEPS);
  });

  it('goes to a blurred frame once it is spinning fast', () => {
    expect(propFrameIndex(CRISP_BELOW + 0.5, 0, STEPS, BLUR)).toBeGreaterThanOrEqual(STEPS);
    expect(propFrameIndex(FULL_REV, 0, STEPS, BLUR)).toBe(STEPS + BLUR - 1);
  });

  it('blurs harder the faster it goes', () => {
    const slowBlur = propFrameIndex(CRISP_BELOW + 0.2, 0, STEPS, BLUR);
    const fastBlur = propFrameIndex(FULL_REV * 0.8, 0, STEPS, BLUR);
    expect(fastBlur).toBeGreaterThan(slowBlur);
  });

  it('never leaves the sheet', () => {
    for (const rev of [0, 1, 4, 8, 20, 100]) {
      for (const phase of [0, 1, 3, Math.PI - 0.001]) {
        const i = propFrameIndex(rev, phase, STEPS, BLUR);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(STEPS + BLUR);
      }
    }
  });

  it('falls back to blades when a sheet has no blurred frames', () => {
    expect(propFrameIndex(FULL_REV, 0, STEPS, 0)).toBeLessThan(STEPS);
  });
});

describe('nextPropPhase', () => {
  it('stays inside a half turn, since a blade pair repeats there', () => {
    let phase = 0;
    for (let i = 0; i < 500; i++) {
      phase = nextPropPhase(phase, 30, 1 / 60);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI);
    }
  });
});

describe('propFrameIndex — the anti-strobe rules', () => {
  it('does not swap between blades and smear on a throttle sitting on the line', () => {
    let frame = 0;
    let phase = 0;
    let crossings = 0;
    let wasCrisp = true;
    for (let i = 0; i < 400; i++) {
      const rev = CRISP_BELOW + Math.sin(i * 1.9) * 0.5;   // straddles the boundary
      phase = nextPropPhase(phase, rev, 1 / 60);
      frame = propFrameIndex(rev, phase, STEPS, BLUR, frame);
      const crisp = frame < STEPS;
      if (crisp !== wasCrisp) crossings++;
      wasCrisp = crisp;
    }
    expect(crossings).toBeLessThanOrEqual(1);
  });

  it('climbs the blur levels one at a time', () => {
    let frame = STEPS;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      frame = propFrameIndex(FULL_REV, 0, STEPS, BLUR, frame);
      seen.push(frame);
    }
    expect(seen[0]).toBe(STEPS + 1);
    expect(seen[seen.length - 1]).toBe(STEPS + BLUR - 1);
  });

  it('still ends up smeared at full gas and crisp at rest', () => {
    let frame = 0;
    for (let i = 0; i < 30; i++) frame = propFrameIndex(FULL_REV, 0, STEPS, BLUR, frame);
    expect(frame).toBe(STEPS + BLUR - 1);
    for (let i = 0; i < 30; i++) frame = propFrameIndex(0.5, 0.1, STEPS, BLUR, frame);
    expect(frame).toBeLessThan(STEPS);
  });
});
