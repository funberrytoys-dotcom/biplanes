import { describe, it, expect } from 'vitest';
import {
  advanceKick,
  flightRollDegrees,
  flightWobble,
  wobblePhase,
  type KickState,
  type WobbleInput,
} from './wobble.js';

const base: WobbleInput = {
  time: 0,
  phase: 0,
  envelope: 1,
  turnRate: 0,
  speed: 200,
  stallSpeed: 150,
  turbulence: 0,
};

/** Biggest |rotation| the sway reaches over a few seconds of flight. */
function peakRotation(over: Partial<WobbleInput>): number {
  let peak = 0;
  for (let t = 0; t < 6; t += 1 / 60) {
    peak = Math.max(peak, Math.abs(flightWobble({ ...base, ...over, time: t }).rotation));
  }
  return peak;
}

describe('flightWobble', () => {
  it('is perfectly still on the ground', () => {
    const w = flightWobble({ ...base, envelope: 0, time: 1.3 });
    expect(w.rotation).toBe(0);
    expect(w.heave).toBe(0);
  });

  it('stays a sway, never a barrel roll', () => {
    // Worst case: stalled, in a storm, flying straight.
    const peak = peakRotation({ speed: 0, turbulence: 1 });
    expect(peak).toBeLessThan(0.11); // < 6.5°
    expect(peak).toBeGreaterThan(0.05);
  });

  it('reads clearly in ordinary level flight', () => {
    const peak = peakRotation({});
    expect(peak).toBeGreaterThan(0.02); // > 1.1°
    expect(peak).toBeLessThan(0.05);
  });

  it('gets out of the way when the pilot hauls it round a turn', () => {
    expect(peakRotation({ turnRate: 3 })).toBeLessThan(peakRotation({ turnRate: 0 }));
  });

  it('wallows harder near the stall and in gusty weather', () => {
    expect(peakRotation({ speed: 40 })).toBeGreaterThan(peakRotation({ speed: 400 }));
    expect(peakRotation({ turbulence: 1 })).toBeGreaterThan(peakRotation({ turbulence: 0 }));
  });

  it('does not divide by zero when a plane has no stall speed', () => {
    expect(Number.isFinite(flightWobble({ ...base, stallSpeed: 0, time: 2 }).rotation)).toBe(true);
  });

  it('floats vertically by only a couple of pixels', () => {
    let peak = 0;
    for (let t = 0; t < 6; t += 1 / 60) {
      peak = Math.max(peak, Math.abs(flightWobble({ ...base, time: t }).heave));
    }
    expect(peak).toBeGreaterThan(1.5);
    expect(peak).toBeLessThan(3);
  });

  it('never lets two planes rock in lockstep', () => {
    const phases = [0, 1, 2, 3, 4, 5, 6, 7].map(wobblePhase);
    expect(new Set(phases.map((p) => p.toFixed(4))).size).toBe(phases.length);
    // Neighbouring ids in particular must land far apart.
    for (let i = 1; i < phases.length; i++) {
      const gap = Math.abs((phases[i] ?? 0) - (phases[i - 1] ?? 0));
      expect(Math.min(gap, Math.PI * 2 - gap)).toBeGreaterThan(0.5);
    }
  });
});

describe('flightRollDegrees', () => {
  const base = { time: 0, phase: 0, envelope: 1, pitchRate: 0, kick: 0 };

  it('keeps the wings level on the ground', () => {
    expect(flightRollDegrees({ ...base, envelope: 0, time: 2 })).toBe(0);
  });

  it('rocks the wings BOTH ways in straight flight', () => {
    let lo = 0, hi = 0;
    for (let t = 0; t < 12; t += 1 / 30) {
      const r = flightRollDegrees({ ...base, time: t });
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    }
    expect(hi).toBeGreaterThan(2);   // near wing lifts
    expect(lo).toBeLessThan(-2);     // and dips
    expect(hi).toBeLessThan(10);     // but it is a rock, not a wingover
    expect(lo).toBeGreaterThan(-10);
  });

  it('banks into a held turn, and the other way for the other stick', () => {
    const pull = flightRollDegrees({ ...base, pitchRate: -2.2 });
    const push = flightRollDegrees({ ...base, pitchRate: 2.2 });
    expect(pull).toBeLessThan(-8);
    expect(push).toBeGreaterThan(8);
  });

  it('banks harder still when the kick spring is loaded', () => {
    const plain = flightRollDegrees({ ...base, pitchRate: -2.2 });
    const kicked = flightRollDegrees({ ...base, pitchRate: -2.2, kick: -0.12 });
    expect(Math.abs(kicked)).toBeGreaterThan(Math.abs(plain));
  });

  it('never asks for a bank the sheet does not hold', () => {
    for (const pitchRate of [-40, -2, 0, 2, 40]) {
      for (const kick of [-1, 0, 1]) {
        for (const time of [0, 1.7, 4.4]) {
          const r = flightRollDegrees({ ...base, time, pitchRate, kick });
          expect(Math.abs(r)).toBeLessThanOrEqual(22);
        }
      }
    }
  });
});

describe('advanceKick', () => {
  const step = (s: KickState, delta: number) => advanceKick(s, delta, 1 / 60);

  it('does nothing while the stick is held steady', () => {
    let s: KickState = { value: 0, velocity: 0 };
    for (let i = 0; i < 60; i++) s = step(s, 0);
    expect(s.value).toBe(0);
  });

  it('throws the airframe when the stick is slammed over', () => {
    let s: KickState = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 12; i++) { s = step(s, 0.25); peak = Math.max(peak, Math.abs(s.value)); }
    expect(peak).toBeGreaterThan(0.02); // more than a degree
  });

  it('settles back to level once the stick stops moving', () => {
    let s: KickState = { value: 0, velocity: 0 };
    for (let i = 0; i < 12; i++) s = step(s, 0.25);
    for (let i = 0; i < 240; i++) s = step(s, 0);
    expect(Math.abs(s.value)).toBeLessThan(0.002);
  });

  it('overshoots at least once instead of just sagging back', () => {
    let s: KickState = { value: 0, velocity: 0 };
    for (let i = 0; i < 6; i++) s = step(s, 0.4);
    let crossed = false;
    const sign = Math.sign(s.value);
    for (let i = 0; i < 180; i++) {
      s = step(s, 0);
      if (Math.sign(s.value) === -sign && Math.abs(s.value) > 0.001) crossed = true;
    }
    expect(crossed).toBe(true);
  });

  it('stays inside its ceiling even if the stick is slammed forever', () => {
    let s: KickState = { value: 0, velocity: 0 };
    for (let i = 0; i < 600; i++) s = step(s, 3);
    expect(Math.abs(s.value)).toBeLessThanOrEqual(0.16 + 1e-9);
  });
});
