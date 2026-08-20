/**
 * Render-only flight sway.
 *
 * The baked sprite sheets fly perfectly level, so a cruising aircraft read as if
 * it were running on rails. This adds a slow nose hunt and a lazy vertical float
 * on TOP of whatever the simulation says the plane is doing.
 *
 * Nothing here touches the core: the sim heading, the hitboxes and the replay are
 * untouched, so a recorded run still plays back bit-for-bit.
 */

/** Peak of the slow nose hunt, radians (~1.7°). */
const SLOW_AMP = 0.030;
/** Angular speed of the slow hunt — one cycle per ~3.1 s. */
const SLOW_W = 2.03;
/** Peak of the quicker ripple riding on top, radians (~0.7°). */
const FAST_AMP = 0.012;
/** One cycle per ~1.4 s. Deliberately not a whole multiple of SLOW_W, so the two
 *  never line up twice the same way and the motion never looks like a metronome. */
const FAST_W = 4.37;
/** Peak vertical float, px. */
const HEAVE_AMP = 2.4;
const HEAVE_W = 2.45;

/** How much of the sway a hard turn eats. Under real stick input the nose motion
 *  should read as the pilot's, not as weather. */
const TURN_DAMP = 0.6;
/** Turn rate (rad/s) at which the damping is fully in. */
const TURN_FULL = 2.2;
/** Extra sway when the airframe is wallowing near the stall. */
const WALLOW_GAIN = 0.9;
/** Extra sway in a storm. */
const TURBULENCE_GAIN = 1.2;
/** Ceiling on the combined multipliers, so a stalling plane in a blizzard rocks
 *  noticeably harder without flipping onto its back. */
const GAIN_CAP = 2.4;

export interface WobbleInput {
  /** Seconds this sprite has been alive. */
  time: number;
  /** Per-plane offset, radians — see wobblePhase. */
  phase: number;
  /** 0..1 envelope: 1 in level flight, faded to 0 on the ground and while dying. */
  envelope: number;
  /** Rad/s the simulation is already swinging the plane through. */
  turnRate: number;
  /** Current airspeed (kinematic.g). */
  speed: number;
  /** Speed below which the airframe starts to wallow (G_STALL). */
  stallSpeed: number;
  /** 0..1 weather gustiness. */
  turbulence: number;
}

export interface Wobble {
  /** Radians to ADD to the plane's heading before drawing. */
  rotation: number;
  /** Pixels to ADD to the plane's screen Y. */
  heave: number;
}

/**
 * A per-plane phase offset spread by the golden angle, so neighbouring ids land
 * far apart and a formation never rocks in lockstep.
 */
export function wobblePhase(id: number): number {
  return (Math.abs(id) * 2.399963229728653) % (Math.PI * 2);
}

export function flightWobble(i: WobbleInput): Wobble {
  const envelope = clamp01(i.envelope);
  if (envelope <= 0) return { rotation: 0, heave: 0 };

  const steady = 1 - clamp01(i.turnRate / TURN_FULL) * TURN_DAMP;
  const wallow =
    1 + (i.stallSpeed > 0 ? clamp01((i.stallSpeed - i.speed) / i.stallSpeed) : 0) * WALLOW_GAIN;
  const gust = 1 + clamp01(i.turbulence) * TURBULENCE_GAIN;
  const gain = envelope * Math.min(GAIN_CAP, steady * wallow * gust);

  const t = i.time;
  const rotation =
    (Math.sin(t * SLOW_W + i.phase) * SLOW_AMP +
      Math.sin(t * FAST_W + i.phase * 1.7 + 0.9) * FAST_AMP) *
    gain;
  const heave = Math.sin(t * HEAVE_W + i.phase * 0.6 + 2.1) * HEAVE_AMP * gain;

  return { rotation, heave };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
