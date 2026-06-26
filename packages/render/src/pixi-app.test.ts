import { describe, expect, it } from 'vitest';
import { resolveRenderResolution } from './pixi-app.js';

describe('resolveRenderResolution', () => {
  it('keeps high-DPR phones crisp instead of dropping them to a visibly pixelated 1.5x', () => {
    expect(resolveRenderResolution(3, true)).toBeGreaterThanOrEqual(2.5);
  });

  it('keeps desktop capped at 3x', () => {
    expect(resolveRenderResolution(4, false)).toBe(3);
  });
});
