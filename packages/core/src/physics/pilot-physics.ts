import {
  GROUND_Y,
  RUNWAY_X,
  WORLD_WIDTH,
  PARACHUTE_FALL_SPEED,
  PARACHUTE_DRIFT_SPEED,
  PILOT_WALK_SPEED,
  PILOT_HANGAR_ARRIVAL_DIST,
} from '@biplanes/shared';
import type { Pilot } from '../entities/pilot.js';

export interface PilotInput {
  rotate: -1 | 0 | 1; // -1 = drift/walk left, +1 = drift/walk right
}

/**
 * Parachute descent. Gentle vertical fall; player input adds horizontal drift.
 * Transitions to 'walking' when pilot reaches the ground.
 */
export function stepPilotParachute(p: Pilot, input: PilotInput, dt: number): Pilot {
  const vy = PARACHUTE_FALL_SPEED;
  const vx = input.rotate * PARACHUTE_DRIFT_SPEED;

  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // World wrap on X to match plane physics
  if (px < 0) px += WORLD_WIDTH;
  if (px >= WORLD_WIDTH) px -= WORLD_WIDTH;

  // Ground contact → switch to walking
  if (py >= GROUND_Y) {
    py = GROUND_Y;
    // Face toward hangar by default on landing
    const facing: 1 | -1 = px > RUNWAY_X ? -1 : 1;
    return {
      ...p,
      position: { x: px, y: py },
      velocity: { x: 0, y: 0 },
      state: 'walking',
      facing,
    };
  }

  return {
    ...p,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
  };
}

/**
 * Walking on the ground. Heads toward the nearest player-side hangar (RUNWAY_X).
 * Player can override direction with input.rotate, but default is autonomous.
 * Transitions to 'safe' when reaching within PILOT_HANGAR_ARRIVAL_DIST of RUNWAY_X.
 */
export function stepPilotWalking(p: Pilot, input: PilotInput, dt: number): Pilot {
  // Direction: prefer player input if any, else auto-walk toward hangar
  let dir: 1 | -1;
  if (input.rotate !== 0) {
    dir = input.rotate === 1 ? 1 : -1;
  } else {
    dir = p.position.x > RUNWAY_X ? -1 : 1;
  }

  const px = p.position.x + dir * PILOT_WALK_SPEED * dt;
  const py = GROUND_Y;

  // Check arrival
  if (Math.abs(px - RUNWAY_X) < PILOT_HANGAR_ARRIVAL_DIST) {
    return {
      ...p,
      position: { x: px, y: py },
      velocity: { x: 0, y: 0 },
      state: 'safe',
      facing: dir,
    };
  }

  return {
    ...p,
    position: { x: px, y: py },
    velocity: { x: dir * PILOT_WALK_SPEED, y: 0 },
    facing: dir,
  };
}

/**
 * Dead pilot — lies on ground, ticks down deathTimer.
 * Caller is responsible for removing pilot when deathTimer ≤ 0.
 */
export function stepPilotDead(p: Pilot, dt: number): Pilot {
  return {
    ...p,
    velocity: { x: 0, y: 0 },
    position: { x: p.position.x, y: GROUND_Y },
    deathTimer: Math.max(0, p.deathTimer - dt),
  };
}
