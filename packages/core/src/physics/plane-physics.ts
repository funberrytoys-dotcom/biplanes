import {
  TICK_DT,
  PLANE_THRUST,
  PLANE_GRAVITY,
  PLANE_TURN_RATE,
  PLANE_MAX_SPEED,
  PLANE_MIN_LIFT_SPEED,
  PLANE_STALL_ANGLE,
  GROUND_Y,
  WORLD_WIDTH,
  type Vec2,
} from '@biplanes/shared';
import { length, angleOf } from '../math/vec2.js';

export interface PlaneKinematic {
  position: Vec2;
  velocity: Vec2;
  heading: number;     // radians; 0 = pointing +x (right)
  throttleOn: boolean;
}

export interface PhysicsInput {
  rotate: -1 | 0 | 1;
}

/**
 * Returns true if the plane's nose points significantly away from its velocity
 * vector AND the plane is moving slowly enough that lift collapses.
 *
 * This is the core BT-Biplanes feel: nose-up + slow = drop like a rock.
 */
export function isStalling(p: PlaneKinematic): boolean {
  const speed = length(p.velocity);
  if (speed >= PLANE_MIN_LIFT_SPEED * 1.5) return false;

  // If barely moving, "stalling" depends on heading vs gravity direction.
  if (speed < 5) {
    // Pointing roughly upward (heading is negative angle in screen coords)
    return p.heading < -0.3 && p.heading > -Math.PI + 0.3;
  }

  const velAngle = angleOf(p.velocity);
  let diff = p.heading - velAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  // Stall if nose is more than STALL_ANGLE above velocity vector (i.e. trying to climb steeply while slow)
  // In screen coords "up" is negative y, so nose above velocity = heading more negative
  return diff < -PLANE_STALL_ANGLE || diff > Math.PI - PLANE_STALL_ANGLE;
}

export function stepPlane(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT
): PlaneKinematic {
  // 1) Update heading from rotation input
  const heading = p.heading + input.rotate * PLANE_TURN_RATE * dt;

  // 2) Compute thrust acceleration (in heading direction)
  const stalling = isStalling(p);
  const effectiveThrust = stalling ? PLANE_THRUST * 0.2 : (p.throttleOn ? PLANE_THRUST : 0);

  let ax = Math.cos(heading) * effectiveThrust;
  let ay = Math.sin(heading) * effectiveThrust;

  // 3) Gravity
  ay += PLANE_GRAVITY;

  // 4) Velocity update
  let vx = p.velocity.x + ax * dt;
  let vy = p.velocity.y + ay * dt;

  // 5) Speed cap
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > PLANE_MAX_SPEED) {
    vx = (vx / speed) * PLANE_MAX_SPEED;
    vy = (vy / speed) * PLANE_MAX_SPEED;
  }

  // 6) Position update
  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // 7) World bounds (wrap on x, clamp on y to ground)
  if (px < 0) px += WORLD_WIDTH;
  if (px >= WORLD_WIDTH) px -= WORLD_WIDTH;
  if (py > GROUND_Y) {
    py = GROUND_Y;
    vy = Math.min(vy, 0);
  }

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading,
    throttleOn: p.throttleOn,
  };
}
