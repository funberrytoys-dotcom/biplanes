import { describe, expect, it } from 'vitest';
import { resolveFlightAudioMix } from './game-audio-cues.js';

function input(overrides: Partial<Parameters<typeof resolveFlightAudioMix>[0]> = {}) {
  return {
    gameRunning: true,
    choicesShowing: false,
    playerAlive: true,
    playerState: 'flying',
    speed: 680,
    verticalVelocity: 0,
    throttleLevel: 1,
    boostActive: false,
    boostHeat: 0,
    noThrottleSec: 0,
    stalling: false,
    ...overrides,
  };
}

describe('resolveFlightAudioMix', () => {
  it('keeps the engine silent outside active flight', () => {
    const mix = resolveFlightAudioMix(input({ gameRunning: false }));

    expect(mix.engineGain).toBe(0);
    expect(mix.boostGain).toBe(0);
    expect(mix.diveGain).toBe(0);
    expect(mix.warning).toBeNull();
  });

  it('raises engine rate and volume with throttle and speed', () => {
    const idle = resolveFlightAudioMix(input({ speed: 180, throttleLevel: 0.2 }));
    const fast = resolveFlightAudioMix(input({ speed: 680, throttleLevel: 1 }));

    expect(fast.engineGain).toBeGreaterThan(idle.engineGain);
    expect(fast.engineRate).toBeGreaterThan(idle.engineRate);
  });

  it('adds a boost layer while boost is active', () => {
    const mix = resolveFlightAudioMix(input({ boostActive: true }));

    expect(mix.boostGain).toBeGreaterThan(0);
  });

  it('adds a dive layer while the plane is falling fast', () => {
    const level = resolveFlightAudioMix(input({ verticalVelocity: 0 }));
    const diving = resolveFlightAudioMix(input({ verticalVelocity: 680 }));

    expect(level.diveGain).toBe(0);
    expect(diving.diveGain).toBeGreaterThan(0);
  });

  it('prioritizes stall and engine warnings', () => {
    expect(resolveFlightAudioMix(input({ stalling: true, boostActive: true, boostHeat: 0.9 })).warning).toBe('stall');
    expect(resolveFlightAudioMix(input({ boostActive: true, boostHeat: 0.9 })).warning).toBe('overheat');
    expect(resolveFlightAudioMix(input({ noThrottleSec: 2.2 })).warning).toBe('engine');
  });
});
