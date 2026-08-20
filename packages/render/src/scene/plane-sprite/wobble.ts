/**
 * Render-only flight motion.
 *
 * Two separate things live here, because they answer two different complaints.
 *
 * In straight flight the baked sheets sit perfectly level, so a cruising
 * aircraft read as if it were running on rails: `flightWobble` gives it a slow
 * nose hunt and a lazy vertical float, phase-shifted per aircraft.
 *
 * In a manoeuvre the aeroplane should feel like it has weight. `manoeuvreLean`
 * makes it dig into a sustained turn, and `advanceKick` is a little spring that
 * gets slapped whenever the stick moves hard — so slamming into a turn throws
 * the airframe past where the simulation has it, then lets it settle.
 *
 * Nothing here touches the core: the sim heading, the hitboxes and the replay
 * are untouched, so a recorded run still plays back bit-for-bit.
 */

/** Peak of the slow nose hunt, radians (~1.7°). */
const SLOW_AMP = 0.030;
/** Angular speed of the slow hunt — one cycle per ~3.1 s. */
const SLOW_W = 2.03;
/** Peak of the quicker ripple riding on top, radians (~0.7°). */
const FAST_AMP = 0.012;
/** One cycle per ~1.4 s. Deliberately not a whole multiple of SLOW_W, so the two
 *  never line up twice the same way and the motion never reads as a metronome. */
const FAST_W = 4.37;
/** Peak vertical float, px. */
const HEAVE_AMP = 2.4;
const HEAVE_W = 2.45;

/** How much of the idle sway a hard turn eats. Only a little: under stick the
 *  lean and the kick carry the motion, and the sway just rides along. */
const TURN_DAMP = 0.25;
/** Turn rate (rad/s) taken as "full deflection" throughout this file. */
export const TURN_FULL = 2.2;
/** Extra sway when the airframe is wallowing near the stall. */
const WALLOW_GAIN = 0.9;
/** Extra sway in a storm. */
const TURBULENCE_GAIN = 1.2;
/** Ceiling on the combined multipliers, so a stalling aeroplane in a blizzard
 *  rocks noticeably harder without flipping onto its back. */
const GAIN_CAP = 2.4;

/** How far the airframe leans into a fully deflected turn, radians (~4.6°). */
const LEAN_MAX = 0.08;

/** Spring stiffness of the manoeuvre kick — about 1.5 Hz. */
const KICK_STIFF = 90;
/** Its damping. Under-damped on purpose: one clear overshoot, then it settles. */
const KICK_DAMP = 9;
/** How hard a change of turn rate slaps the spring. */
const KICK_GAIN = 0.5;
/** Ceiling on the kick, radians (~9°). */
const KICK_MAX = 0.16;

export interface WobbleInput {
  /** Seconds this sprite has been alive. */
  time: number;
  /** Per-plane offset, radians — see wobblePhase. */
  phase: number;
  /** 0..1 envelope: 1 in level flight, faded to 0 on the ground and while dying. */
  envelope: number;
  /** Rad/s the simulation is already swinging the aeroplane through. */
  turnRate: number;
  /** Current airspeed (kinematic.g). */
  speed: number;
  /** Speed below which the airframe starts to wallow (G_STALL). */
  stallSpeed: number;
  /** 0..1 weather gustiness. */
  turbulence: number;
}

export interface Wobble {
  /** Radians to ADD to the aeroplane's heading before drawing. */
  rotation: number;
  /** Pixels to ADD to its screen Y. */
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

/**
 * The steady lean into a turn: the airframe rolls a little past the flight path
 * and holds there for as long as the stick is over. `signedTurnRate` is rad/s,
 * positive the way stick-forward swings the nose.
 */
export function manoeuvreLean(signedTurnRate: number, envelope = 1): number {
  const t = Math.max(-1, Math.min(1, signedTurnRate / TURN_FULL));
  return t * LEAN_MAX * clamp01(envelope);
}

export interface KickState {
  /** Current extra rotation, radians. */
  value: number;
  /** Its rate of change, rad/s. */
  velocity: number;
}

/**
 * A damped spring slapped by every CHANGE in turn rate. Holding a steady turn
 * does nothing (that is the lean's job); snapping the stick over throws the
 * airframe and then lets it settle back.
 */
export function advanceKick(state: KickState, turnRateDelta: number, dt: number): KickState {
  if (dt <= 0) return state;
  let velocity = state.velocity + turnRateDelta * KICK_GAIN;
  velocity += (-state.value * KICK_STIFF - velocity * KICK_DAMP) * dt;
  let value = state.value + velocity * dt;
  if (value > KICK_MAX) { value = KICK_MAX; velocity = Math.min(velocity, 0); }
  else if (value < -KICK_MAX) { value = -KICK_MAX; velocity = Math.max(velocity, 0); }
  return { value, velocity };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
