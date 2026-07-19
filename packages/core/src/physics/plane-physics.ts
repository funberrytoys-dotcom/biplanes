import {
  TICK_DT,
  G_MAX_LEVEL,
  G_MAX_DIVE,
  G_STALL,
  THRUST_ACCEL_MAX,
  PITCH_BLEED_MAX,
  STALL_SINK_MAX,
  PLANE_TURN_RATE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  DRAG_COEFFICIENT,
  TAKEOFF_ROLL_ACCEL,
  TAKEOFF_LIFTOFF_SPEED,
  TAKEOFF_LIFTOFF_PITCH,
  BOOST_SPEED_MULTIPLIER,
  type Vec2,
} from '@biplanes/shared';

export interface PlaneKinematic {
  // Public/derived fields (used by render/AI/weapon/collision)
  position: Vec2;
  velocity: Vec2;
  heading: number;       // radians, screen-standard (0 = pointing +x right, π/2 = down, -π/2 = up)
  throttleOn: boolean;   // legacy alias — true when throttleLevel > 0

  // Source-of-truth fields (continuous BT-inspired model)
  g: number;             // scalar speed in px/sec
  facing: 1 | -1;        // 1 = right (positive x direction default), -1 = left
  throttle: boolean;     // legacy alias — same as throttleOn
  throttleLevel: number; // 0..1 — fraction of max thrust currently applied
}

export interface PhysicsInput {
  rotate: -1 | 0 | 1;
  boost?: boolean;
  boostMultiplier?: number;
}

export function isStalling(p: PlaneKinematic): boolean {
  return p.g < G_STALL;
}

