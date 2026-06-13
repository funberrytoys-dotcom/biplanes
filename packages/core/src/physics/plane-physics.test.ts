import { describe, it, expect } from 'vitest';
import { stepPlane, stepPlaneTaxi, isStalling, type PlaneKinematic } from './plane-physics.js';
import { TICK_DT, G_MAX_LEVEL, GROUND_Y, TAKEOFF_LIFTOFF_PITCH } from '@biplanes/shared';

function makePlane(overrides: Partial<PlaneKinematic> = {}): PlaneKinematic {
  return {
    position: { x: 1000, y: 500 },
    velocity: { x: 1200, y: 0 },
    heading: 0,
    throttleOn: true,
    g: 1200,
    facing: 1,
    throttle: true,
    throttleLevel: 1,
    ...overrides,
  };
}

describe('plane-physics (continuous model)', () => {
  it('plane facing right (heading=0) at cruise speed moves rightward', () => {
    const p = makePlane({ heading: 0, g: 1200, throttle: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.x).toBeGreaterThan(p.position.x);
    expect(Math.abs(after.position.y - p.position.y)).toBeLessThan(5);
  });

  it('rotate=-1 continuously tips nose up (heading goes negative when facing right)', () => {
    let p = makePlane({ heading: 0, g: 1200 });
    for (let i = 0; i < 30; i++) p = stepPlane(p, { rotate: -1 }, TICK_DT);
    expect(p.heading).toBeLessThan(0);
  });

  it('rotate=1 continuously tips nose down', () => {
    let p = makePlane({ heading: 0, g: 1200 });
    for (let i = 0; i < 30; i++) p = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(p.heading).toBeGreaterThan(0);
  });

  it('throttle adds speed when horizontal', () => {
    const p = makePlane({ heading: 0, g: G_MAX_LEVEL * 0.5, throttle: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.g).toBeGreaterThan(p.g);
  });

  it('boost raises the level-flight speed target by 30 percent', () => {
    const p = makePlane({ heading: 0, g: G_MAX_LEVEL * 1.08, throttleLevel: 1 });
    const normal = stepPlane(p, { rotate: 0 }, TICK_DT);
    const boosted = stepPlane(p, { rotate: 0, boost: true }, TICK_DT);

    expect(normal.g).toBeLessThan(p.g);
    expect(boosted.g).toBeGreaterThan(p.g);
  });

  it('climbing (heading near -π/2) bleeds speed over time', () => {
    let s = makePlane({ heading: -1.2, g: G_MAX_LEVEL, throttle: false });
    for (let i = 0; i < 30; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeLessThan(G_MAX_LEVEL);
  });

  it('diving (heading near +π/2) builds speed beyond level cap', () => {
    let s = makePlane({ heading: 1.2, g: G_MAX_LEVEL, throttle: false });
    for (let i = 0; i < 60; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeGreaterThan(G_MAX_LEVEL);
  });

  it('soft stall: very low speed creates downward sink even when nose horizontal', () => {
    let s = makePlane({ heading: 0, g: 100, throttle: false });
    const before = s.position.y;
    s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.position.y).toBeGreaterThan(before);
  });

  it('isStalling true when g < G_STALL', () => {
    expect(isStalling(makePlane({ g: 500 }))).toBe(true);
    expect(isStalling(makePlane({ g: 1200 }))).toBe(false);
  });

  it('plane clamps to ground', () => {
    const p = makePlane({ position: { x: 1000, y: GROUND_Y - 5 }, heading: 1.2, g: 1500 });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.y).toBeLessThanOrEqual(GROUND_Y);
  });

  it('determinism: same input produces same output', () => {
    const p = makePlane();
    const a = stepPlane(p, { rotate: 1 }, TICK_DT);
    const b = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(a).toEqual(b);
  });

  it('thrust pitch-modulated: vertical nose gives near-zero thrust', () => {
    const p = makePlane({ heading: -Math.PI / 2, g: 800, throttle: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.g).toBeLessThanOrEqual(p.g);
  });

  it('drag bleeds speed in level flight without throttle', () => {
    let s = makePlane({ heading: 0, g: 1200, throttle: false });
    for (let i = 0; i < 60; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeLessThan(1200);
  });

  it('facing flips to -1 when heading rotates past ±π/2', () => {
    const p = makePlane({ heading: Math.PI * 0.8, g: 1200 });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.facing).toBe(-1);
  });

  it('taxi pitch is capped to a mild takeoff angle when facing right', () => {
    let p = makePlane({ heading: 0, g: 450, facing: 1, throttleLevel: 1 });
    for (let i = 0; i < 60; i++) {
      p = stepPlaneTaxi(p, { rotate: -1 }, TICK_DT).kinematic;
    }
    expect(-p.heading).toBeLessThanOrEqual(TAKEOFF_LIFTOFF_PITCH + 0.081);
  });

  it('taxi pitch is capped to a mild takeoff angle when facing left', () => {
    let p = makePlane({ heading: Math.PI, g: 450, facing: -1, throttleLevel: 1 });
    for (let i = 0; i < 60; i++) {
      p = stepPlaneTaxi(p, { rotate: 1 }, TICK_DT).kinematic;
    }
    const pitchUp = Math.PI - Math.abs(p.heading);
    expect(pitchUp).toBeLessThanOrEqual(TAKEOFF_LIFTOFF_PITCH + 0.081);
  });
});
