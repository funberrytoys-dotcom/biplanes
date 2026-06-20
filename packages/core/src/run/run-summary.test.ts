import { describe, it, expect } from 'vitest';
import { createRunState, recordPick, recordSkip, advanceWave } from './run-state.js';
import { buildRunSummary } from './run-summary.js';

describe('buildRunSummary', () => {
  it('reports wave reached, totals, and the chosen outcome', () => {
    let run = createRunState();           // wave 1
    run = recordPick(run, 'cluster_bomb'); // bombardier
    run = advanceWave(run);               // wave 2
    run = recordSkip(run);
    run = advanceWave(run);               // wave 3
    const s = buildRunSummary(run, 'lost', { kills: 12, timeSec: 87.5 });
    expect(s.outcome).toBe('lost');
    expect(s.waveReached).toBe(3);
    expect(s.totalWaves).toBe(15);
    expect(s.totalPicks).toBe(1);
    expect(s.skips).toBe(1);
    expect(s.kills).toBe(12);
    expect(s.timeSec).toBeCloseTo(87.5);
  });

  it('groups picks by branch with human titles and sorts branches by affinity desc', () => {
    let run = createRunState();
    run = recordPick(run, 'cluster_bomb'); // bombardier
    run = recordPick(run, 'flame_trail');  // bombardier
    run = recordPick(run, 'drone_wingman');// commander
    const s = buildRunSummary(run, 'won', { kills: 40, timeSec: 200 });
    // Highest affinity branch first.
    const top = s.branches[0]!;
    expect(top.branch).toBe('bombardier');
    expect(top.affinity).toBe(2);
    expect(top.pickTitles).toContain('Тяжёлые БЧ');
    expect(top.pickTitles).toContain('Огненный след');
    const commander = s.branches.find(b => b.branch === 'commander')!;
    expect(commander.pickTitles).toEqual(['Ведомый дрон']);
    // Always one entry per branch (4).
    expect(s.branches).toHaveLength(4);
  });

  it('reports keystone tier per branch from affinity (3/6/9)', () => {
    let run = createRunState();
    for (let i = 0; i < 3; i++) run = recordPick(run, 'damage_plus_25'); // assault x3 (maxStacks 4)
    const s = buildRunSummary(run, 'won', { kills: 1, timeSec: 1 });
    const assault = s.branches.find(b => b.branch === 'assault')!;
    expect(assault.affinity).toBe(3);
    expect(assault.keystoneTier).toBe(1);
  });
});
