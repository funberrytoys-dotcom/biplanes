export interface DeathScreenLayout {
  panelWidth: number;
  panelHeight: number;
  panelX: number;
  panelY: number;
  scale: number;
  buttonY: number;
}

export function resolveDeathScreenLayout(width: number, height: number): DeathScreenLayout {
  const baseW = 600;
  const baseH = 500;
  const safe = Math.max(14, Math.min(28, Math.min(width, height) * 0.045));
  const scale = Math.min(1, (width - safe * 2) / baseW, (height - safe * 2) / baseH);
  const panelWidth = baseW * scale;
  const panelHeight = baseH * scale;

  return {
    panelWidth,
    panelHeight,
    panelX: (width - panelWidth) / 2,
    panelY: (height - panelHeight) / 2,
    scale,
    buttonY: 425 * scale,
  };
}
