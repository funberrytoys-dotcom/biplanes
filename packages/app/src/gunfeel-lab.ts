export interface GunfeelLabShot {
  fire: boolean;
  heavy: boolean;
}

const CYCLE_SEC = 1.35;
const MACHINE_GUN_WINDOWS = [0.05, 0.17, 0.29, 0.41];
const HEAVY_WINDOW = 1.04;
const WINDOW_SEC = 0.035;
const EPSILON_SEC = 0.0001;

export function getGunfeelLabShotAt(timeSec: number): GunfeelLabShot {
  const t = ((timeSec % CYCLE_SEC) + CYCLE_SEC) % CYCLE_SEC;
  const inWindow = (start: number) => t + EPSILON_SEC >= start && t < start + WINDOW_SEC;

  if (inWindow(HEAVY_WINDOW)) {
    return { fire: true, heavy: true };
  }

  if (MACHINE_GUN_WINDOWS.some(inWindow)) {
    return { fire: true, heavy: false };
  }

  return { fire: false, heavy: false };
}
