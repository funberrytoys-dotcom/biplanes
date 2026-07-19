import { describe, expect, it } from 'vitest';
import {
  hintSeenKey,
  MAX_HINT_SEC,
  resolveFirstTimeHint,
  type FirstTimeHintInput,
} from './first-time-hints.js';

const base: FirstTimeHintInput = {
  elapsedSec: 1,
  airborne: false,
  hasTurned: false,
  hasDived: false,
  touch: true,
};

describe('first-time hints', () => {
  it('first tells the player to give gas and take off', () => {
    const r = resolveFirstTimeHint(base);
    expect(r.text).toMatch(/ГАЗ/);
    expect(r.done).toBe(false);
  });

  it('once airborne, tells the player how to turn', () => {
    const r = resolveFirstTimeHint({ ...base, airborne: true });
    expect(r.text).toMatch(/ПОВОРОТ/);
  });

  it('after turning, teaches diving to keep speed', () => {
    const r = resolveFirstTimeHint({ ...base, airborne: true, hasTurned: true });
    expect(r.text).toMatch(/ПИКИРУЙ/);
  });

  it('phrases the gas hint for keyboard when not on a touch device', () => {
    expect(resolveFirstTimeHint({ ...base, touch: false }).text).toMatch(/W/);
  });

  it('is done (and silent) once all milestones are reached', () => {
    const r = resolveFirstTimeHint({ ...base, airborne: true, hasTurned: true, hasDived: true });
    expect(r.text).toBeNull();
    expect(r.done).toBe(true);
  });

  it('stops nagging after the safety timeout even if milestones are unmet', () => {
    const r = resolveFirstTimeHint({ ...base, elapsedSec: MAX_HINT_SEC + 1 });
    expect(r.done).toBe(true);
    expect(r.text).toBeNull();
  });

  it('uses a per-mode seen key', () => {
    expect(hintSeenKey('arena')).not.toBe(hintSeenKey('run'));
  });
});
