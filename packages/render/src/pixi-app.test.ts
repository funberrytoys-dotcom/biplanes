import { describe, expect, it } from 'vitest';
import { resolveRenderResolution } from './pixi-app.js';

describe('resolveRenderResolution', () => {
  // 2026-07-20: phones cap at 2× (was 2.5×) — owner's phones ran HOT and drained
  // battery; at arm's length 2× is visually equivalent while pushing ~36% fewer
  // pixels. Still comfortably above the visibly pixelated 1.5×.
  it('caps phones at 2x — cool and crisp enough, never a pixelated 1.5x', () => {
    expect(resolveRenderResolution(3, true)).toBe(2);
    expect(resolveRenderResolution(1.5, true)).toBe(1.5);
  });

  it('keeps desktop capped at 3x', () => {
    expect(resolveRenderResolution(4, false)).toBe(3);
  });
});
