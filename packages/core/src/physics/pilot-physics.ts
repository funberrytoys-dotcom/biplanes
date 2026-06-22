import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PARACHUTE_FALL_SPEED,
  PARACHUTE_DRIFT_SPEED,
  PILOT_WALK_SPEED,
  PILOT_HANGAR_ARRIVAL_DIST,
  PILOT_JUMP_VELOCITY,
  PILOT_GRAVITY,
  PILOT_JUMP_COOLDOWN,
  PLAYER_HANGAR_X,
} from '@biplanes/shared';
import type { Pilot, Faction } from '../entities/pilot.js';

export interface PilotInput {
  rotate: -1 | 0 | 1; // -1 = drift/walk left, +1 = drift/walk right, 0 = stand still
  jump?: boolean;     // only consumed in walking state, on ground, when cooldown ≤ 0
}

/** X-coordinate of the hangar where this faction's pilot is safe. */
export function ownHangarX(faction: Faction, worldWidth: number = WORLD_WIDTH): number {
  return faction === 'player' ? PLAYER_HANGAR_X : worldWidth - PLAYER_HANGAR_X;
}

function groundY(worldHeight: number = WORLD_HEIGHT): number {
  return worldHeight - 90;
}

/**
 * Parachute descent. Gentle vertical fall; input adds horizontal drift.
 * Transitions to 'walking' when pilot reaches the ground.
 */
export function stepPilotParachute(
  p: Pilot,
  input: PilotInput,
  dt: number,
  worldWidth: number = WORLD_WIDTH,
  worldHeight: number = WORLD_HEIGHT,
): Pilot {
  const ground = groundY(worldHeight);
  const vy = PARACHUTE_FALL_SPEED;
  const vx = input.rotate * PARACHUTE_DRIFT_SPEED;

  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // World wrap on X to match plane physics
  if (worldWidth > 0) px = ((px % worldWidth) + worldWidth) % worldWidth;

  // Ground contact → switch to walking
  if (py >= ground) {
    py = ground;
    const hangarX = ownHangarX(p.faction, worldWidth);
    const facing: 1 | -1 = px > hangarX ? -1 : 1;
    return {
      ...p,
      position: { x: px, y: py },
      velocity: { x: 0, y: 0 },
      state: 'walking',
      facing,
      groundedJumpCooldown: 0,
    };
  }

  return {
    ...p,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
  };
}

/**
 * Walking on the ground. Direction is PURELY driven by input.rotate:
 *   -1 → walk left, +1 → walk right, 0 → stand still.
 * No auto-walk. Optional jump (input.jump) gives a short hop while
 * gravity pulls back to GROUND_Y.
 * Transitions to 'safe' when within PILOT_HANGAR_ARRIVAL_DIST of own-faction hangar
 * (only valid when grounded — can't enter hangar mid-jump).
 */
export function stepPilotWalking(
  p: Pilot,
  input: PilotInput,
  dt: number,
  worldWidth: number = WORLD_WIDTH,
  worldHeight: number = WORLD_HEIGHT,
): Pilot {
  const ground = groundY(worldHeight);
  // Horizontal motion strictly from input.
  let vx = 0;
  let facing = p.facing;
  if (input.rotate === -1) {
    vx = -PILOT_WALK_SPEED;
    facing = -1;
  } else if (input.rotate === 1) {
    vx = PILOT_WALK_SPEED;
    facing = 1;
  }

  // Vertical: jump trigger + gravity.
  const grounded = p.position.y >= ground - 0.5;
  let vy = p.velocity.y;
  let jumpCd = Math.max(0, p.groundedJumpCooldown - dt);

  if (input.jump && grounded && jumpCd <= 0) {
    vy = -PILOT_JUMP_VELOCITY; // negative = upward in screen coords
    jumpCd = PILOT_JUMP_COOLDOWN;
  } else {
    // Apply gravity when above ground or already moving vertically
    if (!grounded || vy < 0) {
      vy += PILOT_GRAVITY * dt;
    } else {
      vy = 0;
    }
  }

  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  if (py >= ground) {
    py = ground;
    if (vy > 0) vy = 0;
  }

  // World wrap on X
  if (worldWidth > 0) px = ((px % worldWidth) + worldWidth) % worldWidth;

  // Arrival at own hangar — only when grounded.
  const hangarX = ownHangarX(p.faction, worldWidth);
  if (py >= ground - 0.5 && Math.abs(px - hangarX) < PILOT_HANGAR_ARRIVAL_DIST) {
    return {
      ...p,
      position: { x: px, y: py },
      velocity: { x: 0, y: 0 },
      state: 'safe',
      facing,
      groundedJumpCooldown: 0,
    };
  }

  return {
    ...p,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    facing,
    groundedJumpCooldown: jumpCd,
  };
}

/**
 * Dead pilot — lies on ground, ticks down deathTimer.
 * Caller is responsible for removing pilot when deathTimer ≤ 0.
 */
export function stepPilotDead(p: Pilot, dt: number, worldHeight: number = WORLD_HEIGHT): Pilot {
  return {
    ...p,
    velocity: { x: 0, y: 0 },
    position: { x: p.position.x, y: groundY(worldHeight) },
    deathTimer: Math.max(0, p.deathTimer - dt),
  };
}
