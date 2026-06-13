export interface HudChromeLayout {
  readonly compact: boolean;
  readonly dashboardScale: number;
  readonly readoutVisible: boolean;
  readonly readoutX: number;
  readonly readoutY: number;
  readonly readoutWidth: number;
  readonly readoutHeight: number;
  readonly readoutFontSize: number;
  readonly occupiedHeight: number;
}

const DASHBOARD_BASE_HEIGHT = 180;

export function getHudChromeLayout(width: number, height: number): HudChromeLayout {
  const compact = width < 960 || height < 520;
  const dashboardScale = compact ? 0.62 : 1;
  const readoutVisible = !compact;
  const readoutY = compact ? 118 : 186;
  const readoutHeight = compact ? 54 : 82;
  const dashboardHeight = DASHBOARD_BASE_HEIGHT * dashboardScale;

  return {
    compact,
    dashboardScale,
    readoutVisible,
    readoutX: compact ? 12 : 15,
    readoutY,
    readoutWidth: compact ? 250 : 335,
    readoutHeight,
    readoutFontSize: compact ? 10 : 12,
    occupiedHeight: readoutVisible
      ? Math.max(dashboardHeight, readoutY + readoutHeight)
      : dashboardHeight,
  };
}
