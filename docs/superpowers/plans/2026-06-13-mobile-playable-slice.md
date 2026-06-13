# Mobile Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Biplanes prototype into a mobile-first playable slice that opens cleanly in an iPhone Pro Max-like landscape viewport and feels ready for owner playtests.

**Architecture:** Keep the existing headless simulation and thin renderer boundaries. Mobile polish lives in the app/input/render layers: start flow, touch zones, HUD presentation, and browser verification. Core game rules change only when a player-facing behavior needs deterministic tests.

**Tech Stack:** TypeScript, PixiJS, Vite, pnpm workspaces, Vitest, in-app browser mobile viewport verification.

---

### Current Baseline

Verification on 2026-06-13:
- `pnpm test` passes: 42 test files, 247 tests.
- `pnpm build` passes with a large chunk warning from the web bundle.
- `pnpm lint` passes across workspaces.
- Local mobile viewport check at 932x430 opens the menu and first combat scene.

Observed playtest issues:
- First combat scene still exposes developer-style mission telemetry to the player.
- Touch guide only appears when the viewport is narrower than 900px or the browser reports touch support; a Pro Max-like landscape viewport at 932px can hide the guide in desktop verification.
- Some cockpit/HUD language is still mixed between player-facing labels and technical readouts.
- Browser console shows a Pixi warning during plane sprite creation; investigate before treating the build as clean.

### Task 1: Make Mobile Touch Guidance Reliable

**Files:**
- Modify: `packages/app/src/main.ts`
- Test: `packages/app/src/mobile-touch-guide.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { shouldShowTouchGuide } from './mobile-touch-guide.js';

describe('shouldShowTouchGuide', () => {
  it('shows controls on iPhone Pro Max-like landscape widths during verification', () => {
    expect(shouldShowTouchGuide({ width: 932, maxTouchPoints: 0 })).toBe(true);
  });

  it('keeps controls visible on real touch devices regardless of width', () => {
    expect(shouldShowTouchGuide({ width: 1200, maxTouchPoints: 5 })).toBe(true);
  });

  it('does not show touch controls on wide desktop verification', () => {
    expect(shouldShowTouchGuide({ width: 1280, maxTouchPoints: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/app test -- mobile-touch-guide.test.ts`

Expected: FAIL because `mobile-touch-guide.js` does not exist.

- [ ] **Step 3: Add the helper and wire it into the touch guide**

Create `packages/app/src/mobile-touch-guide.ts`:

```ts
export interface TouchGuideContext {
  width: number;
  maxTouchPoints: number;
}

export function shouldShowTouchGuide(ctx: TouchGuideContext): boolean {
  return ctx.maxTouchPoints > 0 || ctx.width <= 960;
}
```

Modify `packages/app/src/main.ts`:

```ts
import { shouldShowTouchGuide } from './mobile-touch-guide.js';
```

Then replace:

```ts
touchLikely = navigator.maxTouchPoints > 0 || w < 900;
```

with:

```ts
touchLikely = shouldShowTouchGuide({
  width: w,
  maxTouchPoints: navigator.maxTouchPoints,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @biplanes/app test -- mobile-touch-guide.test.ts`

Expected: PASS.

- [ ] **Step 5: Run app tests**

Run: `pnpm --filter @biplanes/app test`

Expected: PASS with all app tests green.

### Task 2: Replace Developer Telemetry With Player-Facing Mission Readout

**Files:**
- Modify: `packages/render/src/scene/hud.ts`
- Test: `packages/render/src/scene/hud-readout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { formatHudReadout } from './hud-readout.js';

describe('formatHudReadout', () => {
  it('uses player-facing escort language', () => {
    const text = formatHudReadout({
      mode: 'escort',
      level: 1,
      timeSec: 12.4,
      enemyAlive: 3,
      playerScore: 2,
      enemyScore: 0,
      caravanHpPct: 86,
      progressPct: 14,
      altitudeFt: 536,
      weaponTags: ['MG'],
      boostActive: false,
      boostHeatPct: 0,
      status: 'stable',
    });

    expect(text).toContain('КАРАВАН 86%');
    expect(text).toContain('МАРШРУТ 14%');
    expect(text).toContain('ПИРАТЫ 3');
    expect(text).not.toMatch(/ESCORT|BOGEYS|ALTITUDE|SYSTEM|SCORE/);
  });

  it('keeps critical warnings short enough for a compact phone HUD', () => {
    const text = formatHudReadout({
      mode: 'arena',
      level: 2,
      timeSec: 64,
      enemyAlive: 5,
      playerScore: 7,
      enemyScore: 1,
      altitudeFt: 420,
      weaponTags: ['MG', 'ROCKETS'],
      boostActive: true,
      boostHeatPct: 91,
      status: 'overheat',
    });

    expect(text).toContain('ПЕРЕГРЕВ');
    expect(text.split('\n').length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @biplanes/render test -- hud-readout.test.ts`

