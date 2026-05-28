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
    // Never below 1.0: the world is exactly screen-height, so zooming out past
    // the height-fit would expose black bars. Stay at cover or closer.
    zoom: Math.max(1.0, Math.min(1.12, 1.12 - Math.max(0, dist - 280) / 600 * 0.12)),
  };
}
