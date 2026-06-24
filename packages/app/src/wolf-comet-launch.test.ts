import { describe, it, expect } from 'vitest';
import { resolveWolfCometLaunch, type WolfCometLaunchInput } from './wolf-comet-launch.js';

const base: WolfCometLaunchInput = {
  reachedBridge: false,
  turretsTotal: 10,
  turretsDead: 0,
  bridgeDestroyed: false,
  propellerDestroyed: false,
  firedApproach: false,
  firedHalfTurrets: false,
  firedBoss: false,
};

describe('resolveWolfCometLaunch — Wolf Comet deck-launch milestones', () => {
  it('fires nothing at the start', () => {
    expect(resolveWolfCometLaunch(base)).toEqual({ approach: false, halfTurrets: false, boss: false });
  });

  it('launches the first plane when the player reaches the bridge', () => {
    expect(resolveWolfCometLaunch({ ...base, reachedBridge: true }).approach).toBe(true);
  });

  it('does not re-launch the approach plane once it has fired', () => {
    expect(resolveWolfCometLaunch({ ...base, reachedBridge: true, firedApproach: true }).approach).toBe(false);
  });

  it('launches two planes at exactly 50% turrets destroyed (even count)', () => {
    expect(resolveWolfCometLaunch({ ...base, turretsTotal: 10, turretsDead: 4 }).halfTurrets).toBe(false);
    expect(resolveWolfCometLaunch({ ...base, turretsTotal: 10, turretsDead: 5 }).halfTurrets).toBe(true);
  });

  it('uses ceil for odd turret counts (9 turrets → 5 dead)', () => {
    expect(resolveWolfCometLaunch({ ...base, turretsTotal: 9, turretsDead: 4 }).halfTurrets).toBe(false);
    expect(resolveWolfCometLaunch({ ...base, turretsTotal: 9, turretsDead: 5 }).halfTurrets).toBe(true);
  });

  it('does not re-launch the half-turret wave once fired', () => {
    expect(resolveWolfCometLaunch({ ...base, turretsDead: 8, firedHalfTurrets: true }).halfTurrets).toBe(false);
  });

  it('launches the boss only when BOTH the bridge and the propeller are destroyed', () => {
    expect(resolveWolfCometLaunch({ ...base, bridgeDestroyed: true, propellerDestroyed: false }).boss).toBe(false);
    expect(resolveWolfCometLaunch({ ...base, bridgeDestroyed: false, propellerDestroyed: true }).boss).toBe(false);
    expect(resolveWolfCometLaunch({ ...base, bridgeDestroyed: true, propellerDestroyed: true }).boss).toBe(true);
  });

  it('does not re-launch the boss once fired', () => {
    expect(resolveWolfCometLaunch({ ...base, bridgeDestroyed: true, propellerDestroyed: true, firedBoss: true }).boss).toBe(false);
  });

  it('never fires the half-turret wave when there are no turrets', () => {
    expect(resolveWolfCometLaunch({ ...base, turretsTotal: 0, turretsDead: 0 }).halfTurrets).toBe(false);
  });
});
