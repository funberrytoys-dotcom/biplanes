import { describe, expect, it } from 'vitest';
import { resolveControlsConfig, type StorageLike } from './controls-config.js';

function store(map: Record<string, string>): StorageLike {
  return { getItem: (k) => (k in map ? map[k]! : null) };
}

describe('controls config resolver', () => {
  it('defaults to the fresh input path + classic steering + haptics on', () => {
    const c = resolveControlsConfig(new URLSearchParams(''), null);
    expect(c.freshInput).toBe(true);
    expect(c.screenRelativeSteer).toBe(false);
    expect(c.haptics).toBe(true);
  });

  it('?input=legacy reverts to the old touch path without touching steering', () => {
    const c = resolveControlsConfig(new URLSearchParams('?input=legacy'), null);
    expect(c.freshInput).toBe(false);
    expect(c.screenRelativeSteer).toBe(false);
  });

  it('?steer=screen opts into screen-relative steering only', () => {
    const c = resolveControlsConfig(new URLSearchParams('?steer=screen'), null);
    expect(c.screenRelativeSteer).toBe(true);
    expect(c.freshInput).toBe(true);
  });

  it('?haptics=off disables the stall buzz', () => {
    expect(resolveControlsConfig(new URLSearchParams('?haptics=off'), null).haptics).toBe(false);
  });

  it('?controls=classic is a master rollback: reverts input, steering, haptics, gauge AND eye-comfort', () => {
    const c = resolveControlsConfig(new URLSearchParams('?controls=classic&steer=screen'), null);
    expect(c.freshInput).toBe(false);
    expect(c.screenRelativeSteer).toBe(false);
    expect(c.haptics).toBe(false);
    expect(c.honestGauge).toBe(false);
    expect(c.eyeComfort).toBe(false);
  });

  it('?eyes=vivid turns off the eye-comfort backdrop muting', () => {
    const c = resolveControlsConfig(new URLSearchParams('?eyes=vivid'), null);
    expect(c.eyeComfort).toBe(false);
    expect(c.freshInput).toBe(true);
  });

  it('?gauge=legacy reverts only the throttle-gauge colours', () => {
    const c = resolveControlsConfig(new URLSearchParams('?gauge=legacy'), null);
    expect(c.honestGauge).toBe(false);
    expect(c.freshInput).toBe(true);
  });

  it('reads the localStorage mirror when no URL param is present', () => {
    const c = resolveControlsConfig(new URLSearchParams(''), store({
      'biplanes.input': 'legacy',
      'biplanes.steer': 'screen',
    }));
    expect(c.freshInput).toBe(false);
    expect(c.screenRelativeSteer).toBe(true);
  });

  it('URL param overrides the localStorage mirror', () => {
    const c = resolveControlsConfig(new URLSearchParams('?input=fresh'), store({
      'biplanes.input': 'legacy',
    }));
    expect(c.freshInput).toBe(true);
  });

  it('survives a throwing storage (private mode) and falls back to defaults', () => {
    const throwing: StorageLike = { getItem: () => { throw new Error('blocked'); } };
    const c = resolveControlsConfig(new URLSearchParams(''), throwing);
    expect(c).toEqual({ freshInput: true, screenRelativeSteer: false, haptics: true, honestGauge: true, eyeComfort: true });
  });
});
