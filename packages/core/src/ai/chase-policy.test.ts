import { describe, it, expect } from 'vitest';
import { chasePolicy } from './chase-policy.js';
import type { Plane } from '../entities/plane.js';

function makePlane(x: number, y: number, heading: number): Plane {
  return {
    id: 1,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: 200, y: 0 },
      heading,
      throttleOn: true,
      g: 1200, facing: 1, throttle: true,
    },
    hp: 30,
    maxHp: 30,
    weaponCooldown: 0,
    alive: true,
  };
}

describe('chase policy', () => {
  it('turns toward target when target is above', () => {
    const enemy = makePlane(500, 500, 0); // pointing right
    const target = makePlane(500, 400, 0); // above
    const cmd = chasePolicy(enemy, target);
    // In screen coords "up" is -y, so we need to rotate CCW (negative)
    expect(cmd.rotate).toBe(-1);
  });

  it('turns toward target when target is below', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(500, 600, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(1);
  });

  it('does not turn when target is directly ahead', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(900, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(0);
  });

  it('fires when target is roughly in front and close', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(700, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(true);
  });

  it('does not fire when target is behind', () => {
    const enemy = makePlane(500, 500, 0); // facing right
    const target = makePlane(200, 500, 0); // behind
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });

  it('does not fire when target is too far', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(2500, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });
});
