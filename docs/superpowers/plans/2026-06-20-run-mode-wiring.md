# «Забег» (§13) — Run Mode Wiring (Plan 2) Implementation Plan

> **For agentic workers:** integration plan over a large existing file (`main.ts`, 3239 lines). Tasks here are coarser than Plan 1 because the work is glue against a god-file that is hard to unit-test; verification is via the browser preview + the pure helpers' unit tests. Checkbox (`- [ ]`) steps track progress.

**Goal:** Make «Забег» actually playable end-to-end on existing upgrades: menu entry, 15-wave one-life loop, between-wave pick screen with **branch + rarity color-coding** and reroll/skip, boss on wave 15, run-summary screen on death/win. Deploy so the owner can play it.

**Architecture decision (key):** «Забег» is implemented as an **arena variant gated by a `runSession: RunState | null`**, NOT a new `runMode`. `main.ts` checks `runMode === 'arena'` in ~40 places for rendering/camera/HUD/physics; reusing that path and branching only on `runSession` at the few real decision points (pick generation, wave/boss schedule, one-life death, win, summary, status branding) is far lower-risk than a parallel mode. Every run-specific branch is guarded by `runSession` so arena/story/labs are byte-for-byte unaffected when `runSession === null`.

**Owner decisions (2026-06-20, delegated, owner asleep):** both modes; «ЗАБЕГ» second in the menu after «АРЕНА»; build §13 in full; death/win → run-summary screen; **color-code upgrades by branch + rarity** (explicit ask). Visual/product calls made by Claude in the existing dieselpunk style.

**Tech Stack:** TypeScript, PixiJS, Vite, pnpm. Run engine from Plan 1 (`@biplanes/core` `run/`). Art via Codex `image_generation`.

---

## Differences the run imposes on the arena path (all gated by `runSession`)

| Concern | Arena (today) | Run (`runSession != null`) |
|---|---|---|
| Waves | score-based, boss at score 14 | exactly 15 waves by `arenaRound`; boss on wave 15 (`isBossWave`) |
| Enemy count/wave | `arenaEnemyCountForRound` | `runEnemyCountForWave(arenaRound)` (core) |
| Lives | forgiving — respawn, `gameOver` reset while score<win | ONE life: player plane destroyed → run ends (lost) |
| Picks | `rollUpgradeChoices` (uniform) | `rollRunPickChoices(applied, affinity, childRng)` + `recordPick` |
| Pick UX | choose 1 of 3 | + branch color spine/label, + Reroll (1) + Skip |
| End screen | death screen | run-summary screen (outcome, wave X/15, build by branch, Заново/В ангар) |
| Status text | `РАУНД n …` | `ЗАБЕГ • ВОЛНА n/15 …` |

---

## Phase 1 — Branch styling helper + colored pick cards

**Files:** create `packages/app/src/screens/branch-style.ts` (+ `.test.ts`); modify `packages/app/src/screens/level-up-screen.ts`.

- [ ] `branch-style.ts`: `BRANCH_PALETTE: Record<Branch, { color: number; label: string }>` and `branchStyleForUpgradeId(id) → { branch, color, label }` using core `branchOfUpgrade`. Colors: assault `0xff5a4d` ШТУРМОВИК, bombardier `0xff9d2e` БОМБАРДИР, commander `0x44c8ff` КОМАНДИР, hull `0x6ee0a0` КОРПУС. Unit-test the mapping + exhaustiveness.
- [ ] `level-up-screen.ts`: draw a branch-colored vertical spine on each card's left edge + a small branch label above the title; keep the existing rarity body color (two distinct channels). Applies in both modes (harmless, improves arena too).
- [ ] Verify in preview: arena pick screen shows branch spines/labels.

## Phase 2 — Reroll / Skip on the pick screen

**Files:** modify `level-up-screen.ts`.

