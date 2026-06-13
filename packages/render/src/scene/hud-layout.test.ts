import { describe, expect, it } from 'vitest';
import { getHudChromeLayout } from './hud-layout.js';

describe('getHudChromeLayout', () => {
  it('keeps the permanent cockpit chrome compact on an iPhone-like landscape viewport', () => {
    const layout = getHudChromeLayout(932, 430);

    expect(layout.compact).toBe(true);
    expect(layout.dashboardScale).toBeLessThanOrEqual(0.62);
    expect(layout.readoutVisible).toBe(false);
    expect(layout.occupiedHeight).toBeLessThanOrEqual(128);
  });

  it('keeps the richer readout on roomy desktop-sized screens', () => {
    const layout = getHudChromeLayout(1280, 720);

    expect(layout.compact).toBe(false);
    expect(layout.dashboardScale).toBe(1);
    expect(layout.readoutVisible).toBe(true);
    expect(layout.readoutY).toBe(186);
  });
});
