# Layered Skytest Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible 3x3 stitched skytest backdrop with a seamless layered arena sky.

**Architecture:** Keep the existing Pixi sky background entry point, but add a skytest-specific mode that avoids using one large tiled stitched bitmap. Render a full-world gradient, soft horizontal atmospheric bands, and non-repeating decorative sprites for cloud banks, cirrus, islands, and mist.

**Tech Stack:** TypeScript, PixiJS, Vite.

---

### Task 1: Add Layered Sky Background Mode

**Files:**
- Modify: `packages/render/src/scene/sky-background.ts`

- [ ] **Step 1: Introduce a background mode option**

Add a `mode?: 'classic' | 'layeredArena'` option to `createSkyBackground` so existing story/arena/menu skies keep current behavior, while skytest can use the layered approach.

- [ ] **Step 2: Disable stitched image in layered mode**

When `mode === 'layeredArena'`, skip the `TilingSprite` created from the single sky image. Keep the gradient and animated sky effects.

- [ ] **Step 3: Add wide soft bands**

Draw translucent horizontal bands around the upper/mid/lower zone transitions to hide any hard visual boundary.

- [ ] **Step 4: Add generated decorative sprites**

Place generated cirrus, cumulus cloud banks, mist, and floating islands as separate sprites with fixed world positions and varied alpha/scale. Do not tile them in a regular grid.

- [ ] **Step 5: Keep updates safe**

Guard the existing `skyImage.tilePosition` update so it only runs when `skyImage` exists.

### Task 2: Wire Skytest To Layered Mode

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Pass layered mode only for skytest**

In `setSkyTheme`, call `createSkyBackground(..., { mode: 'layeredArena' })` for skytest and keep the existing behavior elsewhere.

- [ ] **Step 2: Keep gameplay unchanged**

Do not touch physics, waves, enemy AI, or controls.

### Task 3: Verify

**Files:**
- Read-only verification.

- [ ] **Step 1: Run typechecks**

Run core, render, and app typechecks.

- [ ] **Step 2: Run web build**

Run the web build.

- [ ] **Step 3: Open skytest**

Open the skytest/debug URL in the in-app browser and check that the page loads without console errors.
