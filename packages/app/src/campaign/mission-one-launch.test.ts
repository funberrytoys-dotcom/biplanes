import { describe, expect, it } from 'vitest';
import { createWorldState, tick, type Plane } from '@biplanes/core';
import { PLANE_INITIAL_HP, TICK_DT } from '@biplanes/shared';
import {
  MISSION_ONE_WORLD_WIDTH,
  MISSION_ONE_CARAVAN_SPEED,
  getMissionOneCarrierLaunch,
  getMissionOneCaravanStart,
} from './mission-one-layout.js';

function makeLaunchPlane(): Plane {
  return {
    id: 1,
    faction: 'player',
    kinematic: {
      position: getMissionOneCarrierLaunch(),
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 680,
      facing: 1,
      throttle: true,
      throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

describe('mission one launch', () => {
  it('keeps the player alive after carrier launch while gas is held', () => {
    let state = createWorldState(1, makeLaunchPlane());
    const caravanStart = getMissionOneCaravanStart();
    state = {
      ...state,
      difficulty: 'medium',
      worldWidth: MISSION_ONE_WORLD_WIDTH,
      enemies: [],
      caravan: {
        active: true,
        position: caravanStart,
        velocity: { x: MISSION_ONE_CARAVAN_SPEED, y: 0 },
        hp: 100,
        maxHp: 100,
        incomingDamageMultiplier: 0.6,
      },
    };

    for (let i = 0; i < Math.round(5 / TICK_DT); i++) {
      state = tick(state, { rotate: 0, fire: false, bomb: false, throttleDelta: 1, eject: false, jump: false });
    }

    expect(state.player.alive).toBe(true);
    expect(state.player.state).toBe('flying');
    expect(state.player.hp).toBe(PLANE_INITIAL_HP);
    expect(state.player.kinematic.position.x).toBeGreaterThan(getMissionOneCarrierLaunch().x + 600);
    expect(state.caravan?.hp).toBe(100);
  });
});
