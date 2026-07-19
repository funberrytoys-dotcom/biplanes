import { describe, it, expect } from 'vitest';
import { runLostThisFrame } from './run-life.js';

describe('runLostThisFrame — «Забег» one-life rule', () => {
  it('plane shot down with the pilot inside → run lost', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: true, playerAlive: false, pilotOut: false, pilotDead: false,
    })).toBe(true);
  });

  it('parachute bail (plane lost but pilot got out) → run continues', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: true, playerAlive: false, pilotOut: true, pilotDead: false,
    })).toBe(false);
  });

  it('ejected pilot killed under canopy or on foot → run lost', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: false, playerAlive: false, pilotOut: true, pilotDead: true,
    })).toBe(true);
  });

  it('pilot walking home while the plane sits crashed → run continues', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: false, playerAlive: false, pilotOut: true, pilotDead: false,
    })).toBe(false);
  });

  it('plane respawned after the pilot reached the hangar → run continues', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: false, playerAlive: true, pilotOut: false, pilotDead: false,
    })).toBe(false);
  });

  it('ordinary flight → run continues', () => {
    expect(runLostThisFrame({
      prevPlayerAlive: true, playerAlive: true, pilotOut: false, pilotDead: false,
    })).toBe(false);
  });
});
