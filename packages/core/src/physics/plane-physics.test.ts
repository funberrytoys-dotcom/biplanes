import { describe, it, expect } from 'vitest';
import { stepPlane, isStalling, type PlaneKinematic } from './plane-physics.js';
import { TICK_DT, PLANE_GRAVITY, GROUND_Y } from '@biplanes/shared';

function makePlane(overrides: Partial<PlaneKinematic> = {}): PlaneKinematic {
  return {
    position: { x: 1000, y: 500 },
    velocity: { x: 200, y: 0 },
    heading: 0,
    throttleOn: true,
    ...overrides,
  };
}

describe('plane-physics', () => {
  it('gravity pulls plane down when no thrust and level', () => {
    const p = makePlane({ velocity: { x: 0, y: 0 }, throttleOn: false });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.velocity.y).toBeGreaterThan(0);
    expect(after.velocity.y).toBeCloseTo(PLANE_GRAVITY * TICK_DT, 2);
  });

  it('thrust accelerates plane in heading direction', () => {
    const p = makePlane({ velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.velocity.x).toBeGreaterThan(0);
  });

  it('rotate input changes heading', () => {
    const p = makePlane({ heading: 0 });
    const ccw = stepPlane(p, { rotate: -1 }, TICK_DT);
    const cw = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(ccw.heading).toBeLessThan(0);
    expect(cw.heading).toBeGreaterThan(0);
  });

  it('position advances by velocity', () => {
    const p = makePlane({ velocity: { x: 100, y: 50 }, throttleOn: false });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.x).toBeCloseTo(1000 + 100 * TICK_DT, 1);
    // y is affected by gravity too, so just check positive
    expect(after.position.y).toBeGreaterThan(500);
  });

  it('isStalling returns true when nose far above velocity vector AND slow', () => {
    const p = makePlane({
      heading: -Math.PI / 2 + 0.05, // pointing nearly straight up
      velocity: { x: 30, y: -20 },  // slow climb
    });
    expect(isStalling(p)).toBe(true);
  });

  it('isStalling returns false when fast and aligned', () => {
    const p = makePlane({
      heading: 0,
      velocity: { x: 400, y: 0 },
    });
    expect(isStalling(p)).toBe(false);
  });

  it('during stall, gravity dominates even with throttle', () => {
    // Plane pointing straight up but barely moving — should fall.
    const p = makePlane({
      heading: -Math.PI / 2,
      velocity: { x: 0, y: -10 },
      throttleOn: true,
    });
    // Simulate one second
    let s = p;
    for (let i = 0; i < 60; i++) {
      s = stepPlane(s, { rotate: 0 }, TICK_DT);
    }
    expect(s.velocity.y).toBeGreaterThan(50); // falling, not climbing
  });

  it('plane never goes below ground', () => {
    const p = makePlane({
      position: { x: 1000, y: GROUND_Y - 5 },
      velocity: { x: 0, y: 500 },
      throttleOn: false,
    });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.y).toBeLessThanOrEqual(GROUND_Y);
  });

  it('determinism: same input produces same output', () => {
    const p = makePlane();
    const a = stepPlane(p, { rotate: 1 }, TICK_DT);
    const b = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(a).toEqual(b);
  });
});
