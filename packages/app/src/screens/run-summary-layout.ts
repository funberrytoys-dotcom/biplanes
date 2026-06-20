export interface RunSummaryLayout {
  scale: number;
  panelX: number;
  panelY: number;
  panelW: number;
  panelH: number;
}

export const RUN_SUMMARY_PANEL_W = 660;
export const RUN_SUMMARY_PANEL_H = 540;

/** Centre the fixed-size panel and scale it to fit the viewport with margins. */
export function resolveRunSummaryLayout(width: number, height: number): RunSummaryLayout {
  const scale = Math.min(1, (width * 0.92) / RUN_SUMMARY_PANEL_W, (height * 0.94) / RUN_SUMMARY_PANEL_H);
  const panelW = RUN_SUMMARY_PANEL_W * scale;
  const panelH = RUN_SUMMARY_PANEL_H * scale;
  return {
    scale,
    panelW,
    panelH,
    panelX: (width - panelW) / 2,
    panelY: (height - panelH) / 2,
  };
}
