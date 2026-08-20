import { describe, it, expect } from 'vitest';
import { flightWobble, wobblePhase, type WobbleInput } from './wobble.js';

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
