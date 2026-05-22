import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import { TICK_DT, PLANE_INITIAL_HP, XP_PER_KILL_LIGHT, DYING_DURATION_SEC } from '@biplanes/shared';

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
    expect(after.level).toBe(1);
    expect(after.pendingLevelUp).toBe(false);
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
});
