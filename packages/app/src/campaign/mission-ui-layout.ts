export interface MissionUiLayout {
  readonly compact: boolean;
  readonly caravanGaugeX: number;
  readonly caravanGaugeY: number;
  readonly objectiveX: number;
  readonly objectiveY: number;
  readonly objectiveFontSize: number;
  readonly radioX: number;
  readonly radioY: number;
  readonly radioWidth: number;
}

export function getMissionUiLayout(width: number, height: number): MissionUiLayout {
  const compact = width < 960 || height < 520;
  const radioWidth = Math.min(compact ? 390 : 520, width - 42);
  const caravanGaugeY = compact ? 78 : 88;

  return {
    compact,
    caravanGaugeX: (width - 220) / 2,
    caravanGaugeY,
    objectiveX: width / 2,
    objectiveY: compact ? 34 : 118,
    objectiveFontSize: compact ? 16 : 18,
    radioX: Math.max(20, width - radioWidth - 28),
    radioY: compact ? caravanGaugeY + 48 : 116,
    radioWidth,
  };
}
