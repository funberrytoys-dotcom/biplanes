import { describe, expect, it } from 'vitest';
import { resolveFlightLabCue, resolveFlightLabSpawn } from './flight-lab.js';

describe('resolveFlightLabSpawn', () => {
  it('starts high enough to practice stall recovery without immediately hitting the ground', () => {
    const spawn = resolveFlightLabSpawn(9600, 3240);

    expect(spawn.position.x).toBe(4800);
    expect(spawn.position.y).toBe(1700);
    expect(spawn.throttleLevel).toBe(0.65);
    expect(spawn.g).toBeGreaterThan(350);
  });
});

describe('resolveFlightLabCue', () => {
  it('asks the player to add throttle before the plane has useful speed', () => {
    expect(resolveFlightLabCue({
      planeState: 'flying',
      throttleLevel: 0.15,
      speed: 200,
      isStalling: false,
      recoveredFromStall: false,
      firedAfterRecovery: false,
    })).toBe('GAS');
  });

  it('asks for a dive while the plane is stalling', () => {
    expect(resolveFlightLabCue({
      planeState: 'flying',
      throttleLevel: 0.8,
      speed: 120,
      isStalling: true,
      recoveredFromStall: false,
      firedAfterRecovery: false,
    })).toBe('STALL - DIVE');
  });

  it('celebrates recovery before asking for a shot', () => {
    expect(resolveFlightLabCue({
      planeState: 'flying',
      throttleLevel: 0.8,
      speed: 520,
      isStalling: false,
      recoveredFromStall: true,
      firedAfterRecovery: false,
    })).toBe('RECOVERED - FIRE');
  });

  it('marks the drill complete after a stable recovery shot', () => {
    expect(resolveFlightLabCue({
      planeState: 'flying',
      throttleLevel: 0.8,
      speed: 520,
      isStalling: false,
      recoveredFromStall: true,
      firedAfterRecovery: true,
    })).toBe('DRILL COMPLETE');
  });
});