Expected: FAIL because `hud-readout.js` does not exist.

- [ ] **Step 3: Add HUD readout formatter**

Create `packages/render/src/scene/hud-readout.ts`:

```ts
export type HudStatus = 'stable' | 'stall' | 'overheat' | 'caravan-critical' | 'inverted';

export interface HudReadoutInput {
  mode: 'escort' | 'arena';
  level: number;
  timeSec: number;
  enemyAlive: number;
  playerScore: number;
  enemyScore: number;
  caravanHpPct?: number;
  progressPct?: number;
  altitudeFt: number;
  weaponTags: string[];
  boostActive: boolean;
  boostHeatPct: number;
  status: HudStatus;
}

function clock(timeSec: number): string {
  const total = Math.max(0, Math.floor(timeSec));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function statusLabel(status: HudStatus): string {
  if (status === 'stall') return 'СВАЛИВАНИЕ';
  if (status === 'overheat') return 'ПЕРЕГРЕВ';
  if (status === 'caravan-critical') return 'КАРАВАН ПОД ОГНЕМ';
  if (status === 'inverted') return 'ВВЕРХ НОГАМИ';
  return 'НОРМА';
}

export function formatHudReadout(input: HudReadoutInput): string {
  const level = String(input.level).padStart(2, '0');
  const weapons = input.weaponTags.length > 0 ? input.weaponTags.join(' / ') : 'MG';
  const boost = input.boostActive ? `ФОРСАЖ ${input.boostHeatPct}%` : `НАГРЕВ ${input.boostHeatPct}%`;
  const status = statusLabel(input.status);

  if (input.mode === 'escort') {
    return [
      `КАРАВАН ${input.caravanHpPct ?? 100}%   МАРШРУТ ${input.progressPct ?? 0}%`,
      `ВРЕМЯ ${clock(input.timeSec)}   ПИРАТЫ ${input.enemyAlive}   СБИТО ${input.playerScore}`,
      `ОРУЖИЕ ${weapons}`,
      `ВЫСОТА ${input.altitudeFt}   ${boost}   ${status}`,
    ].join('\n');
  }

  return [
    `АРЕНА   LVL ${level}   СБИТО ${input.playerScore}`,
    `ВРЕМЯ ${clock(input.timeSec)}   ПИРАТЫ ${input.enemyAlive}`,
    `ОРУЖИЕ ${weapons}`,
    `ВЫСОТА ${input.altitudeFt}   ${boost}   ${status}`,
  ].join('\n');
}
```

- [ ] **Step 4: Wire formatter into the HUD**

Modify `packages/render/src/scene/hud.ts`:

```ts
import { formatHudReadout, type HudStatus } from './hud-readout.js';
```

Replace the two raw `text.text = ...` blocks with calls to `formatHudReadout`, mapping warning states to `HudStatus`.

- [ ] **Step 5: Run render tests**

Run: `pnpm --filter @biplanes/render test`

Expected: PASS.

### Task 3: Remove Plane Sprite Console Warning

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/body.ts`
- Test: browser console verification

- [ ] **Step 1: Reproduce the warning**

Run the app, enter a flight, and read browser warning logs.

Expected current warning stack includes plane body creation.

- [ ] **Step 2: Inspect Pixi Graphics calls around plane body creation**

Focus on chained `Graphics` calls that may use deprecated overloads or invalid draw order.

- [ ] **Step 3: Adjust only the warning-producing call**

Keep the visual shape unchanged. Do not rewrite the sprite.

- [ ] **Step 4: Verify warning is gone**

Run: mobile browser flow at 932x430, enter first flight, inspect warnings.

Expected: no warning from plane body creation.

### Task 4: Mobile Browser Acceptance Check

**Files:**
- No production file required unless the checks expose a bug.

- [ ] **Step 1: Start local app**

Run: `pnpm dev -- --host 127.0.0.1`

Expected: local app responds with HTTP 200.

- [ ] **Step 2: Open iPhone Pro Max-like landscape viewport**

Use viewport 932x430.

Expected:
- Menu visible.
- No page scrollbars.
- Canvas exists.
- First flight button starts the story.

- [ ] **Step 3: Advance into combat**

Expected:
- HUD and mission text fit.
- Touch guide rings are visible in verification viewport.
- No developer telemetry appears in player HUD.
- No browser error logs.

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm test
pnpm build
pnpm lint
```

Expected: all pass. Build may keep the existing bundle-size warning; treat it as known, not blocking for this slice.

### Execution Notes

- Do not add Telegram SDK, Supabase, monetization, account storage, or native mobile packaging in this slice.
- Do not change the core flight model unless a failing physics test proves a player-facing issue.
- Keep debug tools available behind URL parameters or keyboard toggles, but do not expose them in the normal mobile player view.
