import { describe, expect, it } from 'vitest';
import { getGunfeelLabShotAt } from './gunfeel-lab.js';

describe('getGunfeelLabShotAt', () => {
  it('fires a visible machine-gun burst early in each cycle', () => {
    expect(getGunfeelLabShotAt(0.05)).toEqual({ fire: true, heavy: false });
    expect(getGunfeelLabShotAt(0.17)).toEqual({ fire: true, heavy: false });
    expect(getGunfeelLabShotAt(0.29)).toEqual({ fire: true, heavy: false });
  });

  it('leaves a quiet beat between bursts', () => {
    expect(getGunfeelLabShotAt(0.62)).toEqual({ fire: false, heavy: false });
  });

  it('adds one heavy punctuation shot near the end of the cycle', () => {
    expect(getGunfeelLabShotAt(1.04)).toEqual({ fire: true, heavy: true });
  });
});
