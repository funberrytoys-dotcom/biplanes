import { describe, it, expect } from 'vitest';
import {
  stepPilotParachute,
  stepPilotWalking,
  stepPilotDead,
} from './pilot-physics.js';
import type { Pilot } from '../entities/pilot.js';
import {
  GROUND_Y,
  RUNWAY_X,
  PARACHUTE_FALL_SPEED,
  PARACHUTE_DRIFT_SPEED,
  PILOT_WALK_SPEED,
  PILOT_HANGAR_ARRIVAL_DIST,
} from '@biplanes/shared';

function makePilot(x: number, y: number, state: Pilot['state'] = 'parachute'): Pilot {
  return {
    id: 99,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    state,
    facing: 1,
    hp: 1,
    deathTimer: 0,
  };
}

describe('pilot physics — parachute', () => {
  it('falls at PARACHUTE_FALL_SPEED with no input', () => {
    const p = makePilot(500, 200);
    const after = stepPilotParachute(p, { rotate: 0 }, 1);
    expect(after.position.y).toBeCloseTo(200 + PARACHUTE_FALL_SPEED);
    expect(after.position.x).toBe(500);
  });

  it('drifts right with rotate=+1', () => {
    const p = makePilot(500, 200);
    const after = stepPilotParachute(p, { rotate: 1 }, 1);
    expect(after.position.x).toBeCloseTo(500 + PARACHUTE_DRIFT_SPEED);
  });

  it('transitions to walking when reaching ground', () => {
    const p = makePilot(500, GROUND_Y - 1);
    const after = stepPilotParachute(p, { rotate: 0 }, 1);
    expect(after.state).toBe('walking');
    expect(after.position.y).toBe(GROUND_Y);
  });

  it('faces toward hangar on landing', () => {
    // Landing right of RUNWAY_X — should face left (toward hangar).
    const p = makePilot(RUNWAY_X + 500, GROUND_Y - 1);
    const after = stepPilotParachute(p, { rotate: 0 }, 1);
    expect(after.state).toBe('walking');
    expect(after.facing).toBe(-1);
  });
});

describe('pilot physics — walking', () => {
  it('walks toward hangar by default (no input)', () => {
    const p = makePilot(RUNWAY_X + 500, GROUND_Y, 'walking');
    const after = stepPilotWalking(p, { rotate: 0 }, 1);
    expect(after.position.x).toBeLessThan(p.position.x);
    expect(after.facing).toBe(-1);
  });

  it('respects player input override', () => {
    const p = makePilot(RUNWAY_X + 500, GROUND_Y, 'walking');
    const after = stepPilotWalking(p, { rotate: 1 }, 1);
    expect(after.position.x).toBeGreaterThan(p.position.x);
    expect(after.facing).toBe(1);
  });

  it('walks at PILOT_WALK_SPEED', () => {
    const p = makePilot(RUNWAY_X + 500, GROUND_Y, 'walking');
    const after = stepPilotWalking(p, { rotate: 0 }, 1);
    expect(Math.abs(p.position.x - after.position.x)).toBeCloseTo(PILOT_WALK_SPEED);
  });

  it('transitions to safe when reaching hangar', () => {
    const p = makePilot(RUNWAY_X + PILOT_HANGAR_ARRIVAL_DIST - 1, GROUND_Y, 'walking');
    const after = stepPilotWalking(p, { rotate: 0 }, 0.01);
    expect(after.state).toBe('safe');
  });
});

describe('pilot physics — dead', () => {
  it('ticks down deathTimer', () => {
    const p = { ...makePilot(500, GROUND_Y, 'dead'), deathTimer: 2.0 };
    const after = stepPilotDead(p, 0.5);
    expect(after.deathTimer).toBeCloseTo(1.5);
  });

  it('clamps deathTimer to 0', () => {
    const p = { ...makePilot(500, GROUND_Y, 'dead'), deathTimer: 0.1 };
    const after = stepPilotDead(p, 0.5);
    expect(after.deathTimer).toBe(0);
  });
});
