import { describe, expect, it } from 'vitest';
import { WORLD_WIDTH } from '@biplanes/shared';
import {
  MISSION_ONE_WORLD_WIDTH,
  getMissionOneCarrierLaunch,
  getMissionOneCaravanStart,
  getMissionOneEnemySpawnX,
} from './mission-one-layout.js';

describe('mission one layout', () => {
  it('uses a real long route instead of the arena width', () => {
    expect(MISSION_ONE_WORLD_WIDTH).toBeGreaterThan(WORLD_WIDTH * 2);
  });

  it('starts the player clear of the carrier hull and the caravan', () => {
    const player = getMissionOneCarrierLaunch();
    const caravan = getMissionOneCaravanStart();

    expect(player.x).toBeGreaterThan(500);
    expect(Math.hypot(player.x - caravan.x, player.y - caravan.y)).toBeGreaterThan(430);
  });

  it('spawns enemies ahead in the long route, not wrapped behind the arena seam', () => {
    const spawnX = getMissionOneEnemySpawnX(0, false);

    expect(spawnX).toBeGreaterThan(WORLD_WIDTH);
    expect(spawnX).toBeLessThan(MISSION_ONE_WORLD_WIDTH);
  });
});
