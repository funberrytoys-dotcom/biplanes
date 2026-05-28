import { describe, expect, it } from 'vitest';
import { resolveMissionOneOutcome } from './mission-one-rules.js';

describe('mission one outcome rules', () => {
  it('fails because of the caravan before showing pilot failure copy', () => {
    expect(resolveMissionOneOutcome({
      phase: 'failure',
      routeProgress: 0.5,
      bossAlive: true,
      playerAlive: false,
      playerState: 'crashed',
      playerScore: 10,
    })).toBe('caravan-lost');
  });

  it('fails when the player plane is lost during the escort', () => {
    expect(resolveMissionOneOutcome({
      phase: 'escort',
      routeProgress: 0.35,
      bossAlive: false,
      playerAlive: false,
      playerState: 'dying',
      playerScore: 4,
    })).toBe('pilot-lost');
  });

  it('wins from mission completion or the readable late boss retreat beat', () => {
    expect(resolveMissionOneOutcome({
      phase: 'victory',
      routeProgress: 1,
      bossAlive: false,
      playerAlive: true,
      playerState: 'flying',
      playerScore: 0,
    })).toBe('victory');

    expect(resolveMissionOneOutcome({
      phase: 'boss',
      routeProgress: 0.94,
      bossAlive: false,
      playerAlive: true,
      playerState: 'flying',
      playerScore: 5,
    })).toBe('victory');
  });

  it('keeps the mission running even when arena score would normally end the run', () => {
    expect(resolveMissionOneOutcome({
      phase: 'ambush',
      routeProgress: 0.7,
      bossAlive: false,
      playerAlive: true,
      playerState: 'flying',
      playerScore: 10,
    })).toBe('running');
  });
});
