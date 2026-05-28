import { describe, expect, it } from 'vitest';
import { createMissionOneController } from './mission-one-controller.js';
import { getMissionOneBossPlan, getMissionOneWavePlan } from './mission-one-encounters.js';

describe('mission one playthrough flow', () => {
  it('can resolve the scripted escort into a victory after the beacon forces Scar to retreat', () => {
    const mission = createMissionOneController();
    let bossAlive = false;
    let bossSpawned = false;
    const spawnedWaves: string[] = [];
    const spawnedEnemyRoles: string[] = [];

    for (let i = 0; i < 2400; i++) {
      for (const wave of mission.consumeWaves()) {
        spawnedWaves.push(wave.id);
        for (const group of getMissionOneWavePlan(wave.id)) {
          for (let j = 0; j < group.count; j++) {
            spawnedEnemyRoles.push(group.role);
          }
        }
      }

      if (mission.shouldSpawnBoss()) {
        bossSpawned = true;
        bossAlive = true;
        const bossPlan = getMissionOneBossPlan();
        mission.registerBoss(9001);
        spawnedEnemyRoles.push(bossPlan.role);
      }

      if (mission.shouldForceBossRetreat()) {
        bossAlive = false;
      }

      mission.update(0.1, 0.42, bossAlive);
    }

    expect(spawnedWaves).toEqual([
      'first-claws',
      'deck-raiders',
      'high-dive',
      'crossfire',
      'caravan-hunters',
      'fog-cutters',
      'underbelly',
      'carrier-screen',
      'last-screen',
    ]);
    expect(spawnedEnemyRoles.filter((role) => role === 'attack-caravan')).toHaveLength(13);
    expect(spawnedEnemyRoles.filter((role) => role === 'chase-player')).toHaveLength(15);
    expect(bossSpawned).toBe(true);
    expect(mission.phase).toBe('victory');
    expect(mission.routeProgress).toBe(1);
  });
});
