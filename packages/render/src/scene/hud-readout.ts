export type HudStatus = 'stable' | 'stall' | 'overheat' | 'caravan-critical' | 'inverted';

export interface HudReadoutInput {
  mode: 'escort' | 'arena';
  level: number;
  timeSec: number;
  enemyAlive: number;
  playerScore: number;
  enemyScore: number;
  caravanHpPct?: number;
  progressPct?: number;
  altitudeFt: number;
  weaponTags: string[];
  boostActive: boolean;
  boostHeatPct: number;
  status: HudStatus;
}

function clock(timeSec: number): string {
  const total = Math.max(0, Math.floor(timeSec));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function statusLabel(status: HudStatus): string {
  if (status === 'stall') return 'СВАЛИВАНИЕ';
  if (status === 'overheat') return 'ПЕРЕГРЕВ';
  if (status === 'caravan-critical') return 'КАРАВАН ПОД ОГНЕМ';
  if (status === 'inverted') return 'ВВЕРХ НОГАМИ';
  return 'НОРМА';
}

export function formatHudReadout(input: HudReadoutInput): string {
  const level = String(input.level).padStart(2, '0');
  const weapons = input.weaponTags.length > 0 ? input.weaponTags.join(' / ') : 'MG';
  const boost = input.boostActive ? `ФОРСАЖ ${input.boostHeatPct}%` : `НАГРЕВ ${input.boostHeatPct}%`;
  const status = statusLabel(input.status);

  if (input.mode === 'escort') {
    return [
      `КАРАВАН ${input.caravanHpPct ?? 100}%   МАРШРУТ ${input.progressPct ?? 0}%`,
      `ВРЕМЯ ${clock(input.timeSec)}   ПИРАТЫ ${input.enemyAlive}   СБИТО ${input.playerScore}`,
      `ОРУЖИЕ ${weapons}`,
      `ВЫСОТА ${input.altitudeFt}   ${boost}   ${status}`,
    ].join('\n');
  }

  return [
    `АРЕНА   LVL ${level}   СБИТО ${input.playerScore}`,
    `ВРЕМЯ ${clock(input.timeSec)}   ПИРАТЫ ${input.enemyAlive}`,
    `ОРУЖИЕ ${weapons}`,
    `ВЫСОТА ${input.altitudeFt}   ${boost}   ${status}`,
  ].join('\n');
}
