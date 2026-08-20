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

/**
 * Sticky on purpose. Gravity and the stall physics keep the nose drifting a
 * little the whole time, so a bare sign test would flick the elevator back and
 * forth every other frame; the gap between the two thresholds holds it still.
 *
 * `pitchRate` is signed rad/s, positive the way stick-forward swings the nose,
 * whichever way round the aircraft happens to be.
 */
export function nextStick(current: Stick, pitchRate: number, airborne: boolean): Stick {
  if (!airborne) return 0;
  if (pitchRate > STICK_ON) return 1;
  if (pitchRate < -STICK_ON) return -1;
  if (Math.abs(pitchRate) < STICK_OFF) return 0;
  return current;
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

/** Frame number in the sheet for a row and a column of the grid. */
export function poseFrame(roll: number, elev: number, elevCount: number): number {
  return roll * elevCount + elev;
}
