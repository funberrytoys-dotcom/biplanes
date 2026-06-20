# «Забег» (§13) — Run Mode Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless core engine for the new "Забег" run mode (15 waves, one life, pick after each wave, 4 build branches with affinity, reroll/skip, run summary) — fully unit-tested, with zero rendering or app wiring yet.

**Architecture:** A new self-contained module `packages/core/src/run/` holds the run as pure, deterministic data + pure functions, mirroring the existing arena pattern (`systems/arena-waves.ts` + `arena-director.ts`'s pure `resolveArenaDuelFlow`). The run engine knows nothing about Pixi, the DOM, or `main.ts`; it only reads/returns plain objects. The existing 26 upgrades are tagged into 4 branches; affinity drives a soft-weighted pick offer. App wiring (menu entry, pick screen, run-summary screen, driving the resolver in `main.ts`'s ticker) is **Plan 2** and deliberately out of scope here, per "headless core + thin render".

**Tech Stack:** TypeScript (NodeNext ESM, `.js` import suffixes), Vitest, pnpm workspaces. No new dependencies.

---

## Plan series (decomposition of spec §13)

§13 is multiple subsystems. It is split into independently-shippable plans, built in order. Owner (Сергей) confirmed building §13 in full; he tests after the run is playable (end of Plan 2).

1. **Plan 1 — Run engine (THIS PLAN).** Headless `run/` module: branches, 15-wave schedule, run state + affinity, flow resolver, affinity-weighted pick offer, run summary. Ships as passing unit tests. Not yet playable.
2. **Plan 2 — Run wiring (app/UI).** Menu "ЗАБЕГ" option (second, after "АРЕНА"), `startRun()` in `main.ts`, drive `resolveRunFlow` in the ticker, between-wave pick screen (reuse level-up screen) with reroll/skip buttons, run-summary screen on death/win, reuse the arena boss on wave 15. **First playable run on existing upgrades.**
3. **Plan 3 — 4-branch upgrade pools + keystones (§13.1–13.2).** Full per-branch upgrade content, affinity-threshold keystones, evolutions.
4. **Plan 4 — Bombardier zones (§13.1.2).** New core gameplay (напалм/газ/мины) + render VFX. Largest new system.
5. **Plan 5 — Boss «Шрам» (§13 finale).** The bespoke wave-15 boss replacing the placeholder arena boss.
6. **Plan 6 — Balance pass (§13.4).** Enemy curve waves 1–14 + boss, power-budget tuning against the spec tables.

Each later plan gets its own spec-review → plan → execution cycle. This document covers Plan 1 only.

---

## File Structure (Plan 1)

All new files under `packages/core/src/run/`. Each file = one responsibility, each with a colocated `*.test.ts` (matches the existing core convention, e.g. `systems/arena-waves.ts` + `.test.ts`).

- `run/branches.ts` — the 4 branches (`Branch` type, labels), the `UpgradeId → Branch` map for all 26 existing upgrades, and keystone thresholds (3/6/9). Pure data + lookups.
- `run/run-waves.ts` — run length (15), per-wave enemy-count schedule, `isBossWave`. Pure constants + helpers.
- `run/run-state.ts` — `RunState` (current wave, picks, skips, reroll budget, per-branch affinity) + pure transitions (`createRunState`, `recordPick`, `recordSkip`, `recordReroll`, `advanceWave`).
- `run/run-flow.ts` — `resolveRunFlow`, the pure phase resolver (duel → pickDelay → pick → advance / boss-clear → complete / death → failed). Mirrors `resolveArenaDuelFlow`.
- `run/pick-offer.ts` — `rollRunPickChoices`: filter the upgrade pool (same stack/evolution rules as the arena) and offer 3 choices weighted toward high-affinity branches (soft-specialization §13.3). Deterministic.
- `run/run-summary.ts` — `buildRunSummary`: turn a finished `RunState` + run stats into the data the run-summary screen will render (wave reached, picks grouped by branch, affinity, keystone tier).
- `run/index-additions` — re-export all of the above from `packages/core/src/index.ts`.

---

### Task 1: Branches & upgrade tagging