- [ ] Extend `createLevelUpScreen(width, height, onPick, opts?)` with optional `opts.onReroll`, `opts.onSkip`. Add a Reroll button (`ПЕРЕБРОС (N)`) and Skip button (`ПРОПУСТИТЬ`) below the cards, shown only when `show(choices, run?)` is called with a `run` payload carrying `rerollsRemaining`. Arena calls `show(choices)` → no buttons (unchanged).

## Phase 3 — Run-summary screen

**Files:** create `packages/app/src/screens/run-summary-screen.ts` (+ layout `.ts`/`.test.ts`).

- [ ] `createRunSummaryScreen(width, height, onRestart, onMenu)` with `show(summary: RunSummary)`. Telegraph-panel aesthetic consistent with the death screen. Renders: outcome banner (ПОБЕДА/ПОРАЖЕНИЕ), `ВОЛНА X/15`, kills, time, and build grouped by branch with color chips (reinforces color-coding). Two buttons: `ЗАНОВО` → onRestart (new run), `В АНГАР` → onMenu. Layout split into a pure tested module.

## Phase 4 — `main.ts` run wiring

**Files:** modify `packages/app/src/main.ts`, `packages/app/src/screens/start-menu-options.ts`.

- [ ] `start-menu-options.ts`: insert `{ action: 'run', label: 'ЗАБЕГ', note: '…', enabled: true }` right after `arena`. Add `'run'` to `MenuAction`.
- [ ] `main.ts`: import run engine; add `let runSession: RunState | null = null;`
- [ ] Menu handler: `if (action === 'run') { startRun(); return; }`; the existing `arena` branch sets `runSession = null` before `startArena()`.
- [ ] `startRun()`: `runSession = createRunState(); startArena();` then run-branded opening toast.
- [ ] `spawnArenaRoundEnemy()`: when `runSession`, enemy count = `runEnemyCountForWave(arenaRound)`, boss when `isBossWave(arenaRound)`, difficulty by wave.
- [ ] One life: skip the `gameOver`-reset (line ~1737) when `runSession`; on player-plane-destroyed (the existing `prevPlayerAlive && !state.player.alive` detection ~line 2836) when `runSession` → `endRun('lost')`.
- [ ] Win: in `updateArenaDirector`, when `runSession && isBossWave(arenaRound)` and the boss wave is cleared → `endRun('won')` (no pick after boss).
- [ ] Picks: in `showArenaRoundUpgrade()`, when `runSession`, use `rollRunPickChoices(state.appliedUpgradeIds, runSession.affinity, childRng)` and show with run controls (`rerollsRemaining`). On pick → `runSession = recordPick(runSession, id)`. Reroll → `recordReroll` + re-roll with salted child seed. Skip → `recordSkip` + advance.
- [ ] `endRun(outcome)`: guard once; `buildRunSummary(runSession, outcome, { kills: state.playerScore, timeSec: state.timeSec })`; show run-summary screen; pause; play audio. Suppress the arena death screen when `runSession` (`… && !runSession`).
- [ ] Status text: `ЗАБЕГ • ВОЛНА n/15` when `runSession`.
- [ ] `resetToMenu()` and the arena menu path clear `runSession = null`.
- [ ] Restart-from-summary calls `startRun()`.

## Phase 5 — Codex art

- [ ] Generate via `codex exec` (image_generation): 4 branch emblems (chroma-key `#00B140`), a «ЗАБЕГ» menu/key motif, and ПОБЕДА/ПОРАЖЕНИЕ summary banners. Save under `packages/app/public/…`. Wire where ready; art is enhancement, not a blocker for the playable loop.

## Phase 6 — Verify & deploy

- [ ] `pnpm --filter @biplanes/core test` + `pnpm --filter @biplanes/app typecheck` green.
- [ ] Preview: start «ЗАБЕГ», confirm wave counter, colored picks, reroll+skip, play through (use `?arenaScore`/debug to reach the boss fast if available), confirm one-life death → summary and boss-win → summary; confirm arena/story still work.
- [ ] Screenshot the pick screen + summary.
- [ ] Commit per phase; push `feat/hud-animated-panel` to deploy.
