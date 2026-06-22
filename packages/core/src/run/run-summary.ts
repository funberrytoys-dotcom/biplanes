import type { Branch } from './branches.js';
import { BRANCHES, branchOfUpgrade, keystoneTier } from './branches.js';
import { RUN_WAVE_COUNT } from './run-waves.js';
import type { RunState } from './run-state.js';
import { factionUpgradePool, FACTION_BRANCH_LABEL, type RunFaction } from './faction.js';

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

export function buildRunSummary(
  run: RunState,
  outcome: 'won' | 'lost',
  stats: RunSummaryStats,
  faction: RunFaction = 'sov',
): RunSummary {
  // Resolve titles + branch labels from the player's FACTION pool, so an Алые Шакалы
  // debrief shows Jackal card names ('Железный дождь', «Ведомый», …) and Jackal branch
  // labels ('Налётчик'…) instead of С.О.В. names or the raw 'wingman' token.
  const titleById: Record<string, string> = Object.fromEntries(
    factionUpgradePool(faction).map(d => [d.id, d.title]),
  );
  const branchLabel = FACTION_BRANCH_LABEL[faction];
  const branches: RunSummaryBranch[] = BRANCHES.map(branch => ({
    branch,
    label: branchLabel[branch],
    affinity: run.affinity[branch],
    keystoneTier: keystoneTier(run.affinity[branch]),
    pickTitles: run.picks
      .filter(id => branchOfUpgrade(id) === branch)
      .map(id => titleById[id] ?? id),
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
