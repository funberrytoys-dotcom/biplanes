import { describe, expect, it } from 'vitest';
import { resolveDeathScreenLayout } from './death-screen-layout.js';

describe('death screen layout', () => {
  it('keeps the restart panel inside a phone landscape viewport', () => {
    const layout = resolveDeathScreenLayout(932, 430);

    expect(layout.panelWidth).toBeLessThanOrEqual(932 - 28);
    expect(layout.panelHeight).toBeLessThanOrEqual(430 - 28);
    expect(layout.panelX).toBeGreaterThanOrEqual(14);
    expect(layout.panelY).toBeGreaterThanOrEqual(14);
    expect(layout.buttonY).toBeLessThan(layout.panelHeight - 28);
  });
});