export function stepPlane(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT,
  worldWidth: number = WORLD_WIDTH,
  softFloor: boolean = false,
  worldHeight: number = WORLD_HEIGHT,
  speedMult: number = 1, // <1 = heavier airframe with a lower top speed (Алые Шакалы)
  turnRate: number = PLANE_TURN_RATE, // rad/sec at full deflection; injectable ONLY for tuning sims
): PlaneKinematic {
  const groundY = worldHeight - 90;
  // 1) Continuous rotation
  // rotate=-1 → CCW (nose toward up when facing right)
  // rotate=+1 → CW (nose toward down when facing right)
  let heading = p.heading + input.rotate * turnRate * dt;

  // Normalize to [-π, π]
  while (heading > Math.PI) heading -= 2 * Math.PI;
  while (heading < -Math.PI) heading += 2 * Math.PI;

  // 1b) CEILING FORCE — when too close to the top of the world, an aerodynamic force
  // overrides player input and tilts the nose downward into a dive. Player has to
  // first reach safer altitude before they regain full control.
  const CEILING_ZONE = 120;
  if (p.position.y < CEILING_ZONE) {
    const ceilingProximity = Math.max(0, Math.min(1, (CEILING_ZONE - p.position.y) / CEILING_ZONE)); // 0..1 (clamped like floorProximity)
    const diveTarget = Math.PI / 2; // nose-down in screen coords
    let diff = diveTarget - heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    // Force strength scales with proximity. At y=0, this dominates player input.
    const CEILING_FORCE_RATE = 6.0; // rad/sec at full proximity
    heading += diff * ceilingProximity * CEILING_FORCE_RATE * dt;
    while (heading > Math.PI) heading -= 2 * Math.PI;
    while (heading < -Math.PI) heading += 2 * Math.PI;
  }

  // 1c) FLOOR FORCE — symmetric to the ceiling, enabled only when softFloor is set
  // (campaign has no lethal ground). Near the bottom of the map an aerodynamic force
  // tilts the nose UP into a climb so the plane turns away instead of hitting ground.
  if (softFloor) {
    const FLOOR_ZONE = 120;
      const floorEdge = groundY - FLOOR_ZONE;
    if (p.position.y > floorEdge) {
      const floorProximity = Math.max(0, Math.min(1, (p.position.y - floorEdge) / FLOOR_ZONE)); // 0..1
      const climbTarget = -Math.PI / 2; // nose-up in screen coords
      let diff = climbTarget - heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const FLOOR_FORCE_RATE = 6.0; // rad/sec at full proximity (mirrors ceiling)
      heading += diff * floorProximity * FLOOR_FORCE_RATE * dt;
      while (heading > Math.PI) heading -= 2 * Math.PI;
      while (heading < -Math.PI) heading += 2 * Math.PI;
    }
  }

  // 2) Facing derived from heading — presentational flag for sprite mirroring.
  const facing: 1 | -1 = Math.abs(heading) <= Math.PI / 2 ? 1 : -1;

  // 3) Pitch components (screen-standard: vx = cos(h)*g, vy = sin(h)*g, y-down)
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  // 4) Throttle: defines target cruise speed (G_MAX_LEVEL × throttleLevel).
  // Below target -> engine accelerates (pitch-modulated, max thrust at horizontal).
  // Above target -> engine brakes at any speed (including dive). Brake fights gravity
  // and drag together, so in a steep dive with throttle 0 you'll still gain some speed
  // from pitch-feed but more slowly than at full throttle.
  let g = p.g;
  const throttleLevel = Math.max(0, Math.min(1, p.throttleLevel));
  // Defensive: keep the speed multipliers finite & non-negative. A NaN/Infinity
  // here is "sticky" (Math.min/max don't clear it) and would permanently corrupt
  // this deterministic run's position stream. No live trigger today — cheap insurance.
  const sm = Number.isFinite(speedMult) ? Math.max(0, speedMult) : 1;
  const rawBoostMult = input.boostMultiplier ?? 1;
  const boostMult = Number.isFinite(rawBoostMult) ? rawBoostMult : 1;
  const targetSpeed = G_MAX_LEVEL
    * throttleLevel
    * (input.boost ? BOOST_SPEED_MULTIPLIER * boostMult : 1)
    * sm;
  const thrustFactor = Math.abs(cosH); // 1 at horizontal, 0 at vertical
  if (g < targetSpeed) {
    // Accelerate toward target
    g = Math.min(targetSpeed, g + thrustFactor * THRUST_ACCEL_MAX * dt);
  } else if (g > targetSpeed) {
    // Engine brake — actively bleeds speed toward target, works at any speed.
    const ENGINE_BRAKE_RATE = 500; // px/sec² when throttling down
    g = Math.max(targetSpeed, g - ENGINE_BRAKE_RATE * dt);
  }

  // 5) Pitch bleed/feed — continuous across all angles.
  // Climbing (sinH < 0, nose above horizon) bleeds speed.
  // Diving (sinH > 0, nose below horizon) feeds speed up to G_MAX_DIVE.
  const pitchEffect = -sinH * PITCH_BLEED_MAX * dt; // positive when climbing
  if (pitchEffect > 0) {
    g = Math.max(0, g - pitchEffect);
  } else {
    g = Math.min(G_MAX_DIVE * sm, g - pitchEffect);
  }

  // 6) Constant drag
  g = Math.max(0, g - g * DRAG_COEFFICIENT * dt);

  // 7) Velocity from speed + heading
  let vx = cosH * g;
  let vy = sinH * g;

  // Apply boundary soft winds to vx if world is scrolling (worldWidth > 2000)
  if (worldWidth > 2000) {
    const curX = p.position.x;
    if (curX < 300) {
      const ratio = (300 - curX) / 300; // 0 at 300, 1 at 0
      vx += 1500 * ratio * dt; // strong wind blowing right
    } else if (curX > worldWidth - 300) {
      const ratio = (curX - (worldWidth - 300)) / 300; // 0 at bound-300, 1 at bound
      vx -= 1500 * ratio * dt; // strong wind blowing left
    }
  }

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

  // 10) World wrap on X — modulo so any displacement magnitude normalizes into
  // [0, worldWidth). A single `if` only corrects one width of overshoot, which the
  // boundary soft-wind + a high-speed dive could exceed on large scrolling worlds.
  if (worldWidth > 0) px = ((px % worldWidth) + worldWidth) % worldWidth;

  // 11) Ground/ceiling
  if (py > groundY) {
    py = groundY;
    if (vy > 0) vy = 0;
  }
  if (py < 0) {
    py = 0;
    g = Math.max(0, g - 50); // light impact penalty (most of the effect is the forced dive above)
    if (vy < 0) vy = 0;       // can't keep going up after hitting ceiling
  }

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading,
    throttleOn: throttleLevel > 0,
    g,
    facing,
    throttle: throttleLevel > 0,
    throttleLevel,
  };
}

