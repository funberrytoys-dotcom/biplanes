import { describe, expect, it } from 'vitest';
import { fitMobileZoom, getMobileViewportInfo } from './mobile-viewport.js';

describe('mobile viewport', () => {
  it('detects an iPhone Pro Max-like landscape viewport and zooms combat out', () => {
    const info = getMobileViewportInfo(932, 430);

    expect(info.isPhoneLike).toBe(true);
    expect(info.isLandscape).toBe(true);
    expect(info.combatZoom).toBeLessThan(1);
    expect(fitMobileZoom(1.08, info)).toBe(info.combatZoom);
  });

  it('detects portrait phone view so the shell can block gameplay visually', () => {
    const info = getMobileViewportInfo(430, 932);

    expect(info.isPhoneLike).toBe(true);
    expect(info.isLandscape).toBe(false);
    expect(fitMobileZoom(1.08, info)).toBe(1.08);
  });

  it('keeps desktop zoom unchanged', () => {
    const info = getMobileViewportInfo(1440, 900);

    expect(info.isPhoneLike).toBe(false);
    expect(fitMobileZoom(1.08, info)).toBe(1.08);
  });
});
