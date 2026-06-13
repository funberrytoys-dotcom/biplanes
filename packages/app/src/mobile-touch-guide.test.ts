import { describe, expect, it } from 'vitest';
import { shouldShowTouchGuide } from './mobile-touch-guide.js';

describe('shouldShowTouchGuide', () => {
  it('shows controls on iPhone Pro Max-like landscape widths during verification', () => {
    expect(shouldShowTouchGuide({ width: 932, maxTouchPoints: 0 })).toBe(true);
  });

  it('keeps controls visible on real touch devices regardless of width', () => {
    expect(shouldShowTouchGuide({ width: 1200, maxTouchPoints: 5 })).toBe(true);
  });

  it('does not show touch controls on wide desktop verification', () => {
    expect(shouldShowTouchGuide({ width: 1280, maxTouchPoints: 0 })).toBe(false);
  });
});
