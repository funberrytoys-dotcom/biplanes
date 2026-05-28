# Mission One Scripted Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn mission one from an arena variant into a five-minute scripted escort level with carrier takeoff, camera reveal, caravan priority, route beats, enemy waves, and a finale boss.

**Architecture:** Keep the deterministic core intact for now and implement mission-specific pacing in the app layer. Add a focused mission controller that owns timer, phase, radio events, scripted enemy injections, caravan damage, and victory/failure. Expand the existing mission scene to render carrier/caravan/islands/boss route elements independently from arena-only HUD logic.

**Tech Stack:** TypeScript, PixiJS, existing Vite app, existing core tick and plane physics.

---

### Task 1: Mission Controller

**Files:**
- Create: `packages/app/src/campaign/mission-one-controller.ts`
- Modify: `packages/app/src/main.ts`

- [ ] Create a controller with phases: `briefing`, `launch`, `reveal`, `escort`, `ambush`, `boss`, `victory`, `failure`.
- [ ] Track mission time independently from global score.
- [ ] Expose helper methods for radio events, wave triggers, boss status, caravan damage pressure, and victory/failure checks.
- [ ] Use a 300-second route target and a boss finale around 250 seconds.

### Task 2: Mission Scene Upgrade

**Files:**
- Modify: `packages/app/src/campaign/mission-one-scene.ts`

- [ ] Replace static caravan progress with route progress supplied by the controller.
- [ ] Add carrier start art using existing caravan/airship assets as a launch platform.
- [ ] Add cinematic reveal values: close start, then pulled-back route view.
- [ ] Add boss airship/plane marker in the final phase.
- [ ] Keep the island sprites, beacon, smoke, and route line, but make the scene feel like a moving corridor.

### Task 3: Scripted Enemy Injections

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] Add a local `makeScriptedEnemy()` helper for airborne enemy spawning.
- [ ] During story mode, insert enemies at named wave beats instead of letting the mission feel like default arena pressure.
- [ ] Limit regular core spawning by using medium pressure but pruning excess story enemies when needed.
- [ ] Give the boss extra hit points and a visible position in the finale.

### Task 4: Launch Flow

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] Start the player on a high carrier deck, not the ground runway.
- [ ] Use a short forced launch command until the player is airborne.
- [ ] Show "Тревога!" radio, then zoom/reveal the route.
- [ ] Keep player control active quickly so the level starts dynamically.

### Task 5: Verification

**Files:**
- Run checks only.

- [ ] Run app typecheck.
- [ ] Run web build.
- [ ] Run workspace tests.
- [ ] Confirm local dev server answers on `http://localhost:5173/`.

