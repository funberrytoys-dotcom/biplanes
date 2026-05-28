import { describe, expect, it } from 'vitest';
import { createMissionOneController } from './mission-one-controller.js';

function advance(controller: ReturnType<typeof createMissionOneController>, seconds: number, bossAlive = false) {
  const step = 1 / 10;
  for (let t = 0; t < seconds; t += step) {
    controller.update(step, 1, bossAlive);
  }
}

describe('mission one controller', () => {
  it('paces the escort as a brisk scripted route', () => {
    const mission = createMissionOneController();

    advance(mission, 175, false);
    expect(mission.phase).toBe('ambush');

    advance(mission, 2, false);
    expect(mission.phase).toBe('boss');

    advance(mission, 40, true);
    expect(mission.phase).toBe('boss');
    expect(mission.routeProgress).toBeLessThan(1);

    advance(mission, 4, false);
    expect(mission.phase).toBe('victory');
    expect(mission.routeProgress).toBe(1);
  });

  it('releases waves and boss only at their scripted beats', () => {
    const mission = createMissionOneController();

    expect(mission.consumeWaves()).toEqual([]);
    expect(mission.shouldSpawnBoss()).toBe(false);

    advance(mission, 8, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['first-claws']);

    advance(mission, 24, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['deck-raiders']);

    advance(mission, 12, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['high-dive']);

    advance(mission, 18, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['crossfire']);

    advance(mission, 20, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['caravan-hunters']);

    advance(mission, 30, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['fog-cutters']);

    advance(mission, 14, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['underbelly']);

    advance(mission, 28, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['carrier-screen']);

    advance(mission, 12, false);
    expect(mission.consumeWaves().map((wave) => wave.id)).toEqual(['last-screen']);
    expect(mission.shouldSpawnBoss()).toBe(false);

    advance(mission, 14, false);
    expect(mission.shouldSpawnBoss()).toBe(true);
    expect(mission.shouldSpawnBoss()).toBe(false);
  });

  it('fails immediately when the caravan is lost', () => {
    const mission = createMissionOneController();

    mission.update(1, 0, false);

    expect(mission.phase).toBe('failure');
  });

  it('requests beacon-assisted boss retreat when the caravan reaches the lighthouse', () => {
    const mission = createMissionOneController();

    advance(mission, 221, true);

    expect(mission.phase).toBe('boss');
    expect(mission.shouldForceBossRetreat()).toBe(true);
    expect(mission.shouldForceBossRetreat()).toBe(false);
  });

  it('allows one emergency caravan repair when the escort is nearly lost', () => {
    const mission = createMissionOneController();

    advance(mission, 60, false);
    mission.update(0.1, 0.34, false);

    expect(mission.shouldTriggerEmergencyRepair()).toBe(true);
    expect(mission.shouldTriggerEmergencyRepair()).toBe(false);

    mission.update(0.1, 0.12, false);
    expect(mission.shouldTriggerEmergencyRepair()).toBe(false);
  });

  it('has story radio beats throughout the route, not only at launch', () => {
    const mission = createMissionOneController();
    const heard: string[] = [];

    for (let i = 0; i < 2200; i++) {
      const event = mission.consumeRadio();
      if (event) heard.push(event.id);
      mission.update(0.1, 1, false);
    }

    expect(heard).toContain('alarm');
    expect(heard).toContain('mid-route');
    expect(heard).toContain('pre-boss');
    expect(heard).toContain('boss-chico');
    expect(heard.length).toBeGreaterThanOrEqual(12);
  });
});
