# Mobile Viewport Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Biplanes prototype behave like a landscape mobile game on iPhone-sized screens instead of a desktop canvas clipped inside a browser page.

**Architecture:** Keep the Pixi game runtime unchanged where possible, add a thin web-shell layer for real mobile viewport sizing and orientation guidance, and add a small app-side viewport helper for camera/HUD decisions. Camera changes stay in the app layout code rather than changing the deterministic simulation.

**Tech Stack:** TypeScript, PixiJS, Vite, pnpm.

---

### Task 1: Mobile Shell

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/main.ts`

- [x] Use dynamic viewport units, safe-area padding, and a portrait orientation overlay.
- [x] Detect touch/mobile devices without requiring the desktop `device-preview` query.
- [x] Preserve the desktop preview mode for local visual testing.

### Task 2: Mobile Viewport Helper

**Files:**
- Create: `packages/app/src/mobile-viewport.ts`
- Create: `packages/app/src/mobile-viewport.test.ts`

- [x] Add a helper that classifies phone-like landscape and portrait screens.
- [x] Add a helper that returns the desired mobile camera zoom for combat.
- [x] Cover iPhone Pro Max-like landscape and portrait dimensions with tests.

### Task 3: Camera Fit

**Files:**
- Modify: `packages/app/src/main.ts`

- [x] Use the mobile helper in arena/story/lab camera focus calculations.
- [x] Keep desktop behavior unchanged.
- [x] Re-layout Pixi systems after resize with the mobile classification.

### Task 4: Verification And Publish

**Commands:**
- `pnpm test`
- `pnpm build`
- `pnpm lint`

- [x] Verify local build has relative assets.
- [x] Commit and push the code branch.
- [x] Rebuild and push the `gh-pages` branch.