**Files:**
- Create: `packages/core/src/run/branches.ts`
- Test: `packages/core/src/run/branches.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/branches.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UPGRADE_DEFS } from '../upgrades/upgrade-pool.js';
import {
  BRANCHES,
  BRANCH_LABEL,
  UPGRADE_BRANCH,
  branchOfUpgrade,
  KEYSTONE_THRESHOLDS,
  keystoneTier,
} from './branches.js';

describe('branches', () => {
  it('has the four design branches with Russian labels', () => {
    expect(BRANCHES).toEqual(['assault', 'bombardier', 'commander', 'hull']);
    expect(BRANCH_LABEL.assault).toBe('Штурмовик');
    expect(BRANCH_LABEL.bombardier).toBe('Бомбардир');
    expect(BRANCH_LABEL.commander).toBe('Командир звена');
    expect(BRANCH_LABEL.hull).toBe('Корпус и сила');
  });

  it('tags every existing upgrade to exactly one branch', () => {
    for (const def of UPGRADE_DEFS) {
      const branch = branchOfUpgrade(def.id);
      expect(BRANCHES).toContain(branch);
    }
    // No stray ids in the map that are not real upgrades.
    const realIds = new Set(UPGRADE_DEFS.map(d => d.id));
    for (const id of Object.keys(UPGRADE_BRANCH)) {
      expect(realIds.has(id as never)).toBe(true);
    }
  });

  it('maps a few representative upgrades to the expected branch', () => {
    expect(branchOfUpgrade('gatling_evolution')).toBe('assault');
    expect(branchOfUpgrade('cluster_bomb')).toBe('bombardier');
    expect(branchOfUpgrade('drone_wingman')).toBe('commander');
    expect(branchOfUpgrade('reinforced_struts')).toBe('hull');
  });

  it('unlocks keystone tiers at 3/6/9 affinity', () => {
    expect(KEYSTONE_THRESHOLDS).toEqual([3, 6, 9]);
    expect(keystoneTier(0)).toBe(0);
    expect(keystoneTier(2)).toBe(0);
    expect(keystoneTier(3)).toBe(1);
    expect(keystoneTier(5)).toBe(1);
    expect(keystoneTier(6)).toBe(2);
    expect(keystoneTier(9)).toBe(3);
    expect(keystoneTier(14)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/branches.test.ts`
Expected: FAIL — `Cannot find module './branches.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/branches.ts`:

```typescript
import type { UpgradeId } from '../upgrades/upgrade-pool.js';

export type Branch = 'assault' | 'bombardier' | 'commander' | 'hull';

export const BRANCHES: readonly Branch[] = ['assault', 'bombardier', 'commander', 'hull'] as const;

/** Russian display labels per design spec §13. */
export const BRANCH_LABEL: Record<Branch, string> = {
  assault: 'Штурмовик',
  bombardier: 'Бомбардир',
  commander: 'Командир звена',
  hull: 'Корпус и сила',
};

/**
 * Every existing upgrade tagged to exactly one §13 branch. Typed as
 * Record<UpgradeId, Branch>, so adding/removing an upgrade id is a compile error
 * here until this map is updated — keeps the tagging exhaustive.
 */
export const UPGRADE_BRANCH: Record<UpgradeId, Branch> = {
  // Штурмовик — front-DPS / guns
  damage_plus_25: 'assault',
  damage_plus_50: 'assault',
  fire_rate_plus_25: 'assault',
  fire_rate_plus_50: 'assault',
  tracer_belt: 'assault',
  piercing_bullets: 'assault',
  heavy_cannon: 'assault',
  multishot: 'assault',
  gatling_evolution: 'assault',
  bullet_storm: 'assault',
  // Бомбардир — zonal / rockets / fire
  heavy_bomb: 'bombardier',
  cluster_bomb: 'bombardier',
  homing_rocket: 'bombardier',
  flame_trail: 'bombardier',
  fire_screen: 'bombardier',
  quick_salvo: 'bombardier',
  // Командир звена — drones
  drone_wingman: 'commander',
  chico_wing: 'commander',
  // Корпус и сила — survival / passive
  hp_plus_25: 'hull',
  hp_plus_50: 'hull',
  magnet_range_plus: 'hull',
  reinforced_struts: 'hull',
  coolant_injector: 'hull',
  boost_supercharger: 'hull',
  redline_engine: 'hull',
  lifesteal: 'hull',
};

export function branchOfUpgrade(id: UpgradeId): Branch {
  return UPGRADE_BRANCH[id];
}

/** Affinity thresholds that unlock keystone tiers (design §13.0 / §13.3). */
export const KEYSTONE_THRESHOLDS = [3, 6, 9] as const;

/** How many keystone tiers a given branch affinity has unlocked (0..3). */
export function keystoneTier(affinity: number): number {
  let tier = 0;
  for (const t of KEYSTONE_THRESHOLDS) if (affinity >= t) tier++;
  return tier;
}
```

