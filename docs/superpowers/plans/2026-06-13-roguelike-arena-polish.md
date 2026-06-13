# Roguelike Arena Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mobile arena into a coherent roguelike run: readable cards, reliable round flow, smarter enemies, changing weather, and a verified end-to-end clear.

**Architecture:** Keep simulation decisions in small pure helpers and tests; keep Pixi rendering focused on visual presentation. Arena pacing stays in the app director, AI tuning stays in core, and card/weather polish stays in app/render surfaces.

**Tech Stack:** TypeScript, PixiJS, Vite, Vitest, deterministic seeded game state.

---

### Task 1: Arena Run Contract

**Files:**
- Modify: `packages/app/src/arena-director.ts`
- Modify: `packages/app/src/arena-director.test.ts`

- [ ] Add pure helpers for completed-run detection, round labels, and unresolved enemy counting.
- [ ] Test that a run reaches the final boss gate after the configured arena score.
- [ ] Test that dead-but-exploding enemies keep the round open until their crash state resolves.
- [ ] Test that the next round starts immediately after a card pick.

### Task 2: Enemy Roles And Difficulty

**Files:**
- Modify: `packages/app/src/arena-director.ts`
- Modify: `packages/app/src/main.ts`
- Modify: `packages/app/src/arena-director.test.ts`
- Modify: `packages/core/src/ai/difficulty.ts`
- Modify: `packages/core/src/ai/ai-difficulty.test.ts`

- [ ] Add role selection per arena round: rookie, hunter, ace, and boss.
- [ ] Keep early enemies readable and fragile.
- [ ] Make later enemies more evasive and better at attack runs without turning them into HP walls.
- [ ] Test the round-to-role ramp and hard-mode tuning bounds.

### Task 3: Upgrade Card Redesign

**Files:**
- Modify: `packages/app/src/screens/level-up-screen.ts`

- [ ] Replace blueprint placeholder cards with dieselpunk reward cards.
- [ ] Add category labels, rarity treatment for evolutions, and a clear pick footer.
- [ ] Use a mobile landscape layout with large cards and no center-playfield clutter outside the choice moment.
- [ ] Keep staggered entrance and tactile hover/tap feedback.

### Task 4: Weather And Stage Feel

**Files:**
- Modify: `packages/app/src/arena-locations.ts`
- Modify: `packages/render/src/scene/arena-weather-math.ts`
- Modify: `packages/render/src/scene/arena-weather-math.test.ts`

- [ ] Make stage weather distinct: clear, sunset, night, rain, snow, storm, fog, blizzard.
- [ ] Increase late-stage wind/streak/lightning intensity while preserving readability.
- [ ] Test weather preset bounds so particle counts do not become excessive on mobile.

### Task 5: Playthrough Verification

**Files:**
- Modify or create focused tests only if the playthrough exposes a bug.

- [ ] Run targeted tests for arena flow, AI, cards, weather, and mobile viewport.
- [ ] Run full tests, lint, and build.
- [ ] Boot the local arena on a phone-like viewport.
- [ ] Complete a deterministic arena run to the final boss gate or document and fix the blocker.
- [ ] Commit code, push the source branch, rebuild GitHub Pages, and push the public build.
