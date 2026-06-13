import { describe, expect, it } from 'vitest';
import { getMissionUiLayout } from './mission-ui-layout.js';

describe('getMissionUiLayout', () => {
  it('keeps the mission objective above the radio lane on an iPhone-like landscape viewport', () => {
    const layout = getMissionUiLayout(932, 430);

    expect(layout.compact).toBe(true);
    expect(layout.objectiveY).toBeLessThan(layout.caravanGaugeY);
    expect(layout.radioY).toBeGreaterThan(layout.caravanGaugeY + 34);
    expect(layout.objectiveY).toBeLessThanOrEqual(48);
  });

  it('keeps the current roomy composition on desktop-sized screens', () => {
    const layout = getMissionUiLayout(1280, 720);

    expect(layout.compact).toBe(false);
    expect(layout.caravanGaugeY).toBe(88);
    expect(layout.objectiveY).toBe(118);
    expect(layout.radioY).toBe(116);
  });
});
