import { G_MAX_LEVEL } from '@biplanes/shared';

export interface ArenaCameraFocusInput {
  playerX: number;
  playerY: number;
  facing: number;
}

export function resolveArenaPlayerSpawn(worldWidth: number, worldHeight: number) {
  return {
    x: worldWidth / 2,
    y: worldHeight * 0.58,
  };
}

export function resolveArenaPlayerLaunch(worldWidth: number, worldHeight: number) {
  return {
    position: resolveArenaPlayerSpawn(worldWidth, worldHeight),
    velocity: { x: G_MAX_LEVEL, y: 0 },
    heading: 0,
    g: G_MAX_LEVEL,
    throttleOn: true,
    throttle: true,
    throttleLevel: 1.0,
    facing: 1 as const,
  };
}

export function resolveArenaPlayerRunwayStart(worldWidth: number, worldHeight: number) {
  return {
    position: {
      x: Math.max(220, worldWidth * 0.08),
      y: worldHeight - 90,
    },
    velocity: { x: 0, y: 0 },
    heading: 0,
    g: 0,
    throttleOn: false,
    throttle: false,
    throttleLevel: 0,
    facing: 1 as const,
  };
}

export interface ArenaTakeoffReadinessInput {
  playerY: number;
  playerG: number;
  playerState: 'taxi' | 'flying' | 'dying' | 'crashed' | 'ejected';
  worldHeight: number;
}

export function shouldStartArenaDuelAfterTakeoff(input: ArenaTakeoffReadinessInput) {
  return (
    input.playerState === 'flying' &&
    input.playerY <= input.worldHeight - 420 &&
    input.playerG >= G_MAX_LEVEL * 0.72
  );
}

export function resolveArenaCameraFocus(input: ArenaCameraFocusInput) {
  return {
    x: input.playerX + input.facing * 180,
    y: input.playerY + 120,
    zoom: 1.0,
  };
}
