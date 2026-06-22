import { describe, it, expect } from 'vitest';
import { tick, wingRocketCapacity, toJackalHeavyRound } from './tick.js';
import { createWorldState, type WorldState } from './world-state.js';
import { TICK_DT, PLANE_INITIAL_HP, XP_PER_KILL_LIGHT, DYING_DURATION_SEC, BOOST_OVERHEAT_SEC, NO_THROTTLE_STALL_SEC, JACKAL_BULLET_SPEED_MULT, JACKAL_BULLET_LIFETIME_MULT, JACKAL_BULLET_GRAVITY_MULT } from '@biplanes/shared';

function makePlayer() {
  return {
    id: 1,
    faction: 'player' as const,
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 1200, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 1200, facing: 1 as const, throttle: true, throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
    state: 'flying' as const,
    respawnTimer: 0,
  };
}

describe('toJackalHeavyRound — heavy "boom" slug for the Jackal gun + heavy enemies', () => {
  const base = {
    id: 5, ownerId: 2, ownerFaction: 'enemy' as const,
    position: { x: 0, y: 0 }, velocity: { x: 1000, y: 0 },
    lifetime: 1.2, damage: 10, alive: true,
  };

  it('slows the muzzle, matches the parabola/range, tags it heavy', () => {
    const h = toJackalHeavyRound(base);
    expect(h.velocity.x).toBeCloseTo(1000 * JACKAL_BULLET_SPEED_MULT);
    expect(h.lifetime).toBeCloseTo(1.2 * JACKAL_BULLET_LIFETIME_MULT);
    expect(h.gravityScale).toBe(JACKAL_BULLET_GRAVITY_MULT);
    expect(h.heavyRound).toBe(true);
    expect(h.damage).toBe(10); // default damageMult = 1
  });

  it('applies the heavy-enemy per-shot damage multiplier', () => {
    expect(toJackalHeavyRound(base, 1.6).damage).toBeCloseTo(16);
  });
});

