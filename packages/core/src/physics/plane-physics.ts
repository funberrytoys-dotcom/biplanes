import {
  TICK_DT,
  G_MAX_LEVEL,
  G_MAX_DIVE,
  G_STALL,
  THRUST_ACCEL_MAX,
  PITCH_BLEED_MAX,
  STALL_SINK_MAX,
  PLANE_TURN_RATE,
  GROUND_Y,
  WORLD_WIDTH,
  DRAG_COEFFICIENT,
  type Vec2,
} from '@biplanes/shared';

export interface PlaneKinematic {
  // Public/derived fields (used by render/AI/weapon/collision)
  position: Vec2;
  velocity: Vec2;
  heading: number;       // radians, screen-standard (0 = pointing +x right, π/2 = down, -π/2 = up)
  throttleOn: boolean;

  // Source-of-truth fields (continuous BT-inspired model)
  g: number;             // scalar speed in px/sec
  facing: 1 | -1;        // 1 = right (positive x direction default), -1 = left
  throttle: boolean;
}

export interface PhysicsInput {
  rotate: -1 | 0 | 1;
}

export function isStalling(p: PlaneKinematic): boolean {
  return p.g < G_STALL;
}

export function stepPlane(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT
): PlaneKinematic {
  // 1) Continuous rotation
  // rotate=-1 → CCW (nose toward up when facing right)
  // rotate=+1 → CW (nose toward down when facing right)
  let heading = p.heading + input.rotate * PLANE_TURN_RATE * dt;

  // Normalize to [-π, π]
  while (heading > Math.PI) heading -= 2 * Math.PI;
  while (heading < -Math.PI) heading += 2 * Math.PI;

  // 2) Facing derived from heading — presentational flag for sprite mirroring.
  const facing: 1 | -1 = Math.abs(heading) <= Math.PI / 2 ? 1 : -1;

  // 3) Pitch components (screen-standard: vx = cos(h)*g, vy = sin(h)*g, y-down)
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  // 4) Throttle thrust — pitch-modulated: max at horizontal, zero at vertical.
  let g = p.g;
  if (p.throttle && g <= G_MAX_LEVEL) {
    const thrustFactor = Math.abs(cosH);
    g = Math.min(G_MAX_LEVEL, g + thrustFactor * THRUST_ACCEL_MAX * dt);
  }

  // 5) Pitch bleed/feed — continuous across all angles.
  // Climbing (sinH < 0, nose above horizon) bleeds speed.
  // Diving (sinH > 0, nose below horizon) feeds speed up to G_MAX_DIVE.
  const pitchEffect = -sinH * PITCH_BLEED_MAX * dt; // positive when climbing
  if (pitchEffect > 0) {
    g = Math.max(0, g - pitchEffect);
  } else {
    g = Math.min(G_MAX_DIVE, g - pitchEffect);
  }

  // 6) Constant drag
  g = Math.max(0, g - g * DRAG_COEFFICIENT * dt);

  // 7) Velocity from speed + heading
  let vx = cosH * g;
  let vy = sinH * g;

  // 8) Soft stall sink — gradual ramp instead of sharp cliff at G_STALL.
  // Below G_MAX_LEVEL, sink ramps from 0 to STALL_SINK_MAX as g drops to 0.
  if (g < G_MAX_LEVEL) {
    const sinkRatio = (G_MAX_LEVEL - g) / G_MAX_LEVEL; // 0 at full, 1 at zero
    const sinkPower = sinkRatio * sinkRatio; // softer curve early, steeper late
    vy += STALL_SINK_MAX * sinkPower;
  }

  // 9) Position update
  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // 10) World wrap on X
  if (px < 0) px += WORLD_WIDTH;
  if (px >= WORLD_WIDTH) px -= WORLD_WIDTH;

  // 11) Ground/ceiling
  if (py > GROUND_Y) {
    py = GROUND_Y;
    if (vy > 0) vy = 0;
  }
  if (py < 0) {
    py = 0;
    g = Math.max(0, g - 100); // bumped ceiling penalty
    vy = 0;
  }

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading,
    throttleOn: p.throttle,
    g,
    facing,
    throttle: p.throttle,
  };
}
