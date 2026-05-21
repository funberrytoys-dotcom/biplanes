import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import {
  PLANE_INITIAL_HP,
  FIRE_THRESHOLD,
  FIRE_BURN_RATE,
  TICK_DT,
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

const NO_OP = { rotate: 0 as const, fire: false, bomb: false, throttleDelta: 0 as const, eject: false };
const EJECT_CMD = { ...NO_OP, eject: true };

describe('eject + pilot lifecycle', () => {
  it('eject spawns pilot and crashes plane', () => {
    const s = createWorldState(42, makePlayerFlying());
    const after = tick(s, EJECT_CMD);
    expect(after.pilot).not.toBeNull();
    expect(after.pilot!.state).toBe('parachute');
    expect(after.player.state).toBe('crashed');
  });

  it('does not spawn pilot if plane is not flying', () => {
    const taxiing = { ...makePlayerFlying(), state: 'taxi' as const };
    const s = createWorldState(42, taxiing);
    const after = tick(s, EJECT_CMD);
    expect(after.pilot).toBeNull();
  });

  it('once ejected, player input affects pilot not plane', () => {
    const s = createWorldState(42, makePlayerFlying());
    const ejected = tick(s, EJECT_CMD);
    const planeBeforeX = ejected.player.kinematic.position.x;
    // 10 more ticks holding rotate=1
    let s2 = ejected;
    for (let i = 0; i < 10; i++) {
      s2 = tick(s2, { ...NO_OP, rotate: 1 });
    }
    // Plane stays put (state: crashed) — position frozen.
    expect(s2.player.kinematic.position.x).toBe(planeBeforeX);
    // Pilot has drifted right.
    expect(s2.pilot).not.toBeNull();
    expect(s2.pilot!.position.x).toBeGreaterThan(ejected.pilot!.position.x);
  });

  it('plane does not auto-respawn while pilot is in play', () => {
    const s = createWorldState(42, makePlayerFlying());
    let s2 = tick(s, EJECT_CMD);
    // 60 ticks = 1 second; default RESPAWN_DELAY is 3s but pilot should hold it.
    for (let i = 0; i < 300; i++) {
      s2 = tick(s2, NO_OP);
    }
    // Plane should still be crashed because pilot is still descending.
    expect(s2.player.state).toBe('crashed');
    expect(s2.pilot).not.toBeNull();
  });
});

describe('fire burn damage', () => {
  it('burn HP at FIRE_BURN_RATE when below FIRE_THRESHOLD', () => {
    const lowHp = Math.floor(PLANE_INITIAL_HP * FIRE_THRESHOLD); // e.g. 25 of 100
    const s = createWorldState(42, makePlayerFlying(lowHp));
    let s2 = s;
    // Tick for ~1 second
    for (let i = 0; i < 60; i++) {
      s2 = tick(s2, NO_OP);
    }
    // Expect roughly FIRE_BURN_RATE less HP
    const lost = lowHp - s2.player.hp;
    expect(lost).toBeGreaterThan(FIRE_BURN_RATE * 0.7);
    expect(lost).toBeLessThan(FIRE_BURN_RATE * 1.3);
  });

  it('does NOT burn when HP above FIRE_THRESHOLD', () => {
    const okHp = Math.floor(PLANE_INITIAL_HP * (FIRE_THRESHOLD + 0.2)); // above threshold
    const s = createWorldState(42, makePlayerFlying(okHp));
    let s2 = s;
    for (let i = 0; i < 60; i++) {
      s2 = tick(s2, NO_OP);
    }
    expect(s2.player.hp).toBe(okHp);
  });
});

describe('collision against pilot', () => {
  it('any bullet hitting pilot kills them', async () => {
    // Spawn pilot via eject, then plant a bullet on top of pilot manually.
    const s = createWorldState(42, makePlayerFlying());
    let s2 = tick(s, EJECT_CMD);
    expect(s2.pilot).not.toBeNull();
    // Inject a bullet at pilot position; owner not player so collision triggers.
    s2 = {
      ...s2,
      bullets: [
        ...s2.bullets,
        {
          id: 9999,
          ownerId: 12345,
          position: { ...s2.pilot!.position },
          velocity: { x: 0, y: 0 },
          lifetime: 1.0,
          damage: 999,
          alive: true,
        },
      ],
    };
    s2 = tick(s2, NO_OP);
    expect(s2.pilot).not.toBeNull();
    expect(s2.pilot!.state).toBe('dead');
  });
});
