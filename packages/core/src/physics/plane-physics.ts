import {
  TICK_DT,
  G_MAX_LEVEL,
  G_MAX_DIVE,
  G_STALL,
  THRUST_ACCEL_MAX,
  PITCH_BLEED_MAX,
  STALL_SINK_MAX,
  TURN_COOLDOWN_SEC,
  GROUND_Y,
  WORLD_WIDTH,
  DRAG_COEFFICIENT,
  type Vec2,
} from '@biplanes/shared';

export interface PlaneKinematic {
  // === Derived/maintained fields (downstream code reads these) ===
  position: Vec2;       // world px
  velocity: Vec2;       // px/sec (computed each tick from g + heading + stall)
  heading: number;      // radians, screen-standard (0 = pointing +x, π/2 = +y down)
  throttleOn: boolean;  // legacy alias — same as throttle

  // === Source-of-truth (BT model) ===
  g: number;            // scalar speed in px/sec (0..G_MAX_DIVE)
  f: number;            // heading index 0..15
  facing: 2 | 3;        // 2 = facing left, 3 = facing right
  turnCdSec: number;    // seconds until next rotation allowed
  throttle: boolean;    // true = throttle held, plane accelerates
  rotateAccumulator: number; // accumulates fractional rotation input over time, NOT used in MVP
}

export interface PhysicsInput {
  rotate: -1 | 0 | 1;
}

// BT convention: 0° = nose-up, 90° = nose-right, 180° = nose-down, 270° = nose-left.
const HEADINGS_BT_LEFT  = [270, 292, 315, 337,   0,  22,  45,  67,  90, 112, 135, 157, 180, 202, 225, 247];
const HEADINGS_BT_RIGHT = [ 90,  67,  45,  22,   0, 337, 315, 292, 270, 247, 225, 202, 180, 157, 135, 112];

function btHeadingDeg(facing: 2 | 3, f: number): number {
  const table = facing === 2 ? HEADINGS_BT_LEFT : HEADINGS_BT_RIGHT;
  return table[f] ?? 90;
}

// Convert BT-degree to screen-radian (0=right, CW positive, y-down)
// BT: 0=up, 90=right, 180=down, 270=left
// Us: 0=right, 90=down (screen), 180=left, 270=up
// map: us = bt - 90, then to radians
function btToScreenRadians(btDeg: number): number {
  return ((btDeg - 90) * Math.PI) / 180;
}

export function isStalling(p: PlaneKinematic): boolean {
  return p.g < G_STALL;
}

export function stepPlane(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT
): PlaneKinematic {
  // 1) Rotation (discrete, rate-limited)
  let f = p.f;
  const facing = p.facing;
  let turnCdSec = Math.max(0, p.turnCdSec - dt);

  if (input.rotate !== 0 && turnCdSec === 0) {
    // BT-style: pressing "left" (rotate=-1) always tips nose toward up first regardless of facing
    // facing=3 (right): rotate=-1 means f-- (toward up via f=4 going via 0->15->14...)
    //   wait actually re-check: with facing=3, rotate=-1 should pitch up
    //   stepDir formula: facing===2 ? +rotate : -rotate
    //   facing=3, rotate=-1 -> stepDir = +1 -> f goes 0->1->2->3->4 (toward up). Good.
    const stepDir = facing === 2 ? +input.rotate : -input.rotate;
    f = (f + stepDir + 16) % 16;
    turnCdSec = TURN_COOLDOWN_SEC;
  }

  // 2) Compute BT heading (degrees), then trig
  const btDeg = btHeadingDeg(facing, f);
  const h = (btDeg * Math.PI) / 180;
  const sinH = Math.sin(h);
  const cosH = Math.cos(h);

  // 3) Throttle (pitch-modulated thrust)
  let g = p.g;
  if (p.throttle && g <= G_MAX_LEVEL) {
    // Thrust grows by |sin(h)| * THRUST_ACCEL_MAX per second (so max accel at horizontal)
    g = Math.min(G_MAX_LEVEL, g + Math.abs(sinH) * THRUST_ACCEL_MAX * dt);
  }

  // 4) Pitch bleed/feed applies at ALL frames. cosH determines magnitude and direction.
  // Climbing (cosH > 0 when nose above horizon) bleeds speed.
  // Diving (cosH < 0) feeds speed up to G_MAX_DIVE.
  const pitchEffect = cosH * PITCH_BLEED_MAX * dt;
  if (pitchEffect > 0) {
    g = Math.max(0, g - pitchEffect);
  } else {
    g = Math.min(G_MAX_DIVE, g - pitchEffect);
  }

  // 4b) Mild constant drag — proportional to current speed. ~5% loss per second at cruise.
  g = Math.max(0, g - g * DRAG_COEFFICIENT * dt);

  // 5) Velocity from speed + heading (BT convention: vx = sin(h)*g, vy = -cos(h)*g)
  let vx = sinH * g;
  let vy = -cosH * g;

  // 6) Stall sink (independent of heading, adds downward to vy)
  if (g < G_STALL) {
    const sinkRatio = (G_STALL - g) / G_STALL;  // 0..1
    vy += STALL_SINK_MAX * sinkRatio;
  }

  // 7) Position update
  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // 8) World wrap on X
  if (px < 0) px += WORLD_WIDTH;
  if (px >= WORLD_WIDTH) px -= WORLD_WIDTH;

  // 9) Ground clamp
  if (py > GROUND_Y) {
    py = GROUND_Y;
    if (vy > 0) vy = 0;
  }
  // Ceiling penalty
  if (py < 0) {
    py = 0;
    g = Math.max(0, g - 10);
    vy = 0;
  }

  // 10) Compute screen-standard heading for downstream code
  const screenHeading = btToScreenRadians(btDeg);

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading: screenHeading,
    throttleOn: p.throttle,
    g,
    f,
    facing,
    turnCdSec,
    throttle: p.throttle,
    rotateAccumulator: 0,
  };
}
