/**
 * How fast the propeller turns, and which frame of its sheet to show.
 *
 * The propeller is baked onto its own little sheet — crisp blade steps first,
 * then a few progressively smeared frames — so it can start slow enough to
 * count the blades and wind up into a translucent disc as the throttle comes in.
 * Seen from the side that disc is edge-on, so the fast frames read as a narrow
 * standing lens rather than a circle; that is what a real propeller looks like
 * from abeam.
 */

/** Revs per second with the engine idling. */
export const IDLE_REV = 2.2;
/** Revs per second at full gas. */
export const FULL_REV = 28;
/** Below this the individual blades still read, so a crisp step is shown. */
export const CRISP_BELOW = 4.5;
/** Above this the propeller is a solid smear — the last blur frame. */
export const BLUR_FULL = 17;
/** Revs either side of CRISP_BELOW that the propeller has to cross before it
 *  swaps between crisp blades and a smear. Without it a throttle sitting on the
 *  line makes the propeller strobe. */
const CRISP_HYSTERESIS = 0.8;
/** How fast a shut-down propeller winds down, per second. */
const WINDDOWN = 0.28;

/** A blade pair repeats every half turn, so the crisp steps cover π, not 2π. */
const HALF_TURN = Math.PI;

export function propRevsPerSecond(engineOn: boolean, throttle: number): number {
  if (!engineOn) return 0;
  const t = throttle < 0 ? 0 : throttle > 1 ? 1 : throttle;
  return IDLE_REV + (FULL_REV - IDLE_REV) * t;
}

/** Eases the current rate towards the target so the propeller spools up and
 *  winds down instead of snapping between speeds. */
export function easePropRev(current: number, target: number, dt: number): number {
  // Winding down is slow (the propeller freewheels); spooling up is brisk.
  const rate = target > current ? 4.5 : WINDDOWN * 6;
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

export function nextPropPhase(phase: number, rev: number, dt: number): number {
  const next = (phase + rev * 2 * Math.PI * dt) % HALF_TURN;
  return next < 0 ? next + HALF_TURN : next;
}

/**
 * Frame index into the propeller sheet. The first `steps` frames are crisp
 * blades across a half turn; the `blurCount` after them are the fast smears,
 * from softest to strongest.
 *
 * `current` is the frame showing now. It is used only to keep the propeller from
 * strobing: crossing between blades and smear needs a margin, and the smear
 * moves one level at a time.
 */
export function propFrameIndex(rev: number, phase: number, steps: number, blurCount: number,
                               current = -1): number {
  const crisp = () => {
    const i = Math.floor((phase / HALF_TURN) * steps) % steps;
    return i < 0 ? i + steps : i;
  };
  if (blurCount <= 0) return crisp();

  const t = Math.min(1, Math.max(0, (rev - CRISP_BELOW) / (BLUR_FULL - CRISP_BELOW)));
  const want = Math.min(blurCount - 1, Math.floor(t * blurCount));

  // No frame showing yet — answer straight, with no history to be sticky about.
  if (current < 0) return rev < CRISP_BELOW ? crisp() : steps + want;

  const crispNow = current < steps;
  const line = CRISP_BELOW + (crispNow ? CRISP_HYSTERESIS : -CRISP_HYSTERESIS);
  if (rev < line) return crisp();
  if (crispNow) return steps;                       // enter on the softest smear

  const level = current - steps;
  const next = want > level ? level + 1 : want < level ? level - 1 : level;
  return steps + Math.min(blurCount - 1, Math.max(0, next));
}
