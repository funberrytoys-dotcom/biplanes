import { UPGRADE_DEFS } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';
import { BRANCHES, BRANCH_LABEL, branchOfUpgrade, keystoneTier } from './branches.js';
import { RUN_WAVE_COUNT } from './run-waves.js';
import type { RunState } from './run-state.js';

export interface RunSummaryBranch {
  branch: Branch;
  label: string;
  affinity: number;
  keystoneTier: number;
  pickTitles: string[];
}

export interface RunSummaryStats {
  kills: number;
  timeSec: number;
}

export interface RunSummary {
  outcome: 'won' | 'lost';
  waveReached: number;
  totalWaves: number;
  totalPicks: number;
  skips: number;
  kills: number;
  timeSec: number;
  branches: RunSummaryBranch[]; // one per branch, sorted by affinity desc
}

const TITLE_BY_ID: Record<string, string> = Object.fromEntries(
  UPGRADE_DEFS.map(d => [d.id, d.title]),
);

export function buildRunSummary(
  run: RunState,
  outcome: 'won' | 'lost',
  stats: RunSummaryStats,
): RunSummary {
  const branches: RunSummaryBranch[] = BRANCHES.map(branch => ({
    branch,
    label: BRANCH_LABEL[branch],
    affinity: run.affinity[branch],
    keystoneTier: keystoneTier(run.affinity[branch]),
    pickTitles: run.picks
      .filter(id => branchOfUpgrade(id) === branch)
      .map(id => TITLE_BY_ID[id] ?? id),
  })).sort((a, b) => b.affinity - a.affinity);

  return {
    outcome,
    waveReached: run.wave,
    totalWaves: RUN_WAVE_COUNT,
    totalPicks: run.picks.length,
    skips: run.skips,
    kills: stats.kills,
    timeSec: stats.timeSec,
    branches,
  };
}
