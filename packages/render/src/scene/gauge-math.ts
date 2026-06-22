/** Clamp a value into [0, 1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Normalize `value` across [min, max] into [0, 1], clamped. Degenerate range → 0. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/** Linear interpolation between a and b by t (t not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a 0..1 fraction (clamped) to a needle angle across `sweep` from `startAngle`. */
export function gaugeAngle(frac: number, startAngle: number, sweep: number): number {
  return startAngle + clamp01(frac) * sweep;
}

/** Move `current` toward `target` by `factor` (0..1). Frame-based easing. */
export function damp(current: number, target: number, factor: number): number {
  return current + (target - current) * clamp01(factor);
}

/** Angular damp toward `target` taking the shortest path around the circle (radians). */
export function dampAngle(current: number, target: number, factor: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return Number.isFinite(target) ? target : 0;
  // Modulo wrap (never a runaway while-loop, even on a huge delta).
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  else if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * clamp01(factor);
}

/** Round, clamp negatives to 0, and left-pad with zeros to `width` characters. */
export function padDigits(value: number, width: number): string {
  const n = Math.max(0, Math.round(value));
  return n.toString().padStart(width, '0');
}
