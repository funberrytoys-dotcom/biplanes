// Pre-stall warning for the HUD. The point (per the brief) is to warn the player BEFORE
// the plane is sinking hard — "while speed is dropping" — not only once it has stalled.
//
// We base this on actual airspeed + trend, NOT on the raw isStalling() boolean. isStalling
// flips true at a fairly high speed (G_STALL) where the sink is still negligible, so warning
// there would nag during normal cruise. Real, felt sink only sets in well below that — so we
// warn on the approach (amber) and shout once it's genuinely dangerous (red).

export type StallWarning = 'none' | 'near' | 'stall';

/** Speed below which the plane is sinking enough to matter — the loud "СРЫВ" warning. */
export const STALL_HARD_SPEED = 470;
/** Speed at which we start the early amber heads-up (only while still decelerating). */
export const STALL_WARN_SPEED = 560;

export const STALL_WARNING_TEXT: Record<Exclude<StallWarning, 'none'>, string> = {
  near: 'СКОРОСТЬ ПАДАЕТ — ПИКИРУЙ',
  stall: 'СРЫВ — ПИКИРУЙ И ВЕРНИ СКОРОСТЬ',
};

/**
 * @param g     current airspeed (px/sec)
 * @param prevG airspeed last frame — used to detect "still dropping" so the amber warning
 *              shows on the way DOWN but not while the player is already recovering.
 */
export function resolveStallWarning(g: number, prevG: number): StallWarning {
  if (g < STALL_HARD_SPEED) return 'stall';
  if (g < STALL_WARN_SPEED && g <= prevG) return 'near';
  return 'none';
}