describe('world tick', () => {
  it('advances time', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(after.timeSec).toBeCloseTo(TICK_DT);
    expect(after.tickCount).toBe(1);
  });

  it('moves player plane based on physics', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(after.player.kinematic.position.x).toBeGreaterThan(500);
  });

  it('firing bleeds a little airspeed (recoil brakes the plane)', () => {
    const base = createWorldState(42, {
      ...makePlayer(),
      kinematic: { ...makePlayer().kinematic, g: 700, velocity: { x: 700, y: 0 } },
    });
    const notFired = tick(base, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    const fired = tick(base, { rotate: 0, fire: true, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(fired.bullets.length).toBeGreaterThan(0); // a shot actually happened
    expect(fired.player.kinematic.g).toBeLessThan(notFired.player.kinematic.g);
  });

  it('boost increases the player plane speed target during world ticks', () => {
    const base = createWorldState(42, {
      ...makePlayer(),
      kinematic: { ...makePlayer().kinematic, g: 700, throttleLevel: 1 },
    });

    const normal = tick(base, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    const boosted = tick(base, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false, boost: true });

    expect(boosted.player.kinematic.g).toBeGreaterThan(normal.player.kinematic.g);
    expect(boosted.player.boostActive).toBe(true);
  });

  it('IGNITES the engine (fire + HP loss), never an instant death spin, on sustained overheat', () => {
    let s = createWorldState(42, makePlayer());
    for (let i = 0; i < Math.ceil(BOOST_OVERHEAT_SEC / TICK_DT) + 2; i++) {
      s = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false, boost: true });
    }

    // Overheat = engine catches fire: still flying, alive, but burned down to the
    // fire threshold (then it keeps burning and you fall). NOT a game-over the moment
    // the gauge redlines. (Owner: overheat must be "мотор перегрелся", not instant death.)
    expect(s.player.state).toBe('flying');
    expect(s.player.alive).toBe(true);
    expect(s.player.hp / s.player.maxHp).toBeLessThanOrEqual(0.25);
  });

  it('ignite on overheat is deterministic — same outcome regardless of seed', () => {
    for (const seed of [7, 1, 99]) {
      const s = createWorldState(seed, { ...makePlayer(), boostHeat: 0.999 });
      const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false, boost: true });
      expect(after.player.state).toBe('flying');
      expect(after.player.alive).toBe(true);
      expect(after.player.hp / after.player.maxHp).toBeLessThanOrEqual(0.25);
      expect(after.player.boostHeat).toBeLessThan(1);
    }
  });

  it('kills the player in a death spin after three seconds with no throttle in the lower map', () => {
    let s: WorldState = {
      ...createWorldState(42, {
      ...makePlayer(),
      kinematic: { ...makePlayer().kinematic, position: { x: 500, y: 2300 }, throttleLevel: 0, throttleOn: false, throttle: false },
      }),
      worldHeight: 4000,
    };
    for (let i = 0; i < Math.ceil(NO_THROTTLE_STALL_SEC / TICK_DT) + 2; i++) {
      s = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    }

    expect(s.player.state).toBe('dying');
    expect(s.player.alive).toBe(false);
    expect(s.player.hp).toBe(0);
  });

  it('lets the player recover from no-throttle flight in the upper map', () => {
    let s: WorldState = {
      ...createWorldState(42, {
        ...makePlayer(),
        kinematic: {
          ...makePlayer().kinematic,
          position: { x: 500, y: 220 },
          velocity: { x: 820, y: 0 },
          g: 820,
          throttleLevel: 0,
          throttleOn: false,
          throttle: false,
        },
      }),
      worldHeight: 4000,
    };
    for (let i = 0; i < Math.ceil(NO_THROTTLE_STALL_SEC / TICK_DT) + 2; i++) {
      s = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    }

    expect(s.player.state).toBe('flying');
    expect(s.player.alive).toBe(true);
  });

  it('does not kill the player just because the gas command is released while throttle is already high', () => {
    let s: WorldState = {
      ...createWorldState(42, {
        ...makePlayer(),
        kinematic: { ...makePlayer().kinematic, throttleLevel: 1, throttleOn: true, throttle: true },
      }),
      worldHeight: 4000,
    };

    for (let i = 0; i < Math.ceil(NO_THROTTLE_STALL_SEC / TICK_DT) + 2; i++) {
      s = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    }

    expect(s.player.state).toBe('flying');
    expect(s.player.alive).toBe(true);
    expect(s.player.hp).toBeGreaterThan(0);
  });

  it('is deterministic for same input', () => {
    const s = createWorldState(42, makePlayer());
    const a = tick(s, { rotate: 1, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    const b = tick(s, { rotate: 1, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(a).toEqual(b);
  });

  it('does not mutate input state', () => {
    const s = createWorldState(42, makePlayer());
    const before = JSON.stringify(s);
    tick(s, { rotate: 1, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('awards XP from enemy kills', () => {
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      alive: true,
      state: 'flying' as const,
      respawnTimer: 0,
    };
    const s = {
      ...createWorldState(42, makePlayer()),
      enemies: [enemy],
      bullets: [{
        id: 3,
        ownerId: 1,
        ownerFaction: 'player' as const,
        position: { ...enemy.kinematic.position },
        velocity: { x: 0, y: 0 },
        lifetime: 1,
        damage: 10,
        alive: true,
      }],
    };
    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.xpCollected).toBe(XP_PER_KILL_LIGHT);
    expect(after.level).toBe(2);
    expect(after.pendingLevelUp).toBe(true);
  });

  it('bombs fall with gravity and explode on plane impact', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 500, y: 515 },
        velocity: { x: 0, y: 0 },
      },
      hp: 100,
    };
    const s = {
      ...createWorldState(42, player),
      enemies: [enemy],
      bombs: [{
        id: 10,
        ownerId: player.id,
        ownerFaction: 'player' as const,
        position: { x: 500, y: 510 },
        velocity: { x: 0, y: 0 },
        lifetime: 5.0,
        alive: true,
      }],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    // Bomb should fall, hit enemy, and explode dealing damage.
    expect(after.bombs).toHaveLength(0); // exploded
    expect(after.enemies[0]!.hp).toBeLessThan(100);
    expect(after.explosionEvents).toHaveLength(1);

    // Regression (leak fix): explosionEvents is a per-tick buffer. A follow-up tick
    // with no new explosion must reset it to empty, not carry the history forward.
    const after2 = tick(after, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(after2.explosionEvents).toHaveLength(0);
  });

  it('special weapon launches one straight wing rocket and spends a tube', () => {
    const player = { ...makePlayer(), wingRockets: 4 };
    const s = createWorldState(42, player);

    const after = tick(s, { rotate: 0, fire: false, bomb: false, special: true, throttleDelta: 0, eject: false, jump: false });

    expect(after.rockets.length).toBe(1);
    expect(after.rockets[0]!.straight).toBe(true);
    expect(after.rockets[0]!.ownerFaction).toBe('player');
    expect(after.player.wingRockets).toBe(3);
    expect(after.bombs).toHaveLength(0);
  });

  it('empties the magazine on the last shot and starts a reload', () => {
    const player = { ...makePlayer(), ammo: 1, weaponCooldown: 0 };
    const s = createWorldState(42, player);
    const cmd = { rotate: 0 as const, fire: true, bomb: false, throttleDelta: 0 as const, eject: false, jump: false };

    const after = tick(s, cmd);
    expect(after.player.ammo).toBe(0);
    expect(after.player.reloadTimer).toBeGreaterThan(0);

    // While reloading, the trigger does nothing and the timer ticks down.
    const after2 = tick(after, cmd);
    expect(after2.player.reloadTimer!).toBeLessThan(after.player.reloadTimer!);
    expect(after2.player.ammo).toBe(0);
  });

  it('rocket-pod upgrade adds wing-rocket tubes, and an empty rack fires nothing', () => {
    // Capacity reflects the "heavy_bomb" rocket-pod (+2).
    expect(wingRocketCapacity([])).toBe(4);
    expect(wingRocketCapacity(['heavy_bomb'])).toBe(6);

    // An empty rack launches nothing.
    const player = { ...makePlayer(), wingRockets: 0 };
    const after = tick(createWorldState(42, player), { rotate: 0, fire: false, bomb: false, special: true, throttleDelta: 0, eject: false, jump: false });
    expect(after.rockets.length).toBe(0);
    expect(after.player.wingRockets).toBe(0);
  });

  it('rockets steer toward closest enemy and explode', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 600, y: 500 },
      },
      hp: 100,
    };
    const s = {
      ...createWorldState(42, player),
      enemies: [enemy],
      rockets: [{
        id: 10,
        ownerId: player.id,
        ownerFaction: 'player' as const,
        position: { x: 500, y: 490 },
        velocity: { x: 500, y: 0 },
        heading: 0,
        lifetime: 4.0,
        alive: true,
        damage: 50,
      }],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    // Rocket should move towards enemy, checking heading steering.
    expect(after.rockets[0]!.heading).toBeGreaterThan(0); // since it is pointing straight at enemy already
    expect(after.rockets[0]!.position.x).toBeGreaterThan(500);
  });

  it('drone auto-fires at closest enemy within range', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 700, y: 500 },
      },
      hp: 30,
    };
    const s = {
      ...createWorldState(42, player),
      hasDrone: true,
      droneTimer: 0,
      enemies: [enemy],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    // Drone should fire a bullet, spawning it in newBulletList
    expect(after.bullets).toHaveLength(1);
    expect(after.bullets[0]!.ownerFaction).toBe('player');
    expect(after.bullets[0]!.damage).toBe(5); // base drone damage
  });

  it('enemy killed by bullet enters dying state, not crashed', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      kinematic: { ...makePlayer().kinematic, position: { x: 600, y: 500 } },
    };
    let s = createWorldState(42, player);
    s = {
      ...s,
      enemies: [enemy],
      bullets: [{
        id: 100,
        ownerId: 1,
        ownerFaction: 'player' as const,
        position: { x: 600, y: 500 },
        velocity: { x: 0, y: 0 },
        lifetime: 1,
        damage: 100,
        alive: true,
      }],
    };
    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    expect(after.enemies[0]!.state).toBe('dying');
    // Bullet hit happens after the enemy step in tick(), so the timer is set to the
    // full duration this tick and decremented starting next tick.
    expect(after.enemies[0]!.dyingTimer).toBeCloseTo(DYING_DURATION_SEC, 4);
  });

  it('dying plane transitions to crashed after DYING_DURATION_SEC', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      kinematic: { ...makePlayer().kinematic, position: { x: 600, y: 500 } },
    };
    let s = createWorldState(42, player);
    s = {
      ...s,
      enemies: [enemy],
      bullets: [{
        id: 100,
        ownerId: 1,
        ownerFaction: 'player' as const,
        position: { x: 600, y: 500 },
        velocity: { x: 0, y: 0 },
        lifetime: 1,
        damage: 100,
        alive: true,
      }],
    };
    let s2 = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    // Verify dying
    expect(s2.enemies[0]!.state).toBe('dying');
    s2 = { ...s2, pendingLevelUp: false };
    // Advance until dying timer elapses
    const ticksNeeded = Math.ceil(DYING_DURATION_SEC / TICK_DT) + 2;
    for (let i = 0; i < ticksNeeded; i++) {
      s2 = tick(s2, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    }
    // The original enemy entity may have been replaced by a respawned one — find any 'crashed' or new spawn behavior
    // by searching the trajectory. Simpler: enemy id 2 should be either crashed or removed by now.
    const e2 = s2.enemies.find(e => e.id === 2);
    if (e2) {
      expect(e2.state).toBe('crashed');
    }
    // Verify it left dying state
    const stillDying = s2.enemies.some(e => e.state === 'dying' && e.id === 2);
    expect(stillDying).toBe(false);
  });

  it('plane-plane collision is deterministic', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      kinematic: { ...makePlayer().kinematic, position: { x: 1200, y: 500 } },
    };
    const s1 = { ...createWorldState(42, player), enemies: [enemy] };
    const s2 = { ...createWorldState(42, player), enemies: [enemy] };
    const cmd = { rotate: 0 as const, fire: false, bomb: false, throttleDelta: 0 as const, eject: false, jump: false };
    const a = tick(s1, cmd);
    const b = tick(s2, cmd);
    expect(a.enemies[0]).toEqual(b.enemies[0]);
    expect(a.player).toEqual(b.player);
  });

  it('scores both sides when player and enemy die in the same ram', () => {
    const player = {
      ...makePlayer(),
      hp: 1,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 500, y: 500 },
        velocity: { x: 0, y: 0 },
        heading: 0,
        g: 0,
        throttleLevel: 0,
      },
    };
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 500, y: 500 },
        velocity: { x: 0, y: 0 },
        heading: Math.PI,
        g: 0,
        facing: -1 as const,
        throttleLevel: 0,
      },
    };
    const s = { ...createWorldState(42, player), enemies: [enemy] };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.playerScore).toBe(1);
    expect(after.enemyScore).toBe(1);
  });

  it('flame trail deals damage to enemy plane behind tail', () => {
    const player = makePlayer();
    player.kinematic.heading = 0; // facing right, tail is to the left (-x)
    player.kinematic.position = { x: 500, y: 500 };
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      kinematic: {
        ...makePlayer().kinematic,
        position: { x: 450, y: 500 }, // directly behind player
      },
      hp: 30,
    };
    const s = {
      ...createWorldState(42, player),
      hasFlameTrail: true,
      enemies: [enemy],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
    // Enemy should take damage from flame trail
    expect(after.enemies[0]!.hp).toBeLessThan(30);
  });

  it('ends the run when player reaches the ace score target', () => {
    const player = makePlayer();
    const enemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      kinematic: { ...makePlayer().kinematic, position: { x: 600, y: 500 } },
    };
    const s = {
      ...createWorldState(42, player),
      playerScore: 14,
      enemies: [enemy],
      bullets: [{
        id: 100,
        ownerId: 1,
        ownerFaction: 'player' as const,
        position: { x: 600, y: 500 },
        velocity: { x: 0, y: 0 },
        lifetime: 1,
        damage: 100,
        alive: true,
      }],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.playerScore).toBe(15);
    expect(after.gameOver).toBe(true);
  });

  it('ends the arena run when the final boss is destroyed', () => {
    const player = makePlayer();
    const boss = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      hp: 1,
      maxHp: 1,
      isBoss: true,
      kinematic: { ...makePlayer().kinematic, position: { x: 600, y: 500 } },
    };
    const s = {
      ...createWorldState(42, player),
      playerScore: 12,
      enemies: [boss],
      bullets: [{
        id: 100,
        ownerId: 1,
        ownerFaction: 'player' as const,
        position: { x: 600, y: 500 },
        velocity: { x: 0, y: 0 },
        lifetime: 1,
        damage: 100,
        alive: true,
      }],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.playerScore).toBeGreaterThanOrEqual(15);
    expect(after.gameOver).toBe(true);
  });

  it('spawns the current arena wave in the air', () => {
    const s = {
      ...createWorldState(42, makePlayer()),
      difficulty: 'hard' as const,
      timeSec: 100,
      playerScore: 9,
      enemies: [],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.enemies.filter(e => e.state === 'flying')).toHaveLength(5);
  });

  it('does not spawn another enemy while one is still taking off', () => {
    const taxiEnemy = {
      ...makePlayer(),
      id: 2,
      faction: 'enemy' as const,
      state: 'taxi' as const,
      kinematic: {
        ...makePlayer().kinematic,
        heading: Math.PI,
        facing: -1 as const,
        g: 0,
        throttleLevel: 0,
      },
    };
    const s = {
      ...createWorldState(42, makePlayer()),
      difficulty: 'hard' as const,
      timeSec: 100,
      enemies: [taxiEnemy],
    };

    const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });

    expect(after.enemies).toHaveLength(1);
  });

  describe('Caravan Escort Mechanics', () => {
    it('moves caravan horizontally in tick', () => {
      const s = {
        ...createWorldState(42, makePlayer()),
        caravan: {
          active: true,
          position: { x: 500, y: 300 },
          velocity: { x: 10, y: 0 },
          hp: 100,
          maxHp: 100,
        },
      };

      const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
      expect(after.caravan!.position.x).toBeCloseTo(500 + 10 * TICK_DT, 4);
      expect(after.caravan!.position.y).toBeCloseTo(300, 4);
    });

    it('enemy bullet hitting the caravan deals damage and consumes the bullet', () => {
      const s = {
        ...createWorldState(42, makePlayer()),
        caravan: {
          active: true,
          position: { x: 500, y: 300 },
          velocity: { x: 0, y: 0 },
          hp: 100,
          maxHp: 100,
        },
        bullets: [{
          id: 100,
          ownerId: 2,
          ownerFaction: 'enemy' as const,
          position: { x: 500, y: 300 }, // hits exactly
          velocity: { x: 0, y: 0 },
          lifetime: 1,
          damage: 25,
          alive: true,
        }],
      };

      const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
      expect(after.caravan!.hp).toBe(75);
      expect(after.bullets).toHaveLength(0); // consumed!
      expect(after.explosionEvents).toHaveLength(0);
    });

    it('can reduce incoming caravan damage for training escort missions', () => {
      const s = {
        ...createWorldState(42, makePlayer()),
        caravan: {
          active: true,
          position: { x: 500, y: 300 },
          velocity: { x: 0, y: 0 },
          hp: 100,
          maxHp: 100,
          incomingDamageMultiplier: 0.5,
        },
        bullets: [{
          id: 100,
          ownerId: 2,
          ownerFaction: 'enemy' as const,
          position: { x: 500, y: 300 },
          velocity: { x: 0, y: 0 },
          lifetime: 1,
          damage: 20,
          alive: true,
        }],
      };

      const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
      expect(after.caravan!.hp).toBe(90);
      expect(after.bullets).toHaveLength(0);
    });

    it('triggers game over when caravan hp drops to 0', () => {
      const s = {
        ...createWorldState(42, makePlayer()),
        caravan: {
          active: true,
          position: { x: 500, y: 300 },
          velocity: { x: 0, y: 0 },
          hp: 5,
          maxHp: 100,
        },
        bullets: [{
          id: 100,
          ownerId: 2,
          ownerFaction: 'enemy' as const,
          position: { x: 500, y: 300 },
          velocity: { x: 0, y: 0 },
          lifetime: 1,
          damage: 10,
          alive: true,
        }],
      };

      const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
      expect(after.caravan!.hp).toBe(0);
      expect(after.gameOver).toBe(true);
    });

    it('keeps campaign-style airspawn attackers airborne during their opening run', () => {
      const player = {
        ...makePlayer(),
        kinematic: {
          ...makePlayer().kinematic,
          position: { x: 520, y: 380 },
          velocity: { x: 260, y: 0 },
          g: 720,
          throttleLevel: 0.75,
        },
      };
      const attacker = {
        ...makePlayer(),
        id: 2,
        faction: 'enemy' as const,
        aiRole: 'attack-caravan' as const,
        kinematic: {
          ...makePlayer().kinematic,
          position: { x: 1780, y: 260 },
          velocity: { x: -220, y: 0 },
          heading: Math.PI,
          facing: -1 as const,
          g: 720,
          throttleLevel: 0.86,
        },
        hp: 30,
        maxHp: 30,
        state: 'flying' as const,
      };
      let s: WorldState = {
        ...createWorldState(42, player),
        difficulty: 'medium' as const,
        enemies: [attacker],
        caravan: {
          active: true,
          position: { x: 760, y: 250 },
          velocity: { x: 4, y: 0 },
          hp: 100,
          maxHp: 100,
        },
      };

      for (let i = 0; i < Math.round(12 / TICK_DT); i++) {
        s = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
      }

      expect(s.enemies[0]!.state).toBe('flying');
      expect(s.enemies[0]!.alive).toBe(true);
    });
  });
});