/**
 * Ground-roll physics. Returns the new kinematic plus a flag indicating liftoff readiness.
 *
 * On the runway, the plane has automatic throttle, accelerates along its facing direction,
 * and the player can tilt the nose up to roughly TAKEOFF_LIFTOFF_PITCH radians.
 * Liftoff is signalled when speed is high enough AND the nose is tilted upward.
 *
 * The plane's facing (1 = right, -1 = left) determines roll direction. While taxiing,
 * heading is constrained to the upper hemisphere of the facing direction (no diving
 * into the dirt while still on the ground).
 */
export function stepPlaneTaxi(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT
): { kinematic: PlaneKinematic; readyForLiftoff: boolean } {
  const facing: 1 | -1 = p.facing;

  // Ground roll acceleration scaled by throttle (0 = stationary, 1 = full roll).
  // Also a small constant rolling friction: when throttle is off, the plane bleeds speed
  // to a stop rather than coasting forever along the runway.
  const throttle = Math.max(0, Math.min(1, p.throttleLevel));
  const accel = TAKEOFF_ROLL_ACCEL * throttle;
  const rollingFriction = 200; // px/sec² always pulling speed toward 0
  let g = p.g + accel * dt - rollingFriction * dt;
  if (g < 0) g = 0;
  g = Math.min(G_MAX_LEVEL, g);

  // Rotation — same input semantics as in flight (rotate=-1 tips nose up when facing right).
  let heading = p.heading + input.rotate * PLANE_TURN_RATE * dt;
  while (heading > Math.PI) heading -= 2 * Math.PI;
  while (heading < -Math.PI) heading += 2 * Math.PI;

  // Clamp heading: while on the ground the plane can only pitch up (toward the sky),
  // never below horizontal. Express this relative to facing.
  // Facing right (facing=1): horizontal heading is 0; pitch-up = negative heading.
  //   Allowed range: [-π/2 + 0.05, 0]   (cannot pitch past straight up, cannot pitch below horizon)
  // Facing left (facing=-1): horizontal heading is ±π; pitch-up means heading toward +π/2 side
  //   In normalized [-π,π] this is heading near ±π, but rotated so nose goes up.
  //   We work in "facing-relative" terms: a positive pitchUp means nose above horizon.
  //
  // For simplicity & symmetry, we only support facing=1 for taxi (player runway is on the left
  // and the player faces right; AI taxi starts facing left and we mirror by flipping heading).
  const maxRunwayPitchUp = TAKEOFF_LIFTOFF_PITCH + 0.08;
  if (facing === 1) {
    if (heading > 0) heading = 0;             // can't dip below horizon on the ground
    if (heading < -maxRunwayPitchUp) heading = -maxRunwayPitchUp;
  } else {
    // Facing left: horizontal heading is π (or -π). Pitch-up = heading in (π/2, π).
    // Normalize heading toward π for comparison.
    let h = heading;
    if (h < 0) h += 2 * Math.PI; // bring into [0, 2π)
    // Allowed: [π, 3π/2 - 0.05]  (horizon to just before straight up on the left side)
    if (h < Math.PI) h = Math.PI;
    if (h > Math.PI + maxRunwayPitchUp) h = Math.PI + maxRunwayPitchUp;
    heading = h > Math.PI ? h - 2 * Math.PI : h;
  }

  // Position rolls along the runway in the facing direction.
  const px = p.position.x + facing * g * dt;
  const py = p.position.y;
  const vx = facing * g;
  const vy = 0;

  // Liftoff condition: enough speed + enough nose-up tilt.
  // Pitch-up amount (in radians, positive when nose is above horizon):
  let pitchUp: number;
  if (facing === 1) {
    pitchUp = -heading;                       // heading negative when nose-up while facing right
  } else {
    // Facing left: horizontal heading = ±π. Nose-up means heading is in (π/2, π) or (-π, -π/2).
    pitchUp = Math.PI - Math.abs(heading);    // 0 at horizon, π/2 when pointing straight up
  }
  const readyForLiftoff = g >= TAKEOFF_LIFTOFF_SPEED && pitchUp >= TAKEOFF_LIFTOFF_PITCH;

  return {
    kinematic: {
      position: { x: px, y: py },
      velocity: { x: vx, y: vy },
      heading,
      throttleOn: true,
      g,
      facing,
      throttle: true,
      throttleLevel: p.throttleLevel, // preserve player/AI-controlled throttle
    },
    readyForLiftoff,
  };
}
