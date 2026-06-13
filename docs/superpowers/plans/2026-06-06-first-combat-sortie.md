# First Combat Sortie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current playable prototype into a clear first combat sortie for a standalone game.

**Architecture:** Keep simulation in the existing headless core and put first-sortie guidance in small pure app helpers. The main app wires those helpers into the existing story mission, menu, HUD objective, upgrade pause, and result overlays without adding a new engine layer.

**Tech Stack:** TypeScript, PixiJS, Vite, Vitest, pnpm workspaces.

---

### Task 1: Reframe The Entry Point

**Files:**
- Modify: `packages/app/src/screens/start-screen.ts`
- Test: `packages/app/src/screens/start-screen.test.ts`

- [ ] Write a test that the primary enabled button is the story sortie, not the internal flight lab.
- [ ] Move the story sortie to the first menu slot and label it as the first combat flight.
- [ ] Keep flight lab enabled but clearly secondary/internal.
- [ ] Run the app tests.

### Task 2: Add First-Sortie Guidance

**Files:**
- Create: `packages/app/src/campaign/first-sortie-guidance.ts`
- Test: `packages/app/src/campaign/first-sortie-guidance.test.ts`
- Modify: `packages/app/src/main.ts`

- [ ] Write tests for short, action-first guidance: throttle, climb, recover from stall, shoot, choose upgrade, protect caravan, finish boss.
- [ ] Implement the pure guidance resolver.
- [ ] Track first-sortie flags in story mode: fired once, stalled once, recovered once.
- [ ] Show the guidance text in the existing mission objective area.
- [ ] Run focused app tests.

### Task 3: Make First Reward Feel Intentional

**Files:**
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/src/campaign/mission-one-frame-gate.test.ts`

- [ ] Ensure the first level-up pause opens as a deliberate “refit” beat, not as a silent interruption.
- [ ] Show a short radio beat before the first upgrade choice.
- [ ] Keep arena upgrade behavior unchanged.
- [ ] Run focused app tests.

### Task 4: Result Screen Copy

**Files:**
- Modify: `packages/app/src/main.ts`
- Test: existing campaign outcome tests

- [ ] Update victory and failure result copy so they read like standalone campaign outcomes, not prototype endings.
- [ ] Keep reset-to-menu behavior unchanged.
- [ ] Run campaign tests.

### Task 5: Verification

**Commands:**
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

- [ ] Run all verification commands.
- [ ] Note any non-blocking warnings separately.
- [ ] Do a browser smoke test if the dev server is stable.
