import { WORLD_HEIGHT } from '@biplanes/shared';

export interface MissionOneEscortFocusInput {
  playerX: number;
  playerY: number;
  caravanX: number;
  caravanY: number;
}

export interface MissionOneEscortFocus {
  x: number;
  y: number;
  zoom: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function getMissionOneEscortFocus(input: MissionOneEscortFocusInput): MissionOneEscortFocus {
  const offsetX = clamp(input.caravanX - input.playerX, -520, 520);
  const offsetY = clamp(input.caravanY - input.playerY, -180, 180);
  const dist = Math.hypot(input.playerX - input.caravanX, input.playerY - input.caravanY);

  return {
    x: input.playerX + offsetX * 0.38,
    y: clamp(input.playerY + offsetY * 0.45, WORLD_HEIGHT * 0.22, WORLD_HEIGHT * 0.72),
    zoom: Math.max(0.95, Math.min(1.10, 1.10 - Math.max(0, dist - 280) / 600 * 0.15)),
  };
}
