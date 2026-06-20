import { describe, it, expect } from 'vitest';
import { resolveRunFlow, type RunFlowInput } from './run-flow.js';

function input(over: Partial<RunFlowInput>): RunFlowInput {
  return {
    phase: 'duel',
    wave: 1,
    enemyAliveCount: 3,
    playerDead: false,
    bossDefeated: false,
    pickResolved: false,
    pickDelaySec: 0,
    requiredPickDelaySec: 2,
    ...over,
  };
}

describe('resolveRunFlow', () => {
  it('does nothing mid-duel while enemies are alive', () => {
    const r = resolveRunFlow(input({ enemyAliveCount: 2 }));
    expect(r.phase).toBe('duel');
    expect(r.shouldOfferPick).toBe(false);
    expect(r.shouldAdvanceWave).toBe(false);
    expect(r.outcome).toBeNull();
  });

  it('clearing a normal wave goes to pickDelay', () => {
    const r = resolveRunFlow(input({ phase: 'duel', wave: 3, enemyAliveCount: 0 }));
    expect(r.phase).toBe('pickDelay');
    expect(r.outcome).toBeNull();
  });

  it('pickDelay elapsing offers the pick', () => {
    const r = resolveRunFlow(input({ phase: 'pickDelay', pickDelaySec: 2, requiredPickDelaySec: 2 }));
    expect(r.phase).toBe('pick');
    expect(r.shouldOfferPick).toBe(true);
  });

  it('does not offer the pick before the delay elapses', () => {
    const r = resolveRunFlow(input({ phase: 'pickDelay', pickDelaySec: 1, requiredPickDelaySec: 2 }));
    expect(r.phase).toBe('pickDelay');
    expect(r.shouldOfferPick).toBe(false);
  });

  it('resolving a pick advances to the next wave', () => {
    const r = resolveRunFlow(input({ phase: 'pick', wave: 3, pickResolved: true }));
    expect(r.phase).toBe('duel');
    expect(r.wave).toBe(4);
    expect(r.shouldAdvanceWave).toBe(true);
  });

  it('defeating the boss on wave 15 completes the run as a win', () => {
    const r = resolveRunFlow(input({ phase: 'duel', wave: 15, enemyAliveCount: 0, bossDefeated: true }));
    expect(r.phase).toBe('complete');
    expect(r.outcome).toBe('won');
    expect(r.shouldOfferPick).toBe(false);
  });

  it('does NOT win wave 15 just because no enemies are alive yet (boss not spawned)', () => {
    // Wave 15 starts with zero escorts; without bossDefeated the run must keep going.
    const r = resolveRunFlow(input({ phase: 'duel', wave: 15, enemyAliveCount: 0, bossDefeated: false }));
    expect(r.phase).toBe('duel');
    expect(r.outcome).toBeNull();
    expect(r.shouldOfferPick).toBe(false);
  });

  it('player death fails the run from any active phase (one life)', () => {
    for (const phase of ['duel', 'pickDelay', 'pick'] as const) {
      const r = resolveRunFlow(input({ phase, playerDead: true }));
      expect(r.phase).toBe('failed');
      expect(r.outcome).toBe('lost');
    }
  });

  it('does not resurrect a finished run when playerDead flips', () => {
    const won = resolveRunFlow(input({ phase: 'complete', playerDead: true }));
    expect(won.phase).toBe('complete');
    expect(won.outcome).toBeNull();
  });
});
