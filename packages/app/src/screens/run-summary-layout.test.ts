import { describe, it, expect } from 'vitest';
import { resolveRunSummaryLayout, RUN_SUMMARY_PANEL_W, RUN_SUMMARY_PANEL_H } from './run-summary-layout.js';

describe('resolveRunSummaryLayout', () => {
  it('centres the panel within the viewport', () => {
    const l = resolveRunSummaryLayout(1920, 1080);
    expect(l.panelX).toBeCloseTo((1920 - l.panelW) / 2);
    expect(l.panelY).toBeCloseTo((1080 - l.panelH) / 2);
  });

  it('never upscales beyond 1x on a large screen', () => {
    const l = resolveRunSummaryLayout(3000, 2000);
    expect(l.scale).toBe(1);
    expect(l.panelW).toBe(RUN_SUMMARY_PANEL_W);
    expect(l.panelH).toBe(RUN_SUMMARY_PANEL_H);
  });

  it('scales down to fit a small phone viewport', () => {
    const l = resolveRunSummaryLayout(640, 360);
    expect(l.scale).toBeLessThan(1);
    expect(l.panelW).toBeLessThanOrEqual(640 * 0.92 + 0.001);
    expect(l.panelH).toBeLessThanOrEqual(360 * 0.94 + 0.001);
  });
});
