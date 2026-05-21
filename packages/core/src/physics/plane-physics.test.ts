import { describe, it, expect } from 'vitest';
import { stepPlane, isStalling, type PlaneKinematic } from './plane-physics.js';
import { TICK_DT, G_MAX_LEVEL, G_STALL, GROUND_Y } from '@biplanes/shared';

function makePlane(overrides: Partial<PlaneKinematic> = {}): PlaneKinematic {
  return {
    position: { x: 1000, y: 500 },
    velocity: { x: 1200, y: 0 },
    heading: 0, // screen-radians
    throttleOn: true,
    g: 1200,       // px/sec, near level cruise
    f: 0,          // facing forward (BT heading per facing)
    facing: 3,     // right
    turnCdSec: 0,
    throttle: true,
    rotateAccumulator: 0,
    ...overrides,
  };
}

describe('plane-physics (BT model)', () => {
  it('plane facing right at level cruise moves rightward', () => {
    const p = makePlane({ f: 0, facing: 3, g: 1200 });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.x).toBeGreaterThan(p.position.x);
    expect(Math.abs(after.position.y - p.position.y)).toBeLessThan(5); // roughly level
  });

  it('rotate input (with cooldown 0) advances frame by 1', () => {
    const p = makePlane({ f: 0, facing: 3, turnCdSec: 0 });
    const after = stepPlane(p, { rotate: -1 }, TICK_DT);
    // facing right, rotate=-1 => stepDir = +1 => f++ (toward up via f=4)
    expect(after.f).toBe(1);
    expect(after.turnCdSec).toBeGreaterThan(0);
  });

  it('rotate input ignored when cooldown > 0', () => {
    const p = makePlane({ f: 5, facing: 3, turnCdSec: 0.05 });
    const after = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(after.f).toBe(5);
  });

  it('throttle adds speed when pitch is horizontal', () => {
    const p = makePlane({ f: 0, facing: 3, g: 800, throttle: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.g).toBeGreaterThan(p.g);
  });

  it('climbing (f=4) bleeds speed over time', () => {
    let s = makePlane({ f: 4, facing: 3, g: G_MAX_LEVEL, throttle: false });
    for (let i = 0; i < 30; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeLessThan(G_MAX_LEVEL);
  });

  it('diving (f=12) builds speed beyond level max', () => {
    let s = makePlane({ f: 12, facing: 3, g: G_MAX_LEVEL, throttle: false });
    for (let i = 0; i < 60; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeGreaterThan(G_MAX_LEVEL);
  });

  it('stall: g < G_STALL pulls plane downward in position even when nose is up', () => {
    let s = makePlane({ f: 4, facing: 3, g: 100, throttle: false }); // nose-up but slow
    const before = s.position.y;
    s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.position.y).toBeGreaterThan(before); // y increased = moved down
  });

  it('isStalling true when g < G_STALL', () => {
    expect(isStalling(makePlane({ g: 500 }))).toBe(true);
    expect(isStalling(makePlane({ g: 1200 }))).toBe(false);
  });

  it('plane clamps to ground', () => {
    const p = makePlane({ position: { x: 1000, y: GROUND_Y - 5 }, f: 12, facing: 3, g: 1500 });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.y).toBeLessThanOrEqual(GROUND_Y);
  });

  it('determinism: same input produces same output', () => {
    const p = makePlane();
    const a = stepPlane(p, { rotate: 1 }, TICK_DT);
    const b = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(a).toEqual(b);
  });

  it('throttle pitch-modulated: vertical nose gives near-zero thrust', () => {
    const p = makePlane({ f: 4, facing: 3, g: 800, throttle: true }); // nose UP -> sin(0°)=0 -> no thrust
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    // g should NOT increase from thrust (it may decrease from bleed)
    expect(after.g).toBeLessThanOrEqual(p.g);
  });

  it('drag bleeds speed even in level flight without throttle', () => {
    let s = makePlane({ f: 0, facing: 3, g: 1200, throttle: false });
    for (let i = 0; i < 60; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeLessThan(1200);
  });

  it('pitch bleed applies even at near-horizontal angles like f=1', () => {
    let s = makePlane({ f: 1, facing: 3, g: 1200, throttle: false });
    for (let i = 0; i < 60; i++) s = stepPlane(s, { rotate: 0 }, TICK_DT);
    expect(s.g).toBeLessThan(1200); // was previously unchanged at f=1
  });
});
