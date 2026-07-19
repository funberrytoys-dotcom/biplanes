import { G_STALL, G_MAX_LEVEL } from '@biplanes/shared';

// Readability helpers for the ГАЗ (throttle) lever. Behaviour is unchanged — this only
// decides how the gauge is COLOURED and where the "stall line" marker sits, so a glance
// tells the player whether they have enough gas to keep flying.

export type ThrottleZone = 'hold' | 'careful' | 'stall';

/**
 * Lever fraction at which level-cruise target speed equals the stall speed. At/above this
 * line, steady level flight stays above stall (you HOLD altitude); below it the plane bleeds
 * under stall and starts sinking. Physics-derived, so it never lies about the energy model.
 */
export const THROTTLE_STALL_LINE_FRAC = Math.max(0, Math.min(1, G_STALL / G_MAX_LEVEL)); // ≈0.91

// Honest gauge: green "holds altitude" starts EXACTLY at the physics stall line (so the colour
// can't claim you hold altitude where you'd actually sink), amber is the manageable-sink band,
// red is sinking hard. (Was 0.66/0.33 — green started ~25 points below the real line.)
export const THROTTLE_HOLD_FRAC = THROTTLE_STALL_LINE_FRAC;
export const THROTTLE_CAREFUL_FRAC = 0.62;

// Legacy thresholds (kept for the ?gauge=legacy rollback so the owner can A/B the colours).
export const THROTTLE_HOLD_FRAC_LEGACY = 0.66;
export const THROTTLE_CAREFUL_FRAC_LEGACY = 0.33;

export const THROTTLE_ZONE_COLOR: Record<ThrottleZone, number> = {
  hold: 0x7cff8f, // green — holds altitude
  careful: 0xffd34a, // amber — careful
  stall: 0xff6a4a, // red — too low, stalling
};

export function resolveThrottleZone(
  value: number,
  holdFrac: number = THROTTLE_HOLD_FRAC,
  carefulFrac: number = THROTTLE_CAREFUL_FRAC,
): ThrottleZone {
  if (value >= holdFrac) return 'hold';
  if (value >= carefulFrac) return 'careful';
  return 'stall';
}
