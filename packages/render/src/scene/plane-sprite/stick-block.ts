/**
 * Which stretch of a 3D-baked sheet is playing.
 *
 * This is a looping dogfighter: the aeroplane turns by pitching, never by
 * banking, so a turn IS elevator work — and the elevator is the one surface a
 * strictly side-on camera can read. The sheet carries three blocks (level,
 * stick back, stick forward) and this picks between them.
 */
export type StickBlock = 'level' | 'up' | 'down';

/** Rad/s of pitch change that counts as the pilot pulling or pushing. */
export const STICK_ON = 0.75;
/** The lower rate it has to settle back under before the elevator centres. */
export const STICK_OFF = 0.35;

/**
 * Sticky on purpose. Gravity and the stall physics keep the nose drifting a
 * little the whole time, so a bare sign test would flick the elevator back and
 * forth every other frame; the gap between the two thresholds holds it still.
 *
 * `rate` is the signed pitch rate in rad/s. Positive swings the nose the way
 * stick-forward does, whichever way round the aircraft happens to be.
 */
export function nextStickBlock(current: StickBlock, rate: number, airborne: boolean): StickBlock {
  if (!airborne) return 'level';
  if (rate > STICK_ON) return 'down';
  if (rate < -STICK_ON) return 'up';
  if (Math.abs(rate) < STICK_OFF) return 'level';
  return current;
}
