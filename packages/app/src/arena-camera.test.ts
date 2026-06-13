import { describe, expect, it } from 'vitest';
import { G_MAX_LEVEL } from '@biplanes/shared';
import {
  resolveArenaCameraFocus,
  resolveArenaPlayerLaunch,
  resolveArenaPlayerRunwayStart,
  resolveArenaPlayerSpawn,
  shouldStartArenaDuelAfterTakeoff,
} from './arena-camera.js';

describe('resolveArenaPlayerSpawn', () => {
  it('starts the arena plane away from the bottom camera clamp', () => {
    const spawn = resolveArenaPlayerSpawn(9600, 3240);

    expect(spawn.x).toBe(4800);
    expect(spawn.y).toBeLessThan(2400);
  });
});

describe('resolveArenaPlayerLaunch', () => {
  it('starts the arena plane already flying at cruise speed', () => {
    const launch = resolveArenaPlayerLaunch(9600, 3240);

    expect(launch.position.y).toBeLessThan(2400);
    expect(launch.velocity.x).toBe(G_MAX_LEVEL);
    expect(launch.g).toBe(G_MAX_LEVEL);
    expect(launch.throttleOn).toBe(true);
    expect(launch.throttleLevel).toBe(1);
  });
});

describe('resolveArenaPlayerRunwayStart', () => {
  it('places the plane on the arena runway at rest for a real round takeoff', () => {
    const start = resolveArenaPlayerRunwayStart(9600, 3240);

    expect(start.position.x).toBe(768);
    expect(start.position.y).toBe(3150);
    expect(start.velocity.x).toBe(0);
    expect(start.velocity.y).toBe(0);
    expect(start.g).toBe(0);
    expect(start.heading).toBe(0);
    expect(start.throttleOn).toBe(false);
    expect(start.throttleLevel).toBe(0);
  });
});

describe('shouldStartArenaDuelAfterTakeoff', () => {
  it('holds the duel while the plane is still low over the runway', () => {
    expect(shouldStartArenaDuelAfterTakeoff({
      playerY: 3000,
      playerG: G_MAX_LEVEL,
      playerState: 'flying',
      worldHeight: 3240,
    })).toBe(false);
  });

  it('starts the duel once the plane has safe speed and altitude', () => {
    expect(shouldStartArenaDuelAfterTakeoff({
      playerY: 2600,
      playerG: G_MAX_LEVEL * 0.8,
      playerState: 'flying',
      worldHeight: 3240,
    })).toBe(true);
  });
});

describe('resolveArenaCameraFocus', () => {
  it('keeps the plane close to the vertical focus during arena flight', () => {
    const focus = resolveArenaCameraFocus({
      playerX: 4800,
      playerY: 1800,
      facing: 1,
    });

    expect(focus.x).toBe(4980);
    expect(focus.y).toBe(1920);
    expect(focus.zoom).toBe(1);
  });

  it('does not frame the player near the top edge during arena flight', () => {
    const playerY = 1800;
    const focus = resolveArenaCameraFocus({
      playerX: 4800,
      playerY,
      facing: 1,
    });

    expect(focus.y - playerY).toBeLessThanOrEqual(160);
  });
});
