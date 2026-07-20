import { describe, expect, it } from 'vitest';
import { getStartScreenLayout } from './start-screen-layout.js';

describe('getStartScreenLayout', () => {
  it('keeps every menu button inside an iPhone Pro Max-like landscape viewport', () => {
    const layout = getStartScreenLayout(932, 430, 6);

    const buttonHalfHeight = 27 * layout.panelScale;
    const lastButtonY = layout.panelY + layout.panelScale * (layout.buttonStartY + 5 * layout.buttonGap);

    expect(lastButtonY + buttonHalfHeight).toBeLessThanOrEqual(430 - 8);
  });

  it('fits a 7-button menu on a short 740×360 phone screen', () => {
    const layout = getStartScreenLayout(740, 360, 7);

    const buttonHalfHeight = 27 * layout.panelScale;
    const lastButtonY = layout.panelY + layout.panelScale * (layout.buttonStartY + 6 * layout.buttonGap);

    expect(lastButtonY + buttonHalfHeight).toBeLessThanOrEqual(360 - 8);
  });

  it('places compact status copy away from the button column', () => {
    const layout = getStartScreenLayout(932, 430, 6);
    const buttonRight = layout.panelX + layout.panelScale * (layout.buttonX + 180);

    expect(layout.statusX).toBeGreaterThan(buttonRight + 16);
    expect(layout.statusY + layout.statusHeight).toBeLessThanOrEqual(430 - 12);
  });

  it('uses the roomy composition on desktop-sized landscape screens', () => {
    const layout = getStartScreenLayout(1280, 720, 6);

    expect(layout.panelScale).toBe(1);
    expect(layout.buttonGap).toBe(68);
    expect(layout.statusWidth).toBe(560);
  });
});