- [ ] **Step 4: Run test + typecheck to verify they pass**

Run: `pnpm --filter @biplanes/core test src/run/branches.test.ts`
Expected: PASS (4 tests).

Run: `pnpm --filter @biplanes/core typecheck`
Expected: PASS — confirms `Record<UpgradeId, Branch>` covers every `UpgradeId` (a missing id fails compilation here).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/branches.ts packages/core/src/run/branches.test.ts
git commit -m "feat(run): tag the 26 upgrades into the 4 design branches + keystone thresholds"
```

---

### Task 2: 15-wave schedule

**Files:**
- Create: `packages/core/src/run/run-waves.ts`
- Test: `packages/core/src/run/run-waves.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/run-waves.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  RUN_WAVE_COUNT,
  RUN_WAVE_ENEMY_COUNTS,
  isBossWave,
  runEnemyCountForWave,
} from './run-waves.js';

describe('run-waves', () => {
  it('is a 15-wave run', () => {
    expect(RUN_WAVE_COUNT).toBe(15);
    expect(RUN_WAVE_ENEMY_COUNTS).toHaveLength(15);
  });

  it('treats only wave 15 as the boss wave', () => {
    for (let w = 1; w <= 14; w++) expect(isBossWave(w)).toBe(false);
    expect(isBossWave(15)).toBe(true);
  });

  it('returns the per-wave enemy count, 0 outside the run', () => {
    expect(runEnemyCountForWave(1)).toBe(RUN_WAVE_ENEMY_COUNTS[0]);
    expect(runEnemyCountForWave(14)).toBe(RUN_WAVE_ENEMY_COUNTS[13]);
    expect(runEnemyCountForWave(0)).toBe(0);
    expect(runEnemyCountForWave(16)).toBe(0);
  });

  it('ramps enemy counts non-decreasing across waves 1..14', () => {
    for (let w = 2; w <= 14; w++) {
      expect(runEnemyCountForWave(w)).toBeGreaterThanOrEqual(runEnemyCountForWave(w - 1));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/run-waves.test.ts`
Expected: FAIL — `Cannot find module './run-waves.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/run-waves.ts`:

```typescript
/** A run is 15 waves, one life. Wave 15 is the boss. Design §13.0. */
export const RUN_WAVE_COUNT = 15;

/**
 * Enemy count per wave (index 0 = wave 1). Draft curve, calibration stage — the
 * real numbers come from §13.4 in the balance plan (Plan 6). Wave 15 is the boss,
 * handled separately, so its escort count here is 0 (solo boss for the skeleton).
 */
export const RUN_WAVE_ENEMY_COUNTS: readonly number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 0,
] as const;

export function isBossWave(wave: number): boolean {
  return wave === RUN_WAVE_COUNT;
}

export function runEnemyCountForWave(wave: number): number {
  if (wave < 1 || wave > RUN_WAVE_COUNT) return 0;
  return RUN_WAVE_ENEMY_COUNTS[wave - 1]!;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/core test src/run/run-waves.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/run-waves.ts packages/core/src/run/run-waves.test.ts
git commit -m "feat(run): 15-wave schedule with boss on wave 15 (draft enemy curve)"
```

---

### Task 3: Run state + affinity transitions

**Files:**
- Create: `packages/core/src/run/run-state.ts`
- Test: `packages/core/src/run/run-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/run-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  RUN_REROLLS,
  createRunState,
  emptyAffinity,
  recordPick,
  recordSkip,
  recordReroll,
  advanceWave,
} from './run-state.js';

describe('run-state', () => {
  it('starts on wave 1 with full reroll budget and zero affinity', () => {
    const run = createRunState();
    expect(run.wave).toBe(1);
    expect(run.picks).toEqual([]);
    expect(run.skips).toBe(0);
    expect(run.rerollsRemaining).toBe(RUN_REROLLS);
    expect(run.affinity).toEqual(emptyAffinity());
    expect(run.affinity.assault).toBe(0);
  });

  it('recordPick appends the pick and bumps its branch affinity, without mutating', () => {
    const run = createRunState();
    const after = recordPick(run, 'gatling_evolution'); // assault
    expect(after.picks).toEqual(['gatling_evolution']);
    expect(after.affinity.assault).toBe(1);
    expect(after.affinity.bombardier).toBe(0);
    // immutability
    expect(run.picks).toEqual([]);
    expect(run.affinity.assault).toBe(0);
  });

  it('accumulates affinity across multiple picks in the same branch', () => {
    let run = createRunState();
    run = recordPick(run, 'cluster_bomb'); // bombardier
    run = recordPick(run, 'flame_trail');  // bombardier
    expect(run.affinity.bombardier).toBe(2);
    expect(run.picks).toEqual(['cluster_bomb', 'flame_trail']);
  });

  it('recordSkip increments skips and grants no affinity', () => {
    const run = recordSkip(createRunState());
    expect(run.skips).toBe(1);
    expect(run.picks).toEqual([]);
    expect(run.affinity).toEqual(emptyAffinity());
  });

  it('recordReroll spends one reroll and throws when none remain', () => {
    const run = recordReroll(createRunState());
    expect(run.rerollsRemaining).toBe(RUN_REROLLS - 1);
    expect(() => recordReroll(run)).toThrow(/no rerolls/i);
  });

  it('advanceWave moves to the next wave', () => {
    const run = advanceWave(createRunState());
    expect(run.wave).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/run-state.test.ts`
Expected: FAIL — `Cannot find module './run-state.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/run-state.ts`:

```typescript
import type { UpgradeId } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';
import { BRANCHES, branchOfUpgrade } from './branches.js';

/** Reroll budget per run (§13.4: one reroll per забег). */
export const RUN_REROLLS = 1;

/** One run = 15 waves, one life. Tracks progression + build affinity. Design §13. */
export interface RunState {
  wave: number;                      // current wave, 1..15
  picks: UpgradeId[];                // upgrades chosen this run, in order
  skips: number;                     // picks the player chose to skip
  rerollsRemaining: number;          // reroll budget left
  affinity: Record<Branch, number>;  // +1 per pick in that branch
}

export function emptyAffinity(): Record<Branch, number> {
  const a = {} as Record<Branch, number>;
  for (const b of BRANCHES) a[b] = 0;
  return a;
}

export function createRunState(): RunState {
  return {
    wave: 1,
    picks: [],
    skips: 0,
    rerollsRemaining: RUN_REROLLS,
    affinity: emptyAffinity(),
  };
}

/** Record an upgrade pick: append it and bump its branch affinity. Pure. */
export function recordPick(run: RunState, id: UpgradeId): RunState {
  const branch = branchOfUpgrade(id);
  return {
    ...run,
    picks: [...run.picks, id],
    affinity: { ...run.affinity, [branch]: run.affinity[branch] + 1 },
  };
}

/** Player skipped the pick (no upgrade, no affinity). Pure. */
export function recordSkip(run: RunState): RunState {
  return { ...run, skips: run.skips + 1 };
}

/** Spend one reroll. Throws if none remain (caller gates on rerollsRemaining). Pure. */
export function recordReroll(run: RunState): RunState {
  if (run.rerollsRemaining <= 0) throw new Error('no rerolls remaining');
  return { ...run, rerollsRemaining: run.rerollsRemaining - 1 };
}

/** Advance to the next wave after a pick is resolved. Pure. */
export function advanceWave(run: RunState): RunState {
  return { ...run, wave: run.wave + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/core test src/run/run-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/run-state.ts packages/core/src/run/run-state.test.ts
git commit -m "feat(run): RunState with pure pick/skip/reroll/advance transitions + affinity"
```

---

### Task 4: Run flow resolver

**Files:**
- Create: `packages/core/src/run/run-flow.ts`
- Test: `packages/core/src/run/run-flow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/run-flow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveRunFlow, type RunFlowInput } from './run-flow.js';

function input(over: Partial<RunFlowInput>): RunFlowInput {
  return {
    phase: 'duel',
    wave: 1,
    enemyAliveCount: 3,
    playerDead: false,
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

  it('clearing the boss wave (15) completes the run as a win', () => {
    const r = resolveRunFlow(input({ phase: 'duel', wave: 15, enemyAliveCount: 0 }));
    expect(r.phase).toBe('complete');
    expect(r.outcome).toBe('won');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/run-flow.test.ts`
Expected: FAIL — `Cannot find module './run-flow.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/run-flow.ts`:

```typescript
import { RUN_WAVE_COUNT } from './run-waves.js';

export type RunPhase =
  | 'duel'       // fighting the current wave
  | 'pickDelay'  // brief beat after clearing, before the pick screen
  | 'pick'       // pick screen up, waiting on the player
  | 'complete'   // boss down — run won
  | 'failed';    // player died — run lost

export type RunOutcome = 'won' | 'lost' | null;

export interface RunFlowInput {
  phase: RunPhase;
  wave: number;            // 1..15
  enemyAliveCount: number;
  playerDead: boolean;     // one life — true the moment the player is gone
  pickResolved: boolean;   // player chose or skipped on the pick screen
  pickDelaySec: number;
  requiredPickDelaySec: number;
}

export interface RunFlowResult {
  phase: RunPhase;
  wave: number;
  shouldOfferPick: boolean;
  shouldAdvanceWave: boolean;
  outcome: RunOutcome;
}

function hold(input: RunFlowInput): RunFlowResult {
  return {
    phase: input.phase,
    wave: input.wave,
    shouldOfferPick: false,
    shouldAdvanceWave: false,
    outcome: null,
  };
}

export function resolveRunFlow(input: RunFlowInput): RunFlowResult {
  // One life: death ends the run from any active phase. A finished run is sticky.
  if (input.playerDead && input.phase !== 'failed' && input.phase !== 'complete') {
    return { phase: 'failed', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: 'lost' };
  }

  // Wave cleared.
  if (input.phase === 'duel' && input.enemyAliveCount === 0) {
    if (input.wave >= RUN_WAVE_COUNT) {
      // Boss wave down → run won. No pick after the boss (§13: 14 picks total).
      return { phase: 'complete', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: 'won' };
    }
    return { phase: 'pickDelay', wave: input.wave, shouldOfferPick: false, shouldAdvanceWave: false, outcome: null };
  }

  // Pick beat elapsed → raise the pick screen.
  if (input.phase === 'pickDelay' && input.pickDelaySec >= input.requiredPickDelaySec) {
    return { phase: 'pick', wave: input.wave, shouldOfferPick: true, shouldAdvanceWave: false, outcome: null };
  }

  // Pick resolved (chosen or skipped) → advance to the next wave.
  if (input.phase === 'pick' && input.pickResolved) {
    return { phase: 'duel', wave: input.wave + 1, shouldOfferPick: false, shouldAdvanceWave: true, outcome: null };
  }

  return hold(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/core test src/run/run-flow.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/run-flow.ts packages/core/src/run/run-flow.test.ts
git commit -m "feat(run): resolveRunFlow — pure 15-wave/one-life phase resolver"
```

---

### Task 5: Affinity-weighted pick offer

**Files:**
- Create: `packages/core/src/run/pick-offer.ts`
- Test: `packages/core/src/run/pick-offer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/pick-offer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from '../rng/mulberry32.js';
import { branchOfUpgrade } from './branches.js';
import { emptyAffinity } from './run-state.js';
import { rollRunPickChoices } from './pick-offer.js';

describe('rollRunPickChoices', () => {
  it('offers 3 distinct choices from a fresh pool', () => {
    const rng = createRng(123);
    const choices = rollRunPickChoices([], emptyAffinity(), rng);
    expect(choices).toHaveLength(3);
    const ids = choices.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = rollRunPickChoices([], emptyAffinity(), createRng(42));
    const b = rollRunPickChoices([], emptyAffinity(), createRng(42));
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id));
  });

  it('excludes maxed-out and prereq-locked upgrades (same rules as the arena pool)', () => {
    // gatling_evolution requires damage_plus_50 + fire_rate_plus_50; absent → never offered.
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const choices = rollRunPickChoices([], emptyAffinity(), createRng(i));
      expect(choices.find(c => c.id === 'gatling_evolution')).toBeUndefined();
    }
    // damage_plus_25 has maxStacks 4; taken 4× → excluded.
    const applied = ['damage_plus_25', 'damage_plus_25', 'damage_plus_25', 'damage_plus_25'];
    const choices = rollRunPickChoices(applied, emptyAffinity(), rng);
    expect(choices.find(c => c.id === 'damage_plus_25')).toBeUndefined();
  });

  it('biases the offer toward a high-affinity branch over many rolls', () => {
    const flat = emptyAffinity();
    const skewed = { ...emptyAffinity(), bombardier: 8 };
    const countBombardier = (aff: typeof flat) => {
      let n = 0;
      for (let seed = 0; seed < 400; seed++) {
        const choices = rollRunPickChoices([], aff, createRng(seed));
        n += choices.filter(c => branchOfUpgrade(c.id) === 'bombardier').length;
      }
      return n;
    };
    expect(countBombardier(skewed)).toBeGreaterThan(countBombardier(flat));
  });

  it('tags stackable choices with their next tier numeral', () => {
    // Take damage_plus_25 once; the next offer of it should read "Урон II".
    const choices = rollRunPickChoices(['damage_plus_25'], emptyAffinity(), createRng(5));
    const dmg = choices.find(c => c.id === 'damage_plus_25');
    if (dmg) expect(dmg.title).toMatch(/II/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/pick-offer.test.ts`
Expected: FAIL — `Cannot find module './pick-offer.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/pick-offer.ts`:

```typescript
import { UPGRADE_DEFS, upgradeChoiceTitle, type UpgradeDef } from '../upgrades/upgrade-pool.js';
import type { Branch } from './branches.js';
import { branchOfUpgrade } from './branches.js';

/** The run offer only needs a uniform [0,1) source; createRng's Rng satisfies it. */
export interface PickRng {
  next(): number;
}

/** Each affinity point adds this much selection weight to that branch (§13.3 soft-spec). */
export const AFFINITY_WEIGHT = 0.5;

/**
 * Offer 3 upgrade choices for a run pick, biased toward the player's higher-affinity
 * branches. Same availability rules as the arena pool (stack caps, evolution
 * prerequisites). Deterministic given the rng. Stackable picks get their tier numeral.
 */
export function rollRunPickChoices(
  applied: readonly string[],
  affinity: Record<Branch, number>,
  rng: PickRng,
): UpgradeDef[] {
  const timesTaken = (id: string) => applied.filter(a => a === id).length;

  const available = UPGRADE_DEFS.filter(u => {
    const taken = timesTaken(u.id);
    if (taken >= (u.maxStacks ?? 1)) return false;
    if (u.isEvolution) return u.evolutionRequires!.every(req => applied.includes(req));
    return true;
  });

  const n = Math.min(3, available.length);
  const pool = [...available];
  const out: UpgradeDef[] = [];

  for (let k = 0; k < n; k++) {
    const weights = pool.map(d => 1 + affinity[branchOfUpgrade(d.id)] * AFFINITY_WEIGHT);
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng.next() * total;
    let idx = 0;
    while (idx < weights.length - 1 && r >= weights[idx]!) {
      r -= weights[idx]!;
      idx++;
    }
    const def = pool[idx]!;
    out.push(
      (def.maxStacks ?? 1) > 1
        ? { ...def, title: upgradeChoiceTitle(def, timesTaken(def.id) + 1) }
        : def,
    );
    pool.splice(idx, 1);
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/core test src/run/pick-offer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/pick-offer.ts packages/core/src/run/pick-offer.test.ts
git commit -m "feat(run): affinity-weighted 3-choice pick offer (soft-specialization §13.3)"
```

---

### Task 6: Run summary

**Files:**
- Create: `packages/core/src/run/run-summary.ts`
- Test: `packages/core/src/run/run-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/run-summary.test.ts`:

```typescript
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
    expect(s.branches[0].branch).toBe('bombardier');
    expect(s.branches[0].affinity).toBe(2);
    expect(s.branches[0].pickTitles).toContain('Тяжёлые БЧ');
    expect(s.branches[0].pickTitles).toContain('Огненный след');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/run-summary.test.ts`
Expected: FAIL — `Cannot find module './run-summary.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/run/run-summary.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/core test src/run/run-summary.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/run/run-summary.ts packages/core/src/run/run-summary.test.ts
git commit -m "feat(run): buildRunSummary — run-over data grouped by branch for the summary screen"
```

---

### Task 7: Export the run engine from the core package

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/run/run-engine.public.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/run/run-engine.public.test.ts` — asserts the engine is reachable through the package barrel (what `main.ts` imports in Plan 2):

```typescript
import { describe, it, expect } from 'vitest';
import {
  BRANCHES,
  RUN_WAVE_COUNT,
  createRunState,
  resolveRunFlow,
  rollRunPickChoices,
  buildRunSummary,
  emptyAffinity,
} from '../index.js';

describe('run engine public surface', () => {
  it('re-exports the run engine from the core barrel', () => {
    expect(BRANCHES).toHaveLength(4);
    expect(RUN_WAVE_COUNT).toBe(15);
    expect(typeof createRunState).toBe('function');
    expect(typeof resolveRunFlow).toBe('function');
    expect(typeof rollRunPickChoices).toBe('function');
    expect(typeof buildRunSummary).toBe('function');
    expect(typeof emptyAffinity).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/core test src/run/run-engine.public.test.ts`
Expected: FAIL — named exports (`BRANCHES`, `RUN_WAVE_COUNT`, …) are not found on `../index.js`.

- [ ] **Step 3: Add the barrel exports**

In `packages/core/src/index.ts`, append after the existing `export * from './systems/...'` lines (after line 26's supply-system block):

```typescript
export * from './run/branches.js';
export * from './run/run-waves.js';
export * from './run/run-state.js';
export * from './run/run-flow.js';
export * from './run/pick-offer.js';
export * from './run/run-summary.js';
```

- [ ] **Step 4: Run the full core suite + typecheck**

Run: `pnpm --filter @biplanes/core test`
Expected: PASS — all existing tests plus the new `run/` suites (Tasks 1–7).

Run: `pnpm --filter @biplanes/core typecheck`
Expected: PASS — no type errors across the package.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/run/run-engine.public.test.ts
git commit -m "feat(run): export the run engine from @biplanes/core for app wiring"
```

---

## Self-Review

**Spec coverage (§13 skeleton parts relevant to a headless engine):**
- 15 waves / one life → `RUN_WAVE_COUNT`, `resolveRunFlow` (Tasks 2, 4). ✓
- 14 picks (no pick after boss) → boss-wave clear goes straight to `complete` (Task 4). ✓
- 4 branches → `Branch`, `UPGRADE_BRANCH` (Task 1). ✓
- +1 affinity per pick, soft-specialization → `recordPick` affinity + weighted `rollRunPickChoices` (Tasks 3, 5). ✓
- Keystone thresholds 3/6/9 → `KEYSTONE_THRESHOLDS`, `keystoneTier` (Task 1; surfaced in summary Task 6). ✓
- Reroll (1/run) + skip → `recordReroll`, `recordSkip` (Task 3). ✓
- Run-summary screen data (wave reached, build by branch) → `buildRunSummary` (Task 6). ✓
- **Deferred by design to later plans (not gaps in this plan):** boss «Шрам» bespoke behavior (Plan 5), Bombardier zones (Plan 4), full per-branch upgrade pools + keystone *content/effects* (Plan 3), balance numbers (Plan 6), and ALL app/render wiring incl. menu entry + pick screen + summary screen UI (Plan 2). Keystone *effects* are intentionally absent here — Task 1 only computes the unlocked tier; applying keystone powers is Plan 3.

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. The draft enemy curve in Task 2 is explicitly labelled calibration-stage with its source (§13.4 / Plan 6) — a real value, not a placeholder.

**Type/name consistency:** `Branch`, `branchOfUpgrade`, `keystoneTier`, `emptyAffinity`, `RunState`, `RunPhase`, `RunOutcome`, `RunFlowInput/Result`, `RunSummary*`, `rollRunPickChoices`, `buildRunSummary` are defined once and referenced consistently across tasks and tests. `recordPick`/`recordSkip`/`recordReroll`/`advanceWave` signatures match their test usage. `PickRng.next()` is satisfied by `createRng`'s `Rng` (verified against `rng/mulberry32.ts`). Import suffixes use `.js` per the package's NodeNext/ESM convention.
