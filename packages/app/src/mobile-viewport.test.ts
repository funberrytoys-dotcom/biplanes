import { describe, expect, it } from 'vitest';
import { fitMobileZoom, getMobileViewportInfo } from './mobile-viewport.js';

describe('mobile viewport', () => {
  it('detects an iPhone Pro Max-like landscape viewport and zooms combat in clearly', () => {
    const info = getMobileViewportInfo(932, 430);

    expect(info.isPhoneLike).toBe(true);
    expect(info.isLandscape).toBe(true);
    expect(info.combatZoom).toBeGreaterThanOrEqual(1.56);
    expect(info.combatZoom).toBeLessThanOrEqual(1.58);
    expect(fitMobileZoom(1.22, info)).toBe(info.combatZoom);
  });

  it('pushes combat slightly closer on very short landscape phone screens', () => {
    const proMax = getMobileViewportInfo(932, 430);
    const compact = getMobileViewportInfo(910, 332);

    expect(compact.combatZoom).toBeGreaterThan(proMax.combatZoom);
    expect(compact.combatZoom).toBeLessThanOrEqual(1.68);
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
