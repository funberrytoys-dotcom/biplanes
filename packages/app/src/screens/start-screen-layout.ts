export interface StartScreenLayout {
  readonly panelX: number;
  readonly panelY: number;
  readonly panelScale: number;
  readonly buttonX: number;
  readonly buttonStartY: number;
  readonly buttonGap: number;
  readonly statusX: number;
  readonly statusY: number;
  readonly statusWidth: number;
  readonly statusHeight: number;
  readonly statusWordWrapWidth: number;
}

export function getStartScreenLayout(width: number, height: number, buttonCount: number): StartScreenLayout {
  const compact = height < 520 || width < 960;
  const panelX = compact ? Math.max(22, Math.min(width * 0.045, 44)) : Math.max(44, Math.min(width * 0.08, 120));
  const panelY = compact ? Math.max(18, height * 0.06) : Math.max(48, height * 0.12);
  const buttonX = 187;
  const buttonStartY = compact ? 172 : 190;
  const buttonGap = compact ? 58 : 68;
  const buttonHalfHeight = 27;

  const requiredPanelHeight = buttonStartY + Math.max(0, buttonCount - 1) * buttonGap + buttonHalfHeight;
  // The min clamp must stay LOW enough that the whole column always fits: at the
  // old 0.72 floor a 7-button menu overflowed a 360px-tall phone screen (owner:
  // «меню не влезает полностью в экран телефона»).
  const panelScale = compact ? Math.max(0.5, Math.min(0.82, (height - panelY - 10) / requiredPanelHeight)) : 1;

  const buttonRight = panelX + panelScale * (buttonX + 180);
  const statusHeight = compact ? 72 : 84;
  const statusWidth = compact ? Math.min(430, Math.max(360, width - buttonRight - 48)) : 560;
  const statusX = compact
    ? Math.max(buttonRight + 20, width - statusWidth - 30)
    : Math.max(32, Math.min(width - 592, panelX));
  const statusY = compact ? height - statusHeight - 14 : height - 122;

  return {
    panelX,
    panelY,
    panelScale,
    buttonX,
    buttonStartY,
    buttonGap,
    statusX,
    statusY,
    statusWidth,
    statusHeight,
    statusWordWrapWidth: statusWidth - 40,
  };
}
