import { WORLD_HEIGHT, WORLD_WIDTH } from '@biplanes/shared';

export const MISSION_ONE_WORLD_WIDTH = 11520;
export const MISSION_ONE_CARAVAN_SPEED = 42;

export function getMissionOneCarrierLaunch() {
  return {
    x: 680,
    y: WORLD_HEIGHT * 0.42,
  };
}

export function getMissionOneCaravanStart() {
  return {
    x: 1200,
    y: WORLD_HEIGHT * 0.31,
  };
}

export function getMissionOneCaravanEnd() {
  return {
    x: MISSION_ONE_WORLD_WIDTH - 1020,
    y: WORLD_HEIGHT * 0.28,
  };
}

export function getMissionOneEnemySpawnX(index: number, boss: boolean) {
  if (boss) return MISSION_ONE_WORLD_WIDTH - 560;
  return Math.min(MISSION_ONE_WORLD_WIDTH - 500, WORLD_WIDTH + 260 + index * 96);
}
