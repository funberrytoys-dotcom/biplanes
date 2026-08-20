/**
 * Picking a cell out of the baked pose grid.
 *
 * The 3D sheets are not an animation — every frame is a pose, roll crossed with
 * elevator. Nothing on the airframe moves by itself; the renderer says which
 * pose to show, which is what lets an aeroplane rock its wings and put the
 * elevator over at the same time.
 */

/** Which way the stick is held: back (nose up), centred, forward. */
export type Stick = -1 | 0 | 1;

/** Rad/s of pitch change that counts as the pilot pulling or pushing. */
export const STICK_ON = 0.75;
/** The lower rate it has to settle back under before the elevator centres. */
export const STICK_OFF = 0.35;
/** Seconds the elevator has to hold a position before it may change again. Even
 *  with a gap between the two thresholds, a pitch rate that hovers on one of them
 *  flips the elevator every few frames, which reads as a buzz rather than as
 *  flying. Nothing an aeroplane does needs the elevator to move faster than this. */
export const STICK_DWELL = 0.09;

/**
 * Sticky on purpose. Gravity and the stall physics keep the nose drifting a
 * little the whole time, so a bare sign test would flick the elevator back and
 * forth every other frame; the gap between the two thresholds holds it still.
 *
 * `pitchRate` is signed rad/s, positive the way stick-forward swings the nose,
 * whichever way round the aircraft happens to be.
 */
export function nextStick(current: Stick, pitchRate: number, airborne: boolean, heldFor = Infinity): Stick {
  if (!airborne) return 0;
  const want = pitchRate > STICK_ON ? 1
    : pitchRate < -STICK_ON ? -1
    : Math.abs(pitchRate) < STICK_OFF ? 0
    : current;
  if (want === current) return current;
  return heldFor < STICK_DWELL ? current : (want as Stick);
}

/**
 * The elevator column for a stick position. The bake lists its throws from
 * stick-back through centred to stick-forward, so the ends of the list are the
 * ends of the travel however many steps it holds.
 */
export function elevIndex(stick: Stick, elevCount: number): number {
  if (elevCount <= 1) return 0;
  if (stick < 0) return 0;
  if (stick > 0) return elevCount - 1;
  return Math.floor(elevCount / 2);
}

/** How far past the midpoint between two baked banks the aeroplane has to roll
 *  before it takes the next one, as a fraction of the gap between them. */
export const ROLL_STICKINESS = 0.35;

/** The roll row whose baked angle sits closest to the one asked for. */
export function rollIndex(rollDeg: number, steps: readonly number[]): number {
  if (steps.length === 0) return 0;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const gap = Math.abs((steps[i] ?? 0) - rollDeg);
    if (gap < bestGap) { bestGap = gap; best = i; }
  }
  return best;
}

/**
 * The roll row to show next, given the one showing now.
 *
 * Two rules, both there to stop the aeroplane buzzing. It moves ONE row at a
 * time, so a slammed stick walks the bank across instead of teleporting; and it
 * only crosses into the next row once the roll is past the halfway point by a
 * margin, so a roll that sits on a boundary stays put instead of flickering
 * between two poses every other frame.
 */
export function nextRollIndex(current: number, rollDeg: number, steps: readonly number[]): number {
  if (steps.length === 0) return 0;
  const cur = current < 0 ? 0 : current > steps.length - 1 ? steps.length - 1 : current;
  const want = rollIndex(rollDeg, steps);
  if (want === cur) return cur;
  const dir = want > cur ? 1 : -1;
  const next = cur + dir;
  const here = steps[cur] ?? 0;
  const there = steps[next] ?? 0;
  const gap = Math.abs(there - here);
  if (gap <= 0) return next;
  const midpoint = (here + there) / 2;
  const past = dir > 0 ? rollDeg - midpoint : midpoint - rollDeg;
  return past > gap * ROLL_STICKINESS ? next : cur;
}

/** Frame number in the sheet for a row and a column of the grid. */
export function poseFrame(roll: number, elev: number, elevCount: number): number {
  return roll * elevCount + elev;
}
