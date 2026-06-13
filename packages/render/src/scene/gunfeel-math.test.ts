import { describe, expect, it } from 'vitest';
import { resolveGunfeelImpact, resolveGunfeelShot, shouldApplyImpactCamera } from './gunfeel-math.js';

describe('resolveGunfeelShot', () => {
  it('pushes recoil opposite the shot direction', () => {
    const shot = resolveGunfeelShot({
      ownerFaction: 'player',
      headingRad: 0,
      isHeavy: false,
    });

    expect(shot.recoil.x).toBeLessThan(0);
    expect(Math.abs(shot.recoil.y)).toBeLessThan(0.001);
  });

  it('makes heavy cannon shots punchier than machine gun shots', () => {
    const machineGun = resolveGunfeelShot({
      ownerFaction: 'player',
      headingRad: 0,
      isHeavy: false,
    });
    const heavy = resolveGunfeelShot({
      ownerFaction: 'player',
      headingRad: 0,
      isHeavy: true,
    });

    expect(heavy.flashScale).toBeGreaterThan(machineGun.flashScale);
    expect(heavy.cameraShake).toBeGreaterThan(machineGun.cameraShake);
    expect(Math.abs(heavy.recoil.x)).toBeGreaterThan(Math.abs(machineGun.recoil.x));
  });

  it('keeps enemy shots visible but less camera-invasive than player shots', () => {
    const playerShot = resolveGunfeelShot({
      ownerFaction: 'player',
      headingRad: Math.PI / 2,
      isHeavy: false,
    });
    const enemyShot = resolveGunfeelShot({
      ownerFaction: 'enemy',
      headingRad: Math.PI / 2,
      isHeavy: false,
    });

    expect(enemyShot.flashScale).toBeGreaterThan(0);
    expect(enemyShot.cameraShake).toBeLessThan(playerShot.cameraShake);
    expect(enemyShot.cameraPunch).toBeLessThan(playerShot.cameraPunch);
  });
});

describe('resolveGunfeelImpact', () => {
  it('throws sparks away from the incoming bullet direction', () => {
    const impact = resolveGunfeelImpact({
      incomingHeadingRad: 0,
      isHeavy: false,
      killed: false,
    });

    expect(impact.sparkDirection.x).toBeGreaterThan(0);
    expect(Math.abs(impact.sparkDirection.y)).toBeLessThan(0.001);
  });

  it('makes heavy impacts louder than normal hits', () => {
    const normal = resolveGunfeelImpact({
      incomingHeadingRad: 0,
      isHeavy: false,
      killed: false,
    });
    const heavy = resolveGunfeelImpact({
      incomingHeadingRad: 0,
      isHeavy: true,
      killed: false,
    });

    expect(heavy.sparkCount).toBeGreaterThan(normal.sparkCount);
    expect(heavy.flashRadius).toBeGreaterThan(normal.flashRadius);
    expect(heavy.cameraShake).toBeGreaterThan(normal.cameraShake);
  });

  it('makes killing hits land harder than ordinary impacts', () => {
    const normal = resolveGunfeelImpact({
      incomingHeadingRad: Math.PI / 4,
      isHeavy: false,
      killed: false,
    });
    const killed = resolveGunfeelImpact({
      incomingHeadingRad: Math.PI / 4,
      isHeavy: false,
      killed: true,
    });

    expect(killed.hitPauseFrames).toBeGreaterThan(normal.hitPauseFrames);
    expect(killed.cameraShake).toBeGreaterThan(normal.cameraShake);
  });
});

describe('shouldApplyImpactCamera', () => {
  it('keeps ordinary enemy hits from shaking the camera', () => {
    expect(shouldApplyImpactCamera({ targetFaction: 'enemy', killed: false })).toBe(false);
  });

  it('keeps player damage and kills punchy', () => {
    expect(shouldApplyImpactCamera({ targetFaction: 'player', killed: false })).toBe(true);
    expect(shouldApplyImpactCamera({ targetFaction: 'enemy', killed: true })).toBe(true);
  });
});
