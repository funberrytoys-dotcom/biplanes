import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import type { WorldState } from './world-state.js';
import { findPilot } from '../entities/pilot.js';
import {
  PLANE_INITIAL_HP,
  FIRE_THRESHOLD,
  FIRE_BURN_RATE,
  WORLD_WIDTH,
} from '@biplanes/shared';

function makePlayerFlying(hp = PLANE_INITIAL_HP) {
  return {
    id: 1,
    faction: 'player' as const,
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 600, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 800, facing: 1 as const, throttle: true, throttleLevel: 1,
    },
    hp,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
    state: 'flying' as const,
    respawnTimer: 0,
  };
}

const NO_OP = { rotate: 0 as const, fire: false, bomb: false, throttleDelta: 0 as const, eject: false, jump: false };
const EJECT_CMD = { ...NO_OP, eject: true };

describe('eject + pilot lifecycle', () => {
  it('eject spawns player pilot and crashes plane', () => {
    const s = createWorldState(42, makePlayerFlying());
    const after = tick(s, EJECT_CMD);
    const pp = findPilot(after.pilots, 'player');
    expect(pp).toBeDefined();
    expect(pp!.state).toBe('parachute');
    expect(after.player.state).toBe('crashed');
  });

  it('does not spawn pilot if plane is not flying', () => {
    const taxiing = { ...makePlayerFlying(), state: 'taxi' as const };
    const s = createWorldState(42, taxiing);
    const after = tick(s, EJECT_CMD);
    expect(findPilot(after.pilots, 'player')).toBeUndefined();
  });

  it('once ejected, player input affects pilot not plane', () => {
    const s = createWorldState(42, makePlayerFlying());
    const ejected = tick(s, EJECT_CMD);
    const planeBeforeX = ejected.player.kinematic.position.x;
    let s2 = ejected;
    for (let i = 0; i < 10; i++) {
      s2 = tick(s2, { ...NO_OP, rotate: 1 });
    }
    expect(s2.player.kinematic.position.x).toBe(planeBeforeX);
    const pp = findPilot(s2.pilots, 'player');
    expect(pp).toBeDefined();
    expect(pp!.position.x).toBeGreaterThan(findPilot(ejected.pilots, 'player')!.position.x);
  });

  it('plane does not auto-respawn while pilot is in play', () => {
    const s = createWorldState(42, makePlayerFlying());
    let s2 = tick(s, EJECT_CMD);
    for (let i = 0; i < 300; i++) {
      s2 = tick(s2, NO_OP);
    }
    expect(s2.player.state).toBe('crashed');
    expect(findPilot(s2.pilots, 'player')).toBeDefined();
  });

  it('lands the ejected pilot on the current arena ground instead of the small-map cloud layer', () => {
    const worldHeight = 3240;
    let s: WorldState = {
      ...createWorldState(42, makePlayerFlying()),
      worldWidth: WORLD_WIDTH * 5,
      worldHeight,
    };
    s = tick(s, EJECT_CMD);

    for (let i = 0; i < 2300; i++) {
      s = tick(s, NO_OP);
      const pilot = findPilot(s.pilots, 'player');
      if (pilot?.state === 'walking') break;
    }

    const pilot = findPilot(s.pilots, 'player');
    expect(pilot).toBeDefined();
    expect(pilot!.state).toBe('walking');
    expect(pilot!.position.y).toBe(worldHeight - 90);
  });
});

describe('fire burn damage', () => {
  it('burn HP at FIRE_BURN_RATE when below FIRE_THRESHOLD', () => {
    const lowHp = Math.floor(PLANE_INITIAL_HP * FIRE_THRESHOLD);
    const s = createWorldState(42, makePlayerFlying(lowHp));
    let s2 = s;
    for (let i = 0; i < 60; i++) {
      s2 = tick(s2, NO_OP);
    }
    const lost = lowHp - s2.player.hp;
    expect(lost).toBeGreaterThan(FIRE_BURN_RATE * 0.7);
    expect(lost).toBeLessThan(FIRE_BURN_RATE * 1.3);
  });

  it('does NOT burn when HP above FIRE_THRESHOLD', () => {
    const okHp = Math.floor(PLANE_INITIAL_HP * (FIRE_THRESHOLD + 0.2));
    const s = createWorldState(42, makePlayerFlying(okHp));
    let s2 = s;
    for (let i = 0; i < 60; i++) {
      s2 = tick(s2, NO_OP);
    }
    expect(s2.player.hp).toBe(okHp);
  });
});

describe('collision against pilot', () => {
  it('enemy bullet hitting player pilot kills them', async () => {
    const s = createWorldState(42, makePlayerFlying());
    let s2 = tick(s, EJECT_CMD);
    const pp = findPilot(s2.pilots, 'player');
    expect(pp).toBeDefined();
    s2 = {
      ...s2,
      bullets: [
        ...s2.bullets,
        {
          id: 9999,
          ownerId: 12345,
          ownerFaction: 'enemy',
          position: { ...pp!.position },
          velocity: { x: 0, y: 0 },
          lifetime: 1.0,
          damage: 999,
          alive: true,
        },
      ],
    };
    s2 = tick(s2, NO_OP);
    const after = findPilot(s2.pilots, 'player');
    expect(after).toBeDefined();
    expect(after!.state).toBe('dead');
  });

  it('player-owned bullet does NOT hurt own pilot (friendly fire skip)', async () => {
    const s = createWorldState(42, makePlayerFlying());
    let s2 = tick(s, EJECT_CMD);
    const pp = findPilot(s2.pilots, 'player');
    expect(pp).toBeDefined();
    s2 = {
      ...s2,
      bullets: [
        ...s2.bullets,
        {
          id: 9999,
          ownerId: 1,
          ownerFaction: 'player',
          position: { ...pp!.position },
          velocity: { x: 0, y: 0 },
          lifetime: 1.0,
          damage: 999,
          alive: true,
        },
      ],
    };
    s2 = tick(s2, NO_OP);
    const after = findPilot(s2.pilots, 'player');
    expect(after).toBeDefined();
    // Should still be alive — friendly fire on pilots is disabled.
    expect(after!.state).not.toBe('dead');
  });
});
