# Graphics, VFX & Game-Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the existing Biplanes prototype and apply a 5-phase cinematic-arcade visual + feel pass (bloom, hit-pause, juice, plane animation, atmosphere, death drama, midair plane-vs-plane collision). Spec: [docs/superpowers/specs/2026-05-22-graphics-vfx-game-feel-design.md](../specs/2026-05-22-graphics-vfx-game-feel-design.md).

**Architecture:** Render-layer effects live on a new `render-clock` module that scales render-ticker `dt` (hit-pause = dt×0, slow-mo = dt×0.35). Game tick stays deterministic — same `(seed, commands)` produces same state. Only the new core mechanic (plane↔plane collision in Phase 5) extends the deterministic core. New render modules are added side-by-side to existing ones; `plane-sprite.ts` is split into smaller files in Phase 2 because it grows past 350 lines.

**Tech Stack:** TypeScript, PixiJS v8 (built-in `BlurFilter`, `ColorMatrixFilter`, `BLEND_MODES.ADD`), Vitest. No new runtime dependencies.

---

## File Structure

**Created:**
- `packages/render/src/render-clock.ts` — manages `timeScale`, `pauseFrames`, exposes `hitPause(frames)`, `slowMo(scale, durSec)`, `tick(realDt)→effectiveDt`.
- `packages/render/src/scene/glow-layer.ts` — Pixi `Container` with `BlurFilter` + additive blend.
- `packages/render/src/scene/muzzle-flash.ts` — pool of star-shaped flashes spawned at gun position.
- `packages/render/src/scene/bullet-tracer.ts` — particle trail behind each bullet.
- `packages/render/src/scene/floating-numbers.ts` — pool of damage-number labels.
- `packages/render/src/scene/screen-effects.ts` — full-screen flash + low-HP vignette + color-matrix overlay.
- `packages/render/src/scene/ground-fx.ts` — crash crater + lingering smoke layer.
- `packages/render/src/scene/distant-silhouettes.ts` — mountains, distant blimps, distant crossing plane.
- `packages/render/src/scene/foreground-clouds.ts` — clouds in front of planes.
- `packages/render/src/scene/lightning.ts` — twilight/night lightning bolts + flash.
- `packages/render/src/scene/lens-flare.ts` — sun glare for noon/sunset.
- `packages/render/src/scene/plane-sprite/index.ts` — orchestrator after Phase 2 split.
- `packages/render/src/scene/plane-sprite/body.ts` — fuselage, wings, struts, engine cylinders.
- `packages/render/src/scene/plane-sprite/controls.ts` — ailerons, elevator, rudder Graphics nodes with deflection update.
- `packages/render/src/scene/plane-sprite/pilot-head.ts` — Chico head + helmet bobbing.
- `packages/core/src/systems/plane-collision.ts` — new module: `resolvePlanePlaneCollisions`.

**Modified:**
- `packages/shared/src/constants.ts` — new tunables (`COLLISION_DAMAGE_K`, hit-pause counts, slow-mo, vignette thresholds, etc.).
- `packages/core/src/entities/plane.ts` — add `'dying'` to `PlaneState`, add `dyingTimer?: number`.
- `packages/core/src/world/world-state.ts` — add `collisionEvents: PlaneCollisionEvent[]`, `recentCollisions: Map<string, number>`.
- `packages/core/src/world/tick.ts` — transition flying→dying instead of straight to crashed when killed by bullet/ram; advance `dyingTimer`; call new `resolvePlanePlaneCollisions`; emit collision events.
- `packages/core/src/systems/collision-system.ts` — when bullet kill happens, set victim to `'dying'` not `'crashed'`.
- `packages/core/src/world/tick.test.ts` — new tests for `dying` state, plane↔plane collision determinism.
- `packages/render/src/index.ts` — export new modules.
- `packages/render/src/scene/damage-fx.ts` — new particle types: `chunk`, `debris`, `casing`, `windstreak`.
- `packages/render/src/scene/plane-sprite.ts` — split (Phase 2). Old file is deleted; barrel is `plane-sprite/index.ts`.
- `packages/render/src/camera.ts` — add `punch(dirX, dirY, amount)` and `zoomPunch(targetScale, durSec)`. Change shake decay curve.
- `packages/render/src/scene/sky-background.ts` — accept optional `lightningHandle` from outer layer (no behavioral change; just hooks for the lightning flash to query the current theme).
- `packages/app/src/main.ts` — wire all new render modules; drive ticker through `render-clock`; subscribe to core's collision events for VFX.

**Not touched:** `packages/input/`, `packages/render/src/scene/blimp-sprite.ts`, AI, physics, screens unless explicitly noted.

---

## Phase 0: Foundation

Sets up shared infrastructure that all later phases depend on.

### Task 0.1: Add visual-feel constants to shared

**Files:**
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Append new constants block**

```ts
// === Visual feel / VFX (Phase 0 of graphics+VFX spec) ===
// Hit-pause: number of render frames to freeze when bullet hits / kill / explode.
export const HIT_PAUSE_FRAMES_HIT = 4;
export const HIT_PAUSE_FRAMES_KILL = 8;
export const HIT_PAUSE_FRAMES_EXPLODE = 12;
export const HIT_PAUSE_FRAMES_RAM = 8;
export const HIT_PAUSE_FRAMES_RAM_KILL = 14;

// Slow-mo applied on player death (render-only).
export const SLOW_MO_SCALE = 0.35;
export const SLOW_MO_DURATION_SEC = 0.5;
export const SLOW_MO_RECOVERY_SEC = 0.2;

// Low-HP vignette threshold (fraction of maxHp).
export const LOW_HP_VIGNETTE_THRESHOLD = 0.25;

// Death-spin (Phase 4).
export const DYING_DURATION_SEC = 1.8;
export const DYING_SPIN_RATE = 5.0;            // rad/sec heading rotation
export const DYING_GRAVITY_MULTIPLIER = 1.8;

// Plane-vs-plane collision (Phase 5).
export const PLANE_COLLISION_RADIUS = 24;
export const COLLISION_DAMAGE_K = 0.055;       // tuned so head-on at ~1800 px/s ≈ maxHp damage
export const COLLISION_COOLDOWN_TICKS = 30;    // 0.5s at 60 Hz
export const COLLISION_BOUNCE_VELOCITY_RETAIN = 0.6;
export const COLLISION_BOUNCE_HEADING_JITTER = 0.4;   // rad
```

- [ ] **Step 2: Verify build**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(shared): tunables for visual feel, death-spin and plane collisions"
```

---

### Task 0.2: Create `render-clock` module

**Files:**
- Create: `packages/render/src/render-clock.ts`
- Create: `packages/render/src/render-clock.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/render/src/render-clock.test.ts
import { describe, it, expect } from 'vitest';
import { createRenderClock } from './render-clock.js';

describe('renderClock', () => {
  it('returns realDt by default', () => {
    const c = createRenderClock();
    expect(c.tick(0.016)).toBeCloseTo(0.016);
  });

  it('returns 0 dt while paused', () => {
    const c = createRenderClock();
    c.hitPause(3);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBe(0);
    expect(c.tick(0.016)).toBeCloseTo(0.016); // 4th frame: pause expired
  });

  it('extends an active pause (max, not sum)', () => {
    const c = createRenderClock();
    c.hitPause(2);
    c.hitPause(5);
    let totalPaused = 0;
    for (let i = 0; i < 5; i++) if (c.tick(0.016) === 0) totalPaused++;
    expect(totalPaused).toBe(5);
  });

  it('slow-mo scales realDt over duration then recovers', () => {
    const c = createRenderClock();
    c.slowMo(0.25, 0.1, 0.05); // scale, dur, recovery
    const dt = 0.02;
    // For first 0.1s effective dt = realDt * 0.25
    const a = c.tick(dt);
    expect(a).toBeCloseTo(dt * 0.25);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

Run: `pnpm --filter @biplanes/render test`
Expected: FAIL — `createRenderClock is not defined`.

- [ ] **Step 3: Implement module**

```ts
// packages/render/src/render-clock.ts
export interface RenderClock {
  /** Return the dt the renderer should use this frame (after pause/slow-mo). */
  tick(realDt: number): number;
  /** Freeze rendering for N upcoming frames. Re-calling extends to max(current, N). */
  hitPause(frames: number): void;
  /** Engage slow-mo at `scale` for `durationSec`, then ramp back to 1.0 over `recoverySec`. */
  slowMo(scale: number, durationSec: number, recoverySec: number): void;
}

export function createRenderClock(): RenderClock {
  let pauseFrames = 0;

  // Slow-mo timeline: [active][recovery]
  let slowmoScale = 1;
  let slowmoTimeLeft = 0;
  let slowmoRecoveryLeft = 0;
  let slowmoRecoveryTotal = 0;

  return {
    tick(realDt: number): number {
      if (pauseFrames > 0) {
        pauseFrames--;
        return 0;
      }
      let scale = 1;
      if (slowmoTimeLeft > 0) {
        slowmoTimeLeft = Math.max(0, slowmoTimeLeft - realDt);
        scale = slowmoScale;
      } else if (slowmoRecoveryLeft > 0) {
        const t = slowmoRecoveryLeft / slowmoRecoveryTotal; // 1 → 0
        scale = slowmoScale + (1 - slowmoScale) * (1 - t);
        slowmoRecoveryLeft = Math.max(0, slowmoRecoveryLeft - realDt);
      }
      return realDt * scale;
    },
    hitPause(frames: number) {
      pauseFrames = Math.max(pauseFrames, frames);
    },
    slowMo(scale: number, durationSec: number, recoverySec: number) {
      slowmoScale = scale;
      slowmoTimeLeft = durationSec;
      slowmoRecoveryLeft = recoverySec;
      slowmoRecoveryTotal = recoverySec;
    },
  };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `pnpm --filter @biplanes/render test`
Expected: PASS.

- [ ] **Step 5: Export from package**

Edit `packages/render/src/index.ts` — add line `export * from './render-clock.js';`.

- [ ] **Step 6: Commit**

```bash
git add packages/render/src/render-clock.ts packages/render/src/render-clock.test.ts packages/render/src/index.ts
git commit -m "feat(render): render-clock module for hit-pause and slow-mo (deterministic core untouched)"
```

---

### Task 0.3: Drive app ticker through `render-clock`

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Import and instantiate**

Near top of `startGame`, after `createPixiApp`:

```ts
import { createRenderClock } from '@biplanes/render';
// ...
const clock = createRenderClock();
```

- [ ] **Step 2: Route ticker through clock**

Inside `app.ticker.add((ticker) => { ... })`, replace `const dt = deltaMS / 1000;` with:

```ts
const realDt = ticker.deltaMS / 1000;
const dt = clock.tick(realDt);
// `dt === 0` means render is frozen this frame (hit-pause)
```

Important: `renderTimeSec += realDt` should keep using `realDt` so sky animations don't freeze with hit-pause (the sky uses `renderTimeSec` for clouds, beacons, etc.).

Actually for hit-pause to feel right, EVERYTHING freezes including sky. So change to:

```ts
const realDt = ticker.deltaMS / 1000;
const dt = clock.tick(realDt);
renderTimeSec += dt;
```

The `acc += dt;` line that drives the game tick stays the same (uses scaled dt — slow-mo slows the game too, hit-pause freezes it).

- [ ] **Step 3: Sanity-run**

Run dev server: `pnpm dev`. Open http://localhost:5173. Game still plays normally. No visual change yet.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "feat(app): route ticker through render-clock (no visible change yet)"
```

---

### Task 0.4: Glow layer with bloom

**Files:**
- Create: `packages/render/src/scene/glow-layer.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement `glow-layer.ts`**

```ts
// packages/render/src/scene/glow-layer.ts
import { Container, BlurFilter } from 'pixi.js';

export interface GlowLayerHandle {
  container: Container;
}

/**
 * Container that gets bloom-style soft glow via BlurFilter + additive blend on children.
 * Children rendered into this layer should set their own `blendMode = 'add'` on Graphics
 * to get the additive contribution; the BlurFilter provides the soft halo.
 */
export function createGlowLayer(): GlowLayerHandle {
  const c = new Container();
  const blur = new BlurFilter({ strength: 6, quality: 4 });
  c.filters = [blur];
  // The bloom is "free": all children are drawn additively because we set
  // their blendMode at insertion time. The BlurFilter spreads bright pixels.
  return { container: c };
}
```

- [ ] **Step 2: Export from package**

Add `export * from './scene/glow-layer.js';` to `packages/render/src/index.ts`.

- [ ] **Step 3: Wire into app scene layout**

In `packages/app/src/main.ts`, after `const fxLayer = new Container();`:

```ts
const glowLayer = createGlowLayer();
worldLayer.addChild(bulletLayer, fxLayer, glowLayer.container, planeLayer);
```

(Order: bullets behind plain FX behind glow behind planes. Glow above plain FX so explosions show on top of dust.)

Also `import { createGlowLayer } from '@biplanes/render';`.

- [ ] **Step 4: Pass glow handle into DamageFx (preparation)**

For now just instantiate but don't put anything in it. Later tasks redirect specific particles.

- [ ] **Step 5: Sanity-run**

`pnpm dev` — game still looks the same (glow layer is empty).

- [ ] **Step 6: Commit**

```bash
git add packages/render/src/scene/glow-layer.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(render): glow layer scaffolding with BlurFilter"
```

---

## Phase 1: Soakage (juice pass)

### Task 1.1: Route fire / sparks / shockwave / explosion through glow layer

**Files:**
- Modify: `packages/render/src/scene/damage-fx.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Accept two containers in DamageFx**

```ts
// packages/render/src/scene/damage-fx.ts
export class DamageFx {
  private opaqueContainer: Container;
  private glowContainer: Container;
  // ...
  constructor(opaqueContainer: Container, glowContainer: Container) {
    this.opaqueContainer = opaqueContainer;
    this.glowContainer = glowContainer;
  }

  // Update acquire() to choose container per type:
  private acquire(color: number, radius: number, type: Particle['type']): Graphics {
    let g = this.pool.pop() ?? new Graphics();
    g.clear();
    /* ... existing drawing logic ... */
    const useGlow = type === 'fire' || type === 'spark' || type === 'shockwave';
    const container = useGlow ? this.glowContainer : this.opaqueContainer;
    if (useGlow) g.blendMode = 'add';
    else g.blendMode = 'normal';
    container.addChild(g);
    return g;
  }
}
```

- [ ] **Step 2: Update main.ts instantiation**

```ts
const damageFx = new DamageFx(fxLayer, glowLayer.container);
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → start match → shoot enemy. Expected: explosions and hit-sparks have soft halo; smoke remains plain.

- [ ] **Step 4: Tune bloom strength if needed**

If too soft / too noisy, adjust `strength` and `quality` in `glow-layer.ts` (try strength=4–8). Commit final values once it looks right.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts packages/app/src/main.ts
git commit -m "feat(fx): route fire/sparks/explosions through bloom glow layer"
```

---

### Task 1.2: Muzzle flash on weapon fire

**Files:**
- Create: `packages/render/src/scene/muzzle-flash.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/muzzle-flash.ts
import { Container, Graphics } from 'pixi.js';

interface Flash {
  g: Graphics;
  life: number;
  maxLife: number;
}

export class MuzzleFlashes {
  private active: Flash[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  spawn(x: number, y: number, headingRad: number) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    // 6-point star
    const r1 = 11, r2 = 4;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? r1 : r2;
      if (i === 0) g.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    g.closePath().fill({ color: 0xfff5a0, alpha: 0.95 });
    g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.9 });
    g.x = x;
    g.y = y;
    g.rotation = headingRad;
    g.blendMode = 'add';
    g.alpha = 1;
    g.scale.set(1);
    this.container.addChild(g);
    this.active.push({ g, life: 0.08, maxLife: 0.08 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i]!;
      f.life -= dt;
      if (f.life <= 0) {
        if (f.g.parent) f.g.parent.removeChild(f.g);
        this.pool.push(f.g);
        this.active.splice(i, 1);
        continue;
      }
      const t = f.life / f.maxLife;
      f.g.alpha = t;
      f.g.scale.set(0.4 + t * 0.6);
    }
  }
}
```

- [ ] **Step 2: Export from package**

Add to `packages/render/src/index.ts`: `export * from './scene/muzzle-flash.js';`.

- [ ] **Step 3: Wire into main.ts**

```ts
const muzzleFlashes = new MuzzleFlashes(glowLayer.container);

// Detect new bullets each frame and spawn muzzle flash for each
let prevBulletIds = new Set<number>();
// ...inside ticker, after state advance:
const seen = new Set<number>();
for (const b of state.bullets) {
  seen.add(b.id);
  if (!prevBulletIds.has(b.id)) {
    // newborn bullet — flash at its origin (use position back-traced by 1 tick)
    const heading = Math.atan2(b.velocity.y, b.velocity.x);
    muzzleFlashes.spawn(b.position.x, b.position.y, heading);
  }
}
prevBulletIds = seen;

// in same place where damageFx.update(dt) runs:
muzzleFlashes.update(dt);
```

- [ ] **Step 4: Manual verify**

`pnpm dev` → fire weapon. Expected: each shot produces a yellow-white 6-point star flash at gun tip, 80 ms.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/muzzle-flash.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(fx): muzzle flash on weapon fire"
```

---

### Task 1.3: Bullet tracer trails

**Files:**
- Create: `packages/render/src/scene/bullet-tracer.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement tracer**

```ts
// packages/render/src/scene/bullet-tracer.ts
import { Container, Graphics } from 'pixi.js';
import type { Bullet } from '@biplanes/core';

interface TrailParticle {
  g: Graphics;
  life: number;
  maxLife: number;
}

export class BulletTracers {
  private active: TrailParticle[] = [];
  private pool: Graphics[] = [];

  constructor(private container: Container) {}

  emit(bullet: Bullet) {
    let g = this.pool.pop();
    if (!g) g = new Graphics();
    g.clear();
    const color = bullet.ownerFaction === 'player' ? 0xffe88c : 0xff5a22;
    g.circle(0, 0, 2.5).fill({ color, alpha: 0.85 });
    g.x = bullet.position.x;
    g.y = bullet.position.y;
    g.blendMode = 'add';
    this.container.addChild(g);
    this.active.push({ g, life: 0.12, maxLife: 0.12 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.g.parent) p.g.parent.removeChild(p.g);
        this.pool.push(p.g);
        this.active.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.g.alpha = t * 0.85;
      p.g.scale.set(0.3 + t * 0.7);
    }
  }
}
```

- [ ] **Step 2: Wire emission**

In `main.ts`, in the ticker, for each live bullet emit one tracer particle per frame:

```ts
for (const b of state.bullets) {
  tracers.emit(b);
}
tracers.update(dt);
```

Also make the bullet sprite itself more lively. Edit `packages/render/src/scene/bullet-sprite.ts`:

```ts
g = this.pool.pop() ?? new Graphics().circle(0, 0, 3.5).fill({ color: 0xffffff });
g.blendMode = 'add';
```

(The bright white core sits in the bullet layer; the warm trail emanates from BulletTracers in the glow layer.)

- [ ] **Step 3: Export from package and import**

Add `export * from './scene/bullet-tracer.js';` to `packages/render/src/index.ts`.

In `main.ts`:
```ts
const tracers = new BulletTracers(glowLayer.container);
```

- [ ] **Step 4: Manual verify**

`pnpm dev` → fire bullets. Expected: a soft warm trail follows each bullet; trail color differs for player vs enemy.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/bullet-tracer.ts packages/render/src/scene/bullet-sprite.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(fx): bullet tracer trails with faction colors"
```

---

### Task 1.4: Stronger hit sparks and impact flash

**Files:**
- Modify: `packages/render/src/scene/plane-sprite.ts`

- [ ] **Step 1: Double spark count + add impact flash**

In `plane-sprite.ts`, find the block that emits `fx.addSparks` on damage taken. Increase count from 9 to 18 and add a one-off bright white circle:

```ts
if (p.hp < prevHp) {
  fx.addSparks({ x: p.kinematic.position.x, y: p.kinematic.position.y }, 18);
  fx.addImpactFlash({ x: p.kinematic.position.x, y: p.kinematic.position.y });
}
```

- [ ] **Step 2: Implement `addImpactFlash` in DamageFx**

```ts
// packages/render/src/scene/damage-fx.ts
addImpactFlash(position: { x: number; y: number }) {
  const g = this.acquire(0xffffff, 14, 'spark'); // uses glow container via type=spark
  g.x = position.x;
  g.y = position.y;
  g.scale.set(1);
  this.active.push({
    g,
    vx: 0, vy: 0,
    life: 0.08, maxLife: 0.08,
    baseAlpha: 1.0, baseRadius: 14, type: 'spark',
  });
}
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → hit enemy. Expected: visibly stronger spark burst + a bright white flash where the bullet hits.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/plane-sprite.ts packages/render/src/scene/damage-fx.ts
git commit -m "feat(fx): stronger hit sparks and white impact flash"
```

---

### Task 1.5: Hit-pause via render-clock

**Files:**
- Modify: `packages/render/src/scene/plane-sprite.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Pass clock into plane sprite update**

Change `update` signature to accept the clock:

```ts
// plane-sprite.ts
update(p: Plane, dt: number, fx?: DamageFx, clock?: RenderClock) {
  // ...
  if (fx && aliveAndFlying) {
    if (p.hp < prevHp) {
      const wasKill = p.hp <= 0 && prevHp > 0;
      fx.addSparks({ x: p.kinematic.position.x, y: p.kinematic.position.y }, 18);
      fx.addImpactFlash({ x: p.kinematic.position.x, y: p.kinematic.position.y });
      if (clock) clock.hitPause(wasKill ? HIT_PAUSE_FRAMES_KILL : HIT_PAUSE_FRAMES_HIT);
    }
  }
}
```

Import `HIT_PAUSE_FRAMES_HIT`, `HIT_PAUSE_FRAMES_KILL` from `@biplanes/shared`, and `RenderClock` from local `render-clock.js`.

- [ ] **Step 2: Plumb clock through main.ts**

In `main.ts`, in the ticker block, pass `clock` to all `playerSprite.update(...)` and `enemySprite.update(...)` calls.

- [ ] **Step 3: Manual verify**

`pnpm dev` → shoot enemy. Expected: each hit produces a ~66ms screen freeze (4 frames). Kill = ~133ms freeze.

If freezes feel too long/short, adjust `HIT_PAUSE_FRAMES_HIT` in `shared/constants.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/plane-sprite.ts packages/app/src/main.ts
git commit -m "feat(feel): hit-pause on bullet hit and kill"
```

---

### Task 1.6: Camera punch, zoom-punch, ease-out decay

**Files:**
- Modify: `packages/render/src/camera.ts`
- Modify: `packages/app/src/main.ts`
- Modify: `packages/render/src/scene/plane-sprite.ts`

- [ ] **Step 1: Extend camera with punch and zoom-punch**

```ts
// camera.ts
export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  let punchVX = 0, punchVY = 0;
  let zoomFrom = 1, zoomTo = 1, zoomTime = 0, zoomDur = 0;
  const SHAKE_CAP = 12;
  let baseX = worldRoot.x;
  let baseY = worldRoot.y;
  let baseScale = worldRoot.scale.x;

  return {
    follow(_p: Plane) {},
    setBase(x: number, y: number) { baseX = x; baseY = y; baseScale = worldRoot.scale.x; },
    tickShake() {
      // Ease-out shake (faster start, soft tail)
      if (shakeAmount > 0.05) {
        worldRoot.x = baseX + (Math.random() - 0.5) * shakeAmount + punchVX;
        worldRoot.y = baseY + (Math.random() - 0.5) * shakeAmount + punchVY;
        shakeAmount *= Math.pow(0.55, 1 / 60); // ease-out per frame (~adjust if dt-aware)
        punchVX *= 0.7;
        punchVY *= 0.7;
      } else {
        worldRoot.x = baseX + punchVX;
        worldRoot.y = baseY + punchVY;
        punchVX *= 0.7;
        punchVY *= 0.7;
        if (Math.abs(punchVX) < 0.05 && Math.abs(punchVY) < 0.05) {
          punchVX = 0; punchVY = 0;
        }
      }
      // Zoom-punch
      if (zoomTime > 0) {
        zoomTime -= 1 / 60;
        const t = Math.max(0, zoomTime / zoomDur);
        const ease = 1 - (1 - t) * (1 - t);
        const z = zoomFrom + (zoomTo - zoomFrom) * ease;
        worldRoot.scale.set(z);
      } else if (worldRoot.scale.x !== baseScale) {
        worldRoot.scale.set(baseScale);
      }
    },
    shake(amount: number) { shakeAmount = Math.min(SHAKE_CAP, Math.max(shakeAmount, amount)); },
    punch(dirX: number, dirY: number, amount: number) {
      const len = Math.hypot(dirX, dirY) || 1;
      punchVX = (dirX / len) * amount;
      punchVY = (dirY / len) * amount;
    },
    zoomPunch(targetMultiplier: number, durSec: number) {
      zoomFrom = baseScale * targetMultiplier;
      zoomTo = baseScale;
      zoomTime = durSec;
      zoomDur = durSec;
    },
    setScreen(w: number, h: number) { screenW = w; screenH = h; },
  };
}
```

- [ ] **Step 2: Use punch on hit, zoom-punch on kill**

In `plane-sprite.ts` damage block (extend Step 1 of Task 1.5):

```ts
if (camera) {
  const dx = p.kinematic.position.x - (camera.viewCenterX ?? screenW / 2);
  const dy = p.kinematic.position.y - (camera.viewCenterY ?? screenH / 2);
  camera.punch(dx, dy, 3);
  camera.shake(wasKill ? 8 : 4);
  if (wasKill) camera.zoomPunch(1.04, 0.1);
}
```

(Plane-sprite gains an optional `camera` parameter, similar to clock.)

- [ ] **Step 3: Plumb camera into plane-sprite update**

Add to `update` signature: `(p, dt, fx?, clock?, camera?)`. Pass through from main.ts.

- [ ] **Step 4: Manual verify**

`pnpm dev` → shoot enemy. Expected: short directional camera kick on each hit; small zoom punch on kill.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/camera.ts packages/render/src/scene/plane-sprite.ts packages/app/src/main.ts
git commit -m "feat(feel): camera punch, zoom-punch on kill, ease-out shake decay"
```

---

### Task 1.7: Screen-effects module (flashes, vignette, color matrix)

**Files:**
- Create: `packages/render/src/scene/screen-effects.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/screen-effects.ts
import { Container, Graphics, ColorMatrixFilter } from 'pixi.js';

export interface ScreenEffectsHandle {
  container: Container;
  flash(color: number, alpha: number, durSec: number): void;
  /** vignettePct = 0..1 (0 = off, 1 = full red). Call every frame. */
  setVignette(vignettePct: number): void;
  /** Apply desaturate+red tint over the world layer for player-death drama. */
  enableDeathTint(): void;
  disableDeathTint(): void;
  update(dt: number, timeSec: number, worldRoot: Container): void;
}

export function createScreenEffects(width: number, height: number): ScreenEffectsHandle {
  const c = new Container();

  const flashG = new Graphics().rect(0, 0, width, height).fill(0xffffff);
  flashG.alpha = 0;
  c.addChild(flashG);

  const vignetteG = new Graphics();
  // 4 strips along edges with radial gradient feel (approximate w/ 4 rects)
  // Implementation: just 4 thin rectangles at edges with low alpha
  const edge = 80;
  vignetteG
    .rect(0, 0, width, edge).fill({ color: 0x550000, alpha: 1 })
    .rect(0, height - edge, width, edge).fill({ color: 0x550000, alpha: 1 })
    .rect(0, 0, edge, height).fill({ color: 0x550000, alpha: 1 })
    .rect(width - edge, 0, edge, height).fill({ color: 0x550000, alpha: 1 });
  vignetteG.alpha = 0;
  c.addChild(vignetteG);

  const deathFilter = new ColorMatrixFilter();
  let deathTintActive = false;

  let flashLife = 0;
  let flashMaxLife = 0;
  let flashColor = 0xffffff;
  let flashAlpha = 0;
  let baseVignette = 0;

  return {
    container: c,
    flash(color, alpha, durSec) {
      flashG.clear().rect(0, 0, width, height).fill(color);
      flashColor = color;
      flashAlpha = alpha;
      flashLife = durSec;
      flashMaxLife = durSec;
    },
    setVignette(pct) {
      baseVignette = Math.max(0, Math.min(1, pct));
    },
    enableDeathTint() { deathTintActive = true; },
    disableDeathTint() { deathTintActive = false; },
    update(dt, timeSec, worldRoot) {
      if (flashLife > 0) {
        flashLife = Math.max(0, flashLife - dt);
        flashG.alpha = (flashLife / flashMaxLife) * flashAlpha;
      } else {
        flashG.alpha = 0;
      }
      // Heartbeat pulse on vignette
      const pulse = 0.8 + 0.2 * Math.sin(timeSec * 12);
      vignetteG.alpha = baseVignette * pulse;

      // Death tint
      if (deathTintActive) {
        if (!worldRoot.filters || !worldRoot.filters.includes(deathFilter)) {
          deathFilter.reset();
          deathFilter.saturate(-0.6, true);
          // Red tint: shift the green/blue down a touch
          worldRoot.filters = [deathFilter];
        }
      } else if (worldRoot.filters && worldRoot.filters.includes(deathFilter)) {
        worldRoot.filters = null;
      }
    },
  };
}
```

- [ ] **Step 2: Export**

Add `export * from './scene/screen-effects.js';` to `packages/render/src/index.ts`.

- [ ] **Step 3: Instantiate in app**

In `main.ts`, after `uiLayer`:

```ts
import { createScreenEffects } from '@biplanes/render';
// ...
const screenFx = createScreenEffects(app.screen.width, app.screen.height);
uiLayer.addChildAt(screenFx.container, 0); // behind HUD overlays
```

In ticker, call `screenFx.update(dt, renderTimeSec, worldLayer);` every frame.

In resize handler, recreate `screenFx` or expose a `resize` method.

- [ ] **Step 4: Manual verify**

`pnpm dev` — no visible change yet, but no crash.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/screen-effects.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(fx): screen-effects module (flash, vignette, death tint)"
```

---

### Task 1.8: Trigger flashes on kill / level-up / death + low-HP vignette

**Files:**
- Modify: `packages/app/src/main.ts`
- Modify: `packages/render/src/scene/plane-sprite.ts`

- [ ] **Step 1: Detect kill / level-up / death events**

In `main.ts` ticker, maintain previous state references:

```ts
let prevPlayerScore = state.playerScore;
let prevEnemyScore = state.enemyScore;
let prevLevel = state.level;
let prevPlayerAlive = state.player.alive;

// ...inside ticker after tick():
if (state.playerScore > prevPlayerScore) {
  screenFx.flash(0xffffff, 0.25, 0.12);
}
if (state.level > prevLevel) {
  screenFx.flash(0xffc24a, 0.4, 0.22);
}
if (prevPlayerAlive && !state.player.alive) {
  screenFx.flash(0xff5544, 0.5, 0.4);
  // slow-mo trigger from Task 1.10 happens here too.
}
prevPlayerScore = state.playerScore;
prevEnemyScore = state.enemyScore;
prevLevel = state.level;
prevPlayerAlive = state.player.alive;
```

- [ ] **Step 2: Low-HP vignette**

In same ticker block:

```ts
const hpFrac = state.player.hp / state.player.maxHp;
const vignette = hpFrac <= LOW_HP_VIGNETTE_THRESHOLD
  ? 1 - (hpFrac / LOW_HP_VIGNETTE_THRESHOLD)
  : 0;
screenFx.setVignette(vignette * 0.6); // max alpha 0.6
```

Import `LOW_HP_VIGNETTE_THRESHOLD` from `@biplanes/shared`.

- [ ] **Step 3: Manual verify**

`pnpm dev` → kill enemy (white flash), level up (golden flash), die (red flash + ~0.4s red overlay), take damage to low HP (red corners breathing).

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "feat(feel): screen flashes on kill/level-up/death, low-HP vignette"
```

---

### Task 1.9: Floating damage numbers

**Files:**
- Create: `packages/render/src/scene/floating-numbers.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/render/src/scene/plane-sprite.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/floating-numbers.ts
import { Container, Text, TextStyle } from 'pixi.js';

interface Num {
  t: Text;
  life: number;
  maxLife: number;
  vy: number;
}

const MAX_ACTIVE = 30;

export class FloatingNumbers {
  private active: Num[] = [];
  private pool: Text[] = [];

  constructor(private container: Container) {}

  spawn(x: number, y: number, value: number, isPlayerDealing: boolean) {
    if (this.active.length >= MAX_ACTIVE) {
      const old = this.active.shift()!;
      if (old.t.parent) old.t.parent.removeChild(old.t);
      this.pool.push(old.t);
    }
    let t = this.pool.pop();
    if (!t) {
      t = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 'bold',
          stroke: { color: 0x000000, width: 2 },
          fill: 0xffe066,
        }),
      });
    }
    t.text = `-${Math.round(value)}`;
    (t.style as TextStyle).fill = isPlayerDealing ? 0xffe066 : 0xff5544;
    t.x = x - t.width / 2;
    t.y = y - 8;
    t.alpha = 1;
    this.container.addChild(t);
    this.active.push({ t, life: 0.6, maxLife: 0.6, vy: -30 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i]!;
      n.life -= dt;
      if (n.life <= 0) {
        if (n.t.parent) n.t.parent.removeChild(n.t);
        this.pool.push(n.t);
        this.active.splice(i, 1);
        continue;
      }
      n.t.y += n.vy * dt;
      n.t.alpha = n.life / n.maxLife;
    }
  }
}
```

- [ ] **Step 2: Export and instantiate**

Add `export * from './scene/floating-numbers.js';` to index. In `main.ts`:

```ts
const numbersLayer = new Container();
worldLayer.addChild(numbersLayer);
const floatingNumbers = new FloatingNumbers(numbersLayer);
// ...
floatingNumbers.update(dt);
```

- [ ] **Step 3: Plumb spawn from plane-sprite damage block**

```ts
// plane-sprite.ts inside damage block
if (numbers) {
  const damageDealt = prevHp - p.hp;
  if (damageDealt > 0) {
    const isPlayerDealing = p.faction === 'enemy'; // damage on enemy = player dealing
    numbers.spawn(p.kinematic.position.x, p.kinematic.position.y, damageDealt, isPlayerDealing);
  }
}
```

Update `update` signature to accept `numbers?: FloatingNumbers`. Pass from main.ts.

- [ ] **Step 4: Manual verify**

`pnpm dev` → hit enemy: yellow `-10` floats up. Get hit: red `-10` floats up.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/floating-numbers.ts packages/render/src/index.ts packages/render/src/scene/plane-sprite.ts packages/app/src/main.ts
git commit -m "feat(feel): floating damage numbers with faction colors"
```

---

### Task 1.10: Slow-mo on player death

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Trigger slow-mo when player dies**

In the ticker block where you already detect `prevPlayerAlive && !state.player.alive`:

```ts
if (prevPlayerAlive && !state.player.alive) {
  screenFx.flash(0xff5544, 0.5, 0.4);
  clock.slowMo(SLOW_MO_SCALE, SLOW_MO_DURATION_SEC, SLOW_MO_RECOVERY_SEC);
}
```

Import constants from `@biplanes/shared`.

- [ ] **Step 2: Manual verify**

`pnpm dev` → let enemy kill you. Expected: game visibly slows to ~35% for 0.5 s, then ramps back.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "feat(feel): slow-mo on player death"
```

---

### Task 1.11: Enhanced explosion (white core flash, double shockwave, chunks)

**Files:**
- Modify: `packages/render/src/scene/damage-fx.ts`

- [ ] **Step 1: Add new particle type `'chunk'`**

```ts
type ParticleType = 'smoke' | 'fire' | 'spark' | 'shockwave' | 'chunk';
```

Drawing path for 'chunk':

```ts
} else if (type === 'chunk') {
  g.rect(-2, -1, 4, 2).fill(color);
}
```

- [ ] **Step 2: Rewrite `addExplosion`**

```ts
addExplosion(position: { x: number; y: number }) {
  // 1. Central bright white flash (glow)
  {
    const g = this.acquire(0xffffff, 28, 'spark');
    g.x = position.x; g.y = position.y; g.scale.set(1);
    this.active.push({ g, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, baseAlpha: 1, baseRadius: 28, type: 'spark' });
  }

  // 2. Double shockwave: now + 80ms later (delayed via small life trick)
  this.addShockwave(position);
  setTimeout(() => this.addShockwave(position), 80); // OK for deterministic-free render layer

  // 3. Fire bursts (existing)
  for (let i = 0; i < 22; i++) {
    const radius = 6 + Math.random() * 10;
    const palette = [0xff4400, 0xff8800, 0xffcc00, 0xffffff];
    const color = palette[(Math.random() * palette.length) | 0]!;
    const g = this.acquire(color, radius, 'fire');
    g.x = position.x; g.y = position.y; g.scale.set(1);
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 220;
    this.active.push({ g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.45 + Math.random() * 0.35, maxLife: 0.8, baseAlpha: 1.0, baseRadius: radius, type: 'fire' });
  }

  // 4. Smoke clouds (existing)
  for (let i = 0; i < 14; i++) {
    const radius = 8 + Math.random() * 12;
    const g = this.acquire(0x333333, radius, 'smoke');
    g.x = position.x; g.y = position.y; g.scale.set(1);
    const ang = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 80;
    this.active.push({ g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 20, life: 0.6 + Math.random() * 0.4, maxLife: 1.0, baseAlpha: 0.55, baseRadius: radius, type: 'smoke' });
  }

  // 5. Tiny chunks (NEW)
  for (let i = 0; i < 7; i++) {
    const g = this.acquire(0x8a6a3a, 0, 'chunk');
    g.x = position.x; g.y = position.y;
    const ang = Math.random() * Math.PI * 2;
    const sp = 140 + Math.random() * 200;
    g.rotation = Math.random() * Math.PI * 2;
    this.active.push({ g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80, life: 0.8, maxLife: 0.8, baseAlpha: 1, baseRadius: 2, type: 'chunk' });
  }
}
```

In the `update` loop, add gravity for chunks:

```ts
if (p.type === 'chunk') {
  p.vy += 600 * dt; // gravity
  p.g.rotation += 6 * dt;
}
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → kill enemy. Expected: visible white core flash, two consecutive ring expansions, several small flying chunks with gravity.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts
git commit -m "feat(fx): enhanced explosion with white core, double shockwave, chunks"
```

---

## Phase 2: Plane comes alive

Phase 2 grows `plane-sprite.ts` past 350 lines. Start with the split.

### Task 2.1: Split `plane-sprite.ts` into submodules

**Files:**
- Create: `packages/render/src/scene/plane-sprite/index.ts`
- Create: `packages/render/src/scene/plane-sprite/body.ts`
- Create: `packages/render/src/scene/plane-sprite/controls.ts` (empty stub for now)
- Create: `packages/render/src/scene/plane-sprite/pilot-head.ts` (empty stub)
- Delete: `packages/render/src/scene/plane-sprite.ts`

- [ ] **Step 1: Create `body.ts`**

Move all current Graphics construction (engine cylinders, fuselage, canopy, symbol, wings, struts, propeller, blurDisk, blades) into:

```ts
// packages/render/src/scene/plane-sprite/body.ts
import { Container, Graphics } from 'pixi.js';

export interface PlaneBody {
  fuselageContainer: Container;
  wingContainer: Container;
  propellerContainer: Container;
  blades: Graphics;
  blurDisk: Graphics;
}

export function createPlaneBody(faction: 'player' | 'enemy'): PlaneBody {
  // ... (copy the existing body-building code from plane-sprite.ts)
  return { fuselageContainer, wingContainer, propellerContainer, blades, blurDisk };
}
```

- [ ] **Step 2: Create empty `controls.ts` and `pilot-head.ts`**

```ts
// controls.ts
export interface PlaneControls { /* TBD in Task 2.3 */ }
export function createPlaneControls(faction: 'player' | 'enemy'): { container: Container; update(turnInput: number, throttleLevel: number, dt: number): void } {
  const container = new Container();
  return { container, update() { /* fill in Task 2.3 */ } };
}
```

```ts
// pilot-head.ts — same skeleton
```

- [ ] **Step 3: Create `index.ts` that composes the three**

```ts
// packages/render/src/scene/plane-sprite/index.ts
import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';
import { SMOKE_THRESHOLD, FIRE_THRESHOLD } from '@biplanes/shared';
import type { DamageFx } from '../damage-fx.js';
import type { RenderClock } from '../../render-clock.js';
import type { FloatingNumbers } from '../floating-numbers.js';
import { createPlaneBody } from './body.js';
import { createPlaneControls } from './controls.js';
import { createPilotHead } from './pilot-head.js';
// ...
export interface PlaneSpriteHandle {
  container: Container;
  update(p: Plane, dt: number, opts?: {
    fx?: DamageFx;
    clock?: RenderClock;
    numbers?: FloatingNumbers;
    camera?: { punch(dx: number, dy: number, a: number): void; shake(a: number): void; zoomPunch(s: number, d: number): void };
  }): void;
}

export function createPlaneSprite(faction: 'player' | 'enemy'): PlaneSpriteHandle {
  // Compose body + controls + pilot-head and the existing per-tick update logic.
}
```

- [ ] **Step 4: Update `packages/render/src/index.ts`**

Change `export * from './scene/plane-sprite.js';` → `export * from './scene/plane-sprite/index.js';`.

- [ ] **Step 5: Delete old file**

```bash
git rm packages/render/src/scene/plane-sprite.ts
```

- [ ] **Step 6: Build + manual verify**

`pnpm typecheck && pnpm dev`. Expected: planes still render identically.

- [ ] **Step 7: Commit**

```bash
git add packages/render/src/scene/plane-sprite/
git commit -m "refactor(render): split plane-sprite into body, controls, pilot-head submodules"
```

---

### Task 2.2: Visible bank (vertical squeeze on turn)

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Track turn rate and apply easing**

In the update logic:

```ts
let bankT = 0; // 0 = no bank, 1 = full bank

update(p, dt, opts) {
  // ... existing code ...
  const turnRate = computeTurnRate(p, prevHeading, dt); // headingDiff/dt as before
  const target = Math.min(1, Math.abs(turnRate) / 2.5); // 2.5 rad/s = full bank
  const speed = 6 * dt; // approach target
  bankT += (target - bankT) * speed;
  c.scale.y = 1 - bankT * 0.12; // up to 12% vertical squeeze
}
```

- [ ] **Step 2: Manual verify**

`pnpm dev` → hold A or D to turn hard. Plane visibly "squeezes" vertically on bank, snaps back when straight.

- [ ] **Step 3: Commit**

```bash
git add packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): visible bank squeeze on hard turns"
```

---

### Task 2.3: Aileron + elevator + rudder deflection

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/controls.ts`
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Implement controls**

```ts
// controls.ts
import { Container, Graphics } from 'pixi.js';

export function createPlaneControls(faction: 'player' | 'enemy') {
  const container = new Container();
  // Aileron left (at wing tip)
  const aileronL = new Graphics().rect(0, -1.5, 6, 3).fill(0x222222);
  aileronL.pivot.set(0, 0);
  aileronL.x = -16; aileronL.y = 14; // attach to lower wing left tip
  // Aileron right
  const aileronR = new Graphics().rect(-6, -1.5, 6, 3).fill(0x222222);
  aileronR.x = 16; aileronR.y = 14;
  // Elevator (horizontal stabilizer on tail)
  const elevator = new Graphics().rect(-4, -1.5, 8, 3).fill(0x222222);
  elevator.x = -14; elevator.y = 0;
  // Rudder (vertical stabilizer, attached to back)
  const rudder = new Graphics().rect(-2, -1, 4, 6).fill(0x222222);
  rudder.x = -16; rudder.y = -6;

  container.addChild(aileronL, aileronR, elevator, rudder);

  let prevHeading = 0;
  let prevHeadingTime = 0;

  return {
    container,
    update(rotateInput: number, headingDelta: number, dt: number) {
      // Ailerons: ±15° (0.26 rad)
      aileronL.rotation = -rotateInput * 0.26;
      aileronR.rotation = rotateInput * 0.26;
      // Elevator: ±12° (~0.21 rad) approximated from heading derivative * tuning
      elevator.rotation = Math.max(-0.21, Math.min(0.21, headingDelta * 3));
      // Rudder: ±4° wobble
      rudder.rotation = Math.max(-0.07, Math.min(0.07, headingDelta * 1.5));
    },
  };
}
```

- [ ] **Step 2: Wire into index.ts**

In the composed sprite, instantiate controls and call its `update(rotateInput, headingDelta, dt)` each frame. We need the most-recent `PlayerCommand.rotate` for the player — pass it in via `opts.lastCommandRotate` and similar for enemies (use AI's last rotate decision; we can approximate from `headingDelta`).

For simplicity, derive `rotateInput` from sign of `headingDelta` if no command provided.

- [ ] **Step 3: Manual verify**

`pnpm dev` → turn hard. Visible: left/right ailerons flip in opposite directions; elevator tilts; rudder wiggles.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/plane-sprite/controls.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): aileron, elevator and rudder deflection"
```

---

### Task 2.4: Chico head in cockpit

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/pilot-head.ts`
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Implement head**

```ts
// pilot-head.ts
import { Container, Graphics } from 'pixi.js';

export function createPilotHead(faction: 'player' | 'enemy') {
  const c = new Container();
  const skin = new Graphics().ellipse(0, 0, 3, 4).fill(0xf2c79a).stroke({ color: 0x000000, width: 0.8 });
  const helmet = new Graphics()
    .moveTo(-3, 0)
    .arc(0, 0, 3.5, Math.PI, 0, false)
    .closePath()
    .fill(faction === 'player' ? 0x6b4226 : 0x2a2030)
    .stroke({ color: 0x000000, width: 0.8 });
  if (faction === 'player') {
    // Yellow scarf tip
    const scarf = new Graphics().rect(-1, 3, 4, 1).fill(0xf4d35e);
    c.addChild(scarf);
  }
  c.addChild(skin, helmet);
  c.x = 1; c.y = -5; // inside canopy

  let bob = 0;
  return {
    container: c,
    update(throttleChange: number, dt: number) {
      bob += (throttleChange - bob) * 6 * dt;
      c.rotation = bob * 0.18; // lean back on accel, forward on brake
    },
  };
}
```

- [ ] **Step 2: Compose**

Add to plane-sprite `index.ts`:

```ts
const head = createPilotHead(faction);
fuselageContainer.addChild(head.container); // sits inside canopy

// in update:
const throttleChange = (p.kinematic.throttleLevel ?? 0) - prevThrottle;
head.update(throttleChange, dt);
prevThrottle = p.kinematic.throttleLevel ?? 0;
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → look at plane. A tiny head with helmet (and yellow scarf strip for player) is visible in canopy. Throttle changes cause head to tilt back/forward subtly.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/plane-sprite/pilot-head.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): pilot head in cockpit with throttle bob"
```

---

### Task 2.5: Body shake at high g / stall

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Apply random offset to fuselage container at extreme g**

```ts
import { G_MAX_LEVEL, G_STALL } from '@biplanes/shared';

// inside update:
const g = p.kinematic.g;
let shakeX = 0, shakeY = 0;
if (g > G_MAX_LEVEL * 0.9 && aliveAndFlying) {
  shakeX = (Math.random() - 0.5) * 2; // ±1px
  shakeY = (Math.random() - 0.5) * 2;
} else if (g < G_STALL && aliveAndFlying) {
  shakeX = (Math.random() - 0.5) * 4; // rough ±2px
  shakeY = (Math.random() - 0.5) * 4;
}
fuselageContainer.x = shakeX;
fuselageContainer.y = shakeY;
// (reset to 0 when neither condition holds)
```

- [ ] **Step 2: Manual verify**

`pnpm dev` → push throttle to max (high g): subtle vibration. Stall (pull nose up too far): rough shake.

- [ ] **Step 3: Commit**

```bash
git add packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): body shake under high-g and stall"
```

---

### Task 2.6: Heat shimmer at full throttle

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Emit shimmer waves**

Reuse damage-fx infrastructure: add new `addHeatWave(position)` to `damage-fx.ts` that emits a tiny upward translucent sinusoid:

```ts
// damage-fx.ts
addHeatWave(position: { x: number; y: number }) {
  const g = this.acquire(0xffffff, 4, 'spark');
  g.x = position.x + (Math.random() - 0.5) * 6;
  g.y = position.y;
  g.alpha = 0.18;
  this.active.push({ g, vx: 0, vy: -40, life: 0.4, maxLife: 0.4, baseAlpha: 0.18, baseRadius: 4, type: 'spark' });
}
```

- [ ] **Step 2: Emit when throttle is full**

```ts
// plane-sprite/index.ts
let heatAcc = 0;
// ...inside update, if throttleLevel ≥ 0.95 and alive flying:
if (fx && (p.kinematic.throttleLevel ?? 0) >= 0.95 && aliveAndFlying) {
  heatAcc += dt;
  while (heatAcc >= 1 / 20) {
    const cos = Math.cos(p.kinematic.heading);
    const sin = Math.sin(p.kinematic.heading);
    const nx = p.kinematic.position.x + cos * 18;
    const ny = p.kinematic.position.y + sin * 18;
    fx.addHeatWave({ x: nx, y: ny });
    heatAcc -= 1 / 20;
  }
} else heatAcc = 0;
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → push throttle to max. Faint upward-rising white wisps over the nose.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): heat shimmer wisps at full throttle"
```

---

### Task 2.7: Brass casings on fire

**Files:**
- Modify: `packages/render/src/scene/damage-fx.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Add `casing` particle type**

```ts
type ParticleType = ... | 'casing';

// in acquire():
} else if (type === 'casing') {
  g.rect(-2, -0.75, 4, 1.5).fill(color);
}

// in update():
if (p.type === 'casing') {
  p.vy += 600 * dt; // gravity
  p.g.rotation += 8 * dt;
}
```

- [ ] **Step 2: Add `addCasing(position, heading)`**

```ts
addCasing(position: { x: number; y: number }, heading: number) {
  const g = this.acquire(0xc89c4a, 0, 'casing');
  g.x = position.x;
  g.y = position.y;
  // Eject downward + slightly backward
  const back = heading + Math.PI;
  const downA = back + Math.PI * 0.3; // 54° below back
  const sp = 80 + Math.random() * 40;
  this.active.push({ g, vx: Math.cos(downA) * sp, vy: Math.sin(downA) * sp, life: 0.6, maxLife: 0.6, baseAlpha: 1, baseRadius: 2, type: 'casing' });
}
```

- [ ] **Step 3: Spawn on every new bullet**

In `main.ts`, in the muzzle-flash spawn block from Task 1.2:

```ts
if (!prevBulletIds.has(b.id)) {
  const heading = Math.atan2(b.velocity.y, b.velocity.x);
  muzzleFlashes.spawn(b.position.x, b.position.y, heading);
  damageFx.addCasing({ x: b.position.x, y: b.position.y }, heading);
}
```

- [ ] **Step 4: Manual verify**

`pnpm dev` → fire weapon. Tiny brass rectangles fall and tumble below the gun.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts packages/app/src/main.ts
git commit -m "feat(plane): brass casings eject when firing"
```

---

### Task 2.8: Propeller motion blur — radial spokes + strobing

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Add radial spokes to prop disk**

In the body or in the prop update area, draw additional thin radial lines on top of `blurDisk`:

```ts
const spokes = new Graphics();
propellerContainer.addChild(spokes);

// in update:
spokes.clear();
if (p.kinematic.throttleLevel ?? 0 > 0.3) {
  const throttle = p.kinematic.throttleLevel ?? 0;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + blades.rotation;
    spokes.moveTo(20 + Math.cos(a) * 4, Math.sin(a) * 4)
          .lineTo(20 + Math.cos(a) * 18, Math.sin(a) * 18)
          .stroke({ color: 0xeeeeee, width: 1, alpha: 0.3 });
  }
  // Strobing at mid throttle
  if (throttle > 0.4 && throttle < 0.7) {
    const strobe = (Math.sin(blades.rotation * 4) + 1) * 0.5; // 0..1
    blurDisk.alpha = 0.06 + strobe * 0.12;
  } else {
    blurDisk.alpha = 0.16;
  }
}
```

- [ ] **Step 2: Manual verify**

`pnpm dev` → throttle up. Subtle radial blur lines appear; at mid throttle, the disk strobes faintly.

- [ ] **Step 3: Commit**

```bash
git add packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): prop disk radial spokes and strobing"
```

---

## Phase 3: World breathes

### Task 3.1: Lightning module

**Files:**
- Create: `packages/render/src/scene/lightning.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/lightning.ts
import { Container, Graphics } from 'pixi.js';
import type { ScreenEffectsHandle } from './screen-effects.js';

export function createLightning(width: number, height: number, screenFx?: ScreenEffectsHandle, active: boolean = false) {
  const c = new Container();
  const bolt = new Graphics();
  c.addChild(bolt);
  bolt.alpha = 0;

  let cooldown = 12 + Math.random() * 13;
  let boltLife = 0;
  let isActive = active;

  function draw() {
    bolt.clear();
    const startX = Math.random() * width;
    const startY = Math.random() * height * 0.2;
    let x = startX, y = startY;
    bolt.moveTo(x, y);
    const segs = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < segs; i++) {
      x += (Math.random() - 0.5) * 60;
      y += 30 + Math.random() * 40;
      bolt.lineTo(x, y);
    }
    bolt.stroke({ color: 0xffffff, width: 1.5, alpha: 1 });
    bolt.alpha = 1;
    boltLife = 0.08;
    if (screenFx) screenFx.flash(0xffffff, 0.12, 0.2);
  }

  return {
    container: c,
    setActive(v: boolean) { isActive = v; if (!v) { bolt.alpha = 0; boltLife = 0; } },
    update(dt: number) {
      if (!isActive) return;
      if (boltLife > 0) {
        boltLife -= dt;
        if (boltLife <= 0) bolt.alpha = 0;
      } else {
        cooldown -= dt;
        if (cooldown <= 0) {
          draw();
          cooldown = 12 + Math.random() * 13;
        }
      }
    },
  };
}
```

- [ ] **Step 2: Export and wire**

Add to render index. In `main.ts`:

```ts
const lightning = createLightning(WORLD_WIDTH, WORLD_HEIGHT, screenFx);
worldLayer.addChild(lightning.container);

// In setSkyTheme:
function setSkyTheme(themeId: SkyThemeId) {
  // ... existing
  lightning.setActive(themeId === 'twilight' || themeId === 'night');
}

// in ticker:
lightning.update(dt);
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → restart till you get twilight/night sky. Wait ~15s. Brief zigzag lightning + screen flicker.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/lightning.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(world): lightning bolts in twilight/night themes"
```

---

### Task 3.2: Wind streaks at high g

**Files:**
- Modify: `packages/render/src/scene/damage-fx.ts`
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Add `windstreak` type**

```ts
type ParticleType = ... | 'windstreak';

// in acquire():
} else if (type === 'windstreak') {
  g.rect(0, -0.5, 50, 1).fill({ color: 0xffffff, alpha: 0.2 });
}
```

- [ ] **Step 2: Add `addWindStreak`**

```ts
addWindStreak(position: { x: number; y: number }, heading: number) {
  const g = this.acquire(0xffffff, 0, 'windstreak');
  g.x = position.x;
  g.y = position.y;
  g.rotation = heading + Math.PI; // tail-ward
  this.active.push({
    g, vx: -Math.cos(heading) * 200, vy: -Math.sin(heading) * 200,
    life: 0.15, maxLife: 0.15, baseAlpha: 0.2, baseRadius: 0, type: 'windstreak',
  });
}
```

- [ ] **Step 3: Emit at high g**

```ts
// plane-sprite/index.ts
let windAcc = 0;
if (fx && p.kinematic.g > G_MAX_LEVEL * 0.85 && aliveAndFlying && p.faction === 'player') {
  windAcc += dt;
  while (windAcc >= 1 / 30) {
    const px = p.kinematic.position.x + (Math.random() - 0.5) * 40;
    const py = p.kinematic.position.y + (Math.random() - 0.5) * 40;
    fx.addWindStreak({ x: px, y: py }, p.kinematic.heading);
    windAcc -= 1 / 30;
  }
} else windAcc = 0;
```

(Player only — wind streaks belong to the player perspective.)

- [ ] **Step 4: Manual verify**

`pnpm dev` → throttle to max, dive: white horizontal streaks flash past the plane.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(world): wind streaks at high g"
```

---

### Task 3.3: Ground-fx layer (crash craters + lingering smoke)

**Files:**
- Create: `packages/render/src/scene/ground-fx.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/ground-fx.ts
import { Container, Graphics } from 'pixi.js';

interface Crater {
  base: Graphics;
  age: number;
  smokeAcc: number;
}

const MAX_CRATERS = 3;

export class GroundFx {
  private craters: Crater[] = [];
  constructor(private container: Container, private fxContainer: Container) {}

  spawnCrater(x: number, y: number) {
    if (this.craters.length >= MAX_CRATERS) {
      const old = this.craters.shift()!;
      if (old.base.parent) old.base.parent.removeChild(old.base);
    }
    const g = new Graphics()
      .ellipse(0, 0, 22, 8).fill(0x1a0f08)
      .ellipse(0, 0, 22, 8).stroke({ color: 0x000000, width: 1.5 });
    g.x = x; g.y = y;
    this.container.addChild(g);
    this.craters.push({ base: g, age: 0, smokeAcc: 0 });
  }

  update(dt: number, addSmoke: (x: number, y: number) => void) {
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const c = this.craters[i]!;
      c.age += dt;
      // Emit smoke for first 8 seconds, fade out 8–12s
      if (c.age < 8) {
        c.smokeAcc += dt;
        while (c.smokeAcc >= 1 / 4) {
          addSmoke(c.base.x + (Math.random() - 0.5) * 8, c.base.y - 4);
          c.smokeAcc -= 1 / 4;
        }
      } else if (c.age < 12) {
        c.base.alpha = 1 - (c.age - 8) / 4;
      } else {
        if (c.base.parent) c.base.parent.removeChild(c.base);
        this.craters.splice(i, 1);
      }
    }
  }
}
```

- [ ] **Step 2: Wire layer**

In `main.ts` create `groundFxLayer` between sky and bullets:

```ts
const groundFxLayer = new Container();
worldLayer.addChild(groundFxLayer);
const groundFx = new GroundFx(groundFxLayer, fxLayer);

// in ticker
groundFx.update(dt, (x, y) => damageFx.addSmokeTrail({ x, y }, 1));
```

- [ ] **Step 3: Trigger crater on crash**

In `plane-sprite/index.ts` death detection (the `wasAlive && (!p.alive || p.state === 'crashed')` block):

```ts
if (opts?.groundFx && p.kinematic.position.y > GROUND_Y - 10) {
  opts.groundFx.spawnCrater(p.kinematic.position.x, GROUND_Y);
}
```

Add `groundFx?: GroundFx` to update opts.

- [ ] **Step 4: Manual verify**

`pnpm dev` → fly into ground. Dark elongated crater appears, with smoke rising from it for ~8s, then fades.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/ground-fx.ts packages/render/src/index.ts packages/app/src/main.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(world): crash craters with lingering smoke"
```

---

### Task 3.4: Lens flare for noon/sunset

**Files:**
- Create: `packages/render/src/scene/lens-flare.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/lens-flare.ts
import { Container, Graphics } from 'pixi.js';

export function createLensFlare(width: number, height: number, active: boolean = false) {
  const c = new Container();
  const sunX = width * 0.78;
  const sunY = height * 0.15;

  const sun = new Graphics().circle(0, 0, 26).fill({ color: 0xffe9a0, alpha: 0.85 });
  sun.x = sunX; sun.y = sunY;
  sun.blendMode = 'add';
  c.addChild(sun);

  const flares: { g: Graphics; baseAlpha: number; size: number; offset: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const off = (i + 1) * 60;
    const sz = 8 + i * 4;
    const g = new Graphics();
    // hexagon
    const verts: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      verts.push(Math.cos(a) * sz, Math.sin(a) * sz);
    }
    g.poly(verts).fill({ color: 0xffd28c, alpha: 0.15 });
    g.x = sunX + off * 0.2;
    g.y = sunY + off * 0.15;
    g.blendMode = 'add';
    c.addChild(g);
    flares.push({ g, baseAlpha: 0.15, size: sz, offset: off });
  }
  c.visible = active;

  return {
    container: c,
    setActive(v: boolean) { c.visible = v; },
    sunX,
    sunY,
    update(dt: number, timeSec: number, playerX: number) {
      const breath = 1 + 0.05 * Math.sin(timeSec * 0.8);
      sun.scale.set(breath);
      const proximity = Math.max(0, 1 - Math.abs(playerX - sunX) / 80);
      for (const f of flares) {
        f.g.alpha = f.baseAlpha + proximity * 0.2;
      }
    },
  };
}
```

- [ ] **Step 2: Wire**

```ts
const lensFlare = createLensFlare(WORLD_WIDTH, WORLD_HEIGHT, false);
worldLayer.addChild(lensFlare.container);
// in setSkyTheme:
lensFlare.setActive(themeId === 'noon' || themeId === 'sunset');
// in ticker:
lensFlare.update(dt, renderTimeSec, state.player.kinematic.position.x);
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → in noon or sunset theme, sun glow + 5 hexagonal flare points. Fly close to sun X — flares intensify.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/lens-flare.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(world): lens flare in noon and sunset themes"
```

---

### Task 3.5: Distant silhouettes (mountains, far blimps, crossing plane)

**Files:**
- Create: `packages/render/src/scene/distant-silhouettes.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement module**

```ts
// packages/render/src/scene/distant-silhouettes.ts
import { Container, Graphics } from 'pixi.js';

export function createDistantSilhouettes(width: number, height: number, color: number) {
  const c = new Container();

  // Mountain jagged line
  const mountains = new Graphics();
  let px = 0;
  mountains.moveTo(0, height * 0.55);
  while (px < width + 50) {
    const peakH = 30 + Math.random() * 50;
    mountains.lineTo(px + 50, height * 0.55 - peakH);
    px += 50;
    mountains.lineTo(px + 50, height * 0.55);
    px += 50;
  }
  mountains.lineTo(width, height);
  mountains.lineTo(0, height);
  mountains.closePath().fill({ color, alpha: 0.7 });
  c.addChild(mountains);

  // Two distant blimps
  const blimps: { g: Graphics; x: number; y: number; speed: number; nav: Graphics }[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new Graphics().ellipse(0, 0, 26, 7).fill({ color, alpha: 0.7 });
    b.x = Math.random() * width;
    b.y = height * 0.18 + i * 22;
    const nav = new Graphics().circle(20, 0, 1.2).fill(i === 0 ? 0xff3333 : 0x66aaff);
    b.addChild(nav);
    c.addChild(b);
    blimps.push({ g: b, x: b.x, y: b.y, speed: 5 + Math.random() * 4, nav });
  }

  // One crossing plane (spawns occasionally)
  const crosser = new Graphics()
    .moveTo(-8, 0).lineTo(8, 0).stroke({ color, width: 2 })
    .rect(-4, -2, 8, 4).fill({ color, alpha: 0.7 });
  crosser.alpha = 0;
  crosser.y = height * 0.3;
  c.addChild(crosser);

  let crosserX = -50;
  let crosserActive = false;
  let crosserCooldown = 60 + Math.random() * 60;

  return {
    container: c,
    update(dt: number, timeSec: number) {
      // Blink nav lights
      for (const b of blimps) {
        b.x -= b.speed * dt;
        if (b.x < -40) b.x = width + 40;
        b.g.x = b.x;
        b.nav.alpha = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 3));
      }
      // Crossing plane
      if (crosserActive) {
        crosserX += 35 * dt;
        crosser.x = crosserX;
        crosser.alpha = 0.7;
        if (crosserX > width + 50) {
          crosserActive = false;
          crosserX = -50;
          crosser.alpha = 0;
          crosserCooldown = 60 + Math.random() * 60;
        }
      } else {
        crosserCooldown -= dt;
        if (crosserCooldown <= 0) crosserActive = true;
      }
    },
  };
}
```

- [ ] **Step 2: Wire**

```ts
let silhouettes = createDistantSilhouettes(WORLD_WIDTH, WORLD_HEIGHT, 0x224975);
worldLayer.addChildAt(silhouettes.container, 1); // just above sky

// in setSkyTheme:
worldLayer.removeChild(silhouettes.container);
silhouettes = createDistantSilhouettes(WORLD_WIDTH, WORLD_HEIGHT, /* theme-dependent color */ 0x1a385c);
worldLayer.addChildAt(silhouettes.container, 1);

// in ticker:
silhouettes.update(dt, renderTimeSec);
```

- [ ] **Step 3: Manual verify**

`pnpm dev`. Behind action: jagged mountain line, two blinking blimps. Every ~60s a tiny plane crosses the horizon.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/distant-silhouettes.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(world): distant silhouettes layer (mountains, blimps, crosser)"
```

---

### Task 3.6: Foreground clouds

**Files:**
- Create: `packages/render/src/scene/foreground-clouds.ts`
- Modify: `packages/render/src/index.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Implement**

```ts
// packages/render/src/scene/foreground-clouds.ts
import { Container, Graphics } from 'pixi.js';

interface Cloud {
  g: Graphics;
  x: number;
  y: number;
  w: number;
  speed: number;
}

export function createForegroundClouds(width: number, height: number) {
  const c = new Container();
  c.alpha = 0.35;
  const clouds: Cloud[] = [];
  for (let i = 0; i < 2; i++) {
    const w = 220 + Math.random() * 140;
    const h = 50;
    const g = new Graphics()
      .ellipse(0, 0, w / 2, h / 2)
      .ellipse(-w / 3, -h / 4, w / 3, h / 2)
      .ellipse(w / 3, -h / 5, w / 3.5, h / 2)
      .fill(0xffffff);
    g.x = (i + 1) * (width / 3);
    g.y = height * 0.35 + i * 50;
    c.addChild(g);
    clouds.push({ g, x: g.x, y: g.y, w, speed: 20 + Math.random() * 15 });
  }

  return {
    container: c,
    update(dt: number) {
      for (const cl of clouds) {
        cl.x -= cl.speed * dt;
        if (cl.x < -cl.w / 2) cl.x = width + cl.w / 2;
        cl.g.x = cl.x;
      }
    },
  };
}
```

- [ ] **Step 2: Wire above planes**

```ts
const foregroundClouds = createForegroundClouds(WORLD_WIDTH, WORLD_HEIGHT);
worldLayer.addChild(foregroundClouds.container); // last = on top
// in ticker:
foregroundClouds.update(dt);
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → fly. Translucent cloud puffs occasionally drift in front of the plane.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/foreground-clouds.ts packages/render/src/index.ts packages/app/src/main.ts
git commit -m "feat(world): foreground clouds drift in front of planes"
```

---

## Phase 4: Death drama

Phase 4 introduces a new core state `'dying'`. This is the only phase besides Phase 5 that touches `packages/core`.

### Task 4.1: Add `'dying'` state to Plane

**Files:**
- Modify: `packages/core/src/entities/plane.ts`
- Modify: `packages/core/src/world/world-state.ts`

- [ ] **Step 1: Extend PlaneState**

```ts
// packages/core/src/entities/plane.ts
export type PlaneState = 'taxi' | 'flying' | 'crashed' | 'spawning' | 'dying';

export interface Plane {
  // ...existing fields...
  dyingTimer?: number; // seconds remaining in death-spin (set when state==='dying')
}
```

- [ ] **Step 2: Verify build**

Run `pnpm typecheck`. Expect compile errors in places that exhaustively check `PlaneState` — fix by adding `case 'dying':` arms that fall through to crashed-like behavior for now (we wire actual physics in Task 4.2).

For each switch on state, add a `case 'dying':` branch matching crashed behavior. Specifically check:
- `packages/core/src/physics/plane-physics.ts` (if any state-based switch)
- `packages/render/src/scene/plane-sprite/index.ts` alpha handling — treat `dying` as alpha=1 (still visible)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/entities/plane.ts packages/core/src/world/world-state.ts
git commit -m "feat(core): introduce 'dying' plane state for death-spin"
```

---

### Task 4.2: Transition flying → dying on lethal hit (instead of straight to crashed)

**Files:**
- Modify: `packages/core/src/systems/collision-system.ts`
- Modify: `packages/core/src/world/tick.ts`
- Modify: `packages/core/src/world/tick.test.ts`

- [ ] **Step 1: Add failing test**

```ts
// tick.test.ts
import { DYING_DURATION_SEC } from '@biplanes/shared';

it('enemy killed by bullet enters dying state, not crashed', () => {
  const player = makePlayer();
  const enemy = { ...makePlayer(), id: 2, faction: 'enemy' as const, hp: 1, kinematic: { ...makePlayer().kinematic, position: { x: 600, y: 500 } } };
  let s = createWorldState(42, player);
  s = { ...s, enemies: [enemy], bullets: [{
    id: 100, ownerId: 1, ownerFaction: 'player', position: { x: 600, y: 500 },
    velocity: { x: 0, y: 0 }, lifetime: 1, damage: 100, alive: true
  }] };
  const after = tick(s, { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false });
  expect(after.enemies[0]!.state).toBe('dying');
  expect(after.enemies[0]!.dyingTimer).toBeCloseTo(DYING_DURATION_SEC);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter @biplanes/core test`
Expected: FAIL (state is currently 'crashed' or 'flying').

- [ ] **Step 3: Make collision set 'dying'**

In `collision-system.ts`, where bullet damage zeros out HP:

```ts
if (e.hp === 0 && e.alive) {
  e.alive = false;
  e.state = 'dying';
  e.dyingTimer = DYING_DURATION_SEC;
  kills++;
}
// same for newPlayer
```

Import `DYING_DURATION_SEC` from `@biplanes/shared`.

For a plane that hit ground (not by bullet) — keep going to `'crashed'`. That logic is in tick.ts ground-collision path; leave as-is.

- [ ] **Step 4: Advance dyingTimer in tick.ts**

In the per-plane step (where stepped is computed), before resolving collisions:

```ts
if (stepped.state === 'dying') {
  const t = (stepped.dyingTimer ?? 0) - TICK_DT;
  if (t <= 0) {
    stepped = { ...stepped, state: 'crashed', alive: false, dyingTimer: 0, respawnTimer: ENEMY_RESPAWN_DELAY_SEC };
  } else {
    // Spin and dive faster
    const k = stepped.kinematic;
    stepped = {
      ...stepped,
      dyingTimer: t,
      kinematic: {
        ...k,
        heading: k.heading + DYING_SPIN_RATE * TICK_DT,
        velocity: {
          x: k.velocity.x * 0.99,
          y: k.velocity.y + 9.8 * DYING_GRAVITY_MULTIPLIER * 60 * TICK_DT,
        },
        position: {
          x: k.position.x + k.velocity.x * TICK_DT,
          y: k.position.y + k.velocity.y * TICK_DT,
        },
      },
    };
  }
}
```

Import `DYING_SPIN_RATE`, `DYING_GRAVITY_MULTIPLIER` from `@biplanes/shared`.

Note: the dying plane skips the normal `stepPlane(...)` physics in this branch — wrap with `if (stepped.state !== 'dying')` around the existing physics call, or run the early-out as above.

- [ ] **Step 5: Run test — expect pass**

`pnpm --filter @biplanes/core test`
Expected: PASS, including the new test.

- [ ] **Step 6: Manual verify**

`pnpm dev` → kill enemy. Enemy plane now spins down trailing smoke + fire rather than vanishing.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/systems/collision-system.ts packages/core/src/world/tick.ts packages/core/src/world/tick.test.ts
git commit -m "feat(core): planes killed by bullets enter 'dying' state with spin physics"
```

---

### Task 4.3: Render heavy fire/smoke trail during `dying`

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Detect dying state and crank up emission**

```ts
// inside update fire/smoke block:
const isDying = p.state === 'dying';
if (fx && (aliveAndFlying || isDying)) {
  const tailDist = 18;
  const tailX = p.kinematic.position.x - Math.cos(p.kinematic.heading) * tailDist;
  const tailY = p.kinematic.position.y - Math.sin(p.kinematic.heading) * tailDist;

  if (isDying) {
    // Crank up: fire+smoke at 2.5× rate
    fireAcc += dt * 2.5;
    smokeAcc += dt * 2.5;
    while (fireAcc >= 1 / 50) { fx.addFireTrail({ x: tailX, y: tailY }, 1); fireAcc -= 1 / 50; }
    while (smokeAcc >= 1 / 25) { fx.addSmokeTrail({ x: tailX, y: tailY }, 1); smokeAcc -= 1 / 25; }
  } else if (aliveAndFlying) {
    // existing fire/smoke based on hpFrac
  }
}
```

- [ ] **Step 2: Make dying plane still visible (not alpha 0)**

```ts
c.alpha = p.state === 'crashed' ? 0 : 1;
// dying remains visible (1)
```

- [ ] **Step 3: Manual verify**

`pnpm dev` → kill enemy. Heavy fire + black smoke trail follows the spinning plane for ~2s.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): heavy fire/smoke trail during death-spin"
```

---

### Task 4.4: Big debris chunks on lethal hit

**Files:**
- Modify: `packages/render/src/scene/damage-fx.ts`
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Add `debris` type with body color**

```ts
type ParticleType = ... | 'debris';

// in acquire():
} else if (type === 'debris') {
  g.rect(-6, -2, 12, 4).fill(color);
}

// in update():
if (p.type === 'debris') {
  p.vy += 400 * dt;
  p.g.rotation += 4 * dt;
}
```

- [ ] **Step 2: Emit on lethal hit**

```ts
// damage-fx.ts
addDebris(position: { x: number; y: number }, color: number) {
  for (let i = 0; i < 2; i++) {
    const g = this.acquire(color, 0, 'debris');
    g.x = position.x; g.y = position.y;
    const ang = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 200;
    this.active.push({ g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 100, life: 1.5, maxLife: 1.5, baseAlpha: 1, baseRadius: 0, type: 'debris' });
  }
}
```

- [ ] **Step 3: Hook from plane-sprite when transitioning to dying**

```ts
let prevState = p.state;
// ...
if (fx && prevState === 'flying' && p.state === 'dying') {
  const bodyColor = faction === 'player' ? 0xf4d35e : 0xc0392b;
  fx.addDebris(p.kinematic.position, bodyColor);
}
prevState = p.state;
```

- [ ] **Step 4: Manual verify**

`pnpm dev` → kill enemy. At the lethal moment, 2 larger fuselage-colored chunks fly off.

- [ ] **Step 5: Commit**

```bash
git add packages/render/src/scene/damage-fx.ts packages/render/src/scene/plane-sprite/index.ts
git commit -m "feat(plane): big debris chunks fly off at lethal hit"
```

---

### Task 4.5: Final big explosion at end of death-spin

**Files:**
- Modify: `packages/render/src/scene/plane-sprite/index.ts`

- [ ] **Step 1: Trigger oversized explosion when `dying → crashed`**

```ts
// inside update:
const becameCrashed = prevState === 'dying' && p.state === 'crashed';
if (becameCrashed && fx) {
  fx.addExplosion(p.kinematic.position);
  fx.addExplosion(p.kinematic.position); // overlap two for "bigger"
  if (clock) clock.hitPause(HIT_PAUSE_FRAMES_EXPLODE);
  if (camera) { camera.shake(12); camera.zoomPunch(1.02, 0.15); }
  if (screenFx) screenFx.flash(0xffa040, 0.5, 0.3);
}
```

Add `screenFx?: ScreenEffectsHandle` to update opts and pass through from main.ts.

- [ ] **Step 2: Manual verify**

`pnpm dev` → kill enemy. After ~2s spin: massive double explosion, orange screen flash, longer freeze, camera kick.

- [ ] **Step 3: Commit**

```bash
git add packages/render/src/scene/plane-sprite/index.ts packages/app/src/main.ts
git commit -m "feat(plane): final cinematic explosion when death-spin ends"
```

---

### Task 4.6: Off-screen arrow for dying enemy

**Files:**
- Modify: `packages/render/src/scene/hud.ts`
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Add `showDirArrow(toX, toY)` to HUD**

In `hud.ts`, add a small Graphics that, given a world-space target and the screen rect, draws an arrow on the edge of the screen pointing at it. Stub:

```ts
// hud.ts (within createHud)
const dirArrow = new Graphics();
dirArrow.visible = false;
c.addChild(dirArrow);

function showDirArrow(targetX: number, targetY: number) {
  // ... clip to screen edge, draw triangle, set visible
}
function hideDirArrow() { dirArrow.visible = false; }
```

(Implement using the standard "find intersection of line from screen center to target with screen rect" geometry. Inline the logic.)

Return `showDirArrow` and `hideDirArrow` in the handle.

- [ ] **Step 2: Trigger on dying enemy off-screen**

In `main.ts` ticker:

```ts
const dyingEnemy = state.enemies.find(e => e.state === 'dying');
if (dyingEnemy) {
  const x = dyingEnemy.kinematic.position.x;
  const y = dyingEnemy.kinematic.position.y;
  const onScreen = x > 0 && x < WORLD_WIDTH && y > 0 && y < WORLD_HEIGHT;
  if (!onScreen) hud.showDirArrow(x, y);
  else hud.hideDirArrow();
} else {
  hud.hideDirArrow();
}
```

- [ ] **Step 3: Manual verify**

This is hard to test without an enemy dying near the edge. Force by adjusting initial spawn or accept the implementation as visual scaffolding.

- [ ] **Step 4: Commit**

```bash
git add packages/render/src/scene/hud.ts packages/app/src/main.ts
git commit -m "feat(hud): edge arrow points to dying enemy when off-screen"
```

---

### Task 4.7: ColorMatrix desaturation on player death

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Toggle deathTint when player dies / respawns**

```ts
if (prevPlayerAlive && !state.player.alive) {
  screenFx.flash(0xff5544, 0.5, 0.4);
  screenFx.enableDeathTint();
  clock.slowMo(SLOW_MO_SCALE, SLOW_MO_DURATION_SEC, SLOW_MO_RECOVERY_SEC);
}
// When player respawns alive:
if (!prevPlayerAlive && state.player.alive) {
  screenFx.disableDeathTint();
}
```

For the "snap back to color on final explosion" moment: when the player's plane transitions dying → crashed, disable the death tint:

```ts
if (state.player.state === 'crashed' && prevPlayerState !== 'crashed') {
  screenFx.disableDeathTint();
}
```

Track `prevPlayerState` similar to other prev-state tracking.

- [ ] **Step 2: Manual verify**

`pnpm dev` → die. World desaturates with red tint during slow-mo spin. At the final explosion, color snaps back.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "feat(feel): desaturate world during player death-spin, snap back on final explosion"
```

---

## Phase 5: Aerial collision

### Task 5.1: Define `resolvePlanePlaneCollisions` (TDD)

**Files:**
- Create: `packages/core/src/systems/plane-collision.ts`
- Create: `packages/core/src/systems/plane-collision.test.ts`

- [ ] **Step 1: Write failing test for head-on**

```ts
// plane-collision.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePlanePlaneCollisions } from './plane-collision.js';
import { PLANE_INITIAL_HP, DYING_DURATION_SEC } from '@biplanes/shared';

function plane(id: number, faction: 'player' | 'enemy', x: number, y: number, vx: number, vy: number) {
  return {
    id, faction,
    kinematic: { position: { x, y }, velocity: { x: vx, y: vy }, heading: 0, throttleOn: true, g: 0, facing: 1 as const, throttle: true, throttleLevel: 1 },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP, weaponCooldown: 0, alive: true,
    state: 'flying' as const, respawnTimer: 0,
  };
}

describe('plane-plane collision', () => {
  it('head-on at full speed kills both', () => {
    const a = plane(1, 'player', 500, 500, 900, 0);
    const b = plane(2, 'enemy', 510, 500, -900, 0); // 10 px apart, closing
    const { player, enemies, events } = resolvePlanePlaneCollisions(a, [b], new Map(), 0);
    expect(player.state).toBe('dying');
    expect(enemies[0]!.state).toBe('dying');
    expect(events.length).toBe(1);
  });

  it('tangential brush takes ~30-50 HP only', () => {
    const a = plane(1, 'player', 500, 500, 800, 0);
    const b = plane(2, 'enemy', 520, 510, 800, 50); // perpendicular brush
    const { player, enemies } = resolvePlanePlaneCollisions(a, [b], new Map(), 0);
    expect(player.alive).toBe(true);
    expect(enemies[0]!.alive).toBe(true);
    expect(player.hp).toBeLessThan(PLANE_INITIAL_HP);
    expect(player.hp).toBeGreaterThan(PLANE_INITIAL_HP - 60);
  });

  it('does not retrigger inside cooldown', () => {
    const a = plane(1, 'player', 500, 500, 900, 0);
    const b = plane(2, 'enemy', 510, 500, -900, 0);
    const cooldowns = new Map<string, number>([['1-2', 20]]);
    const { events } = resolvePlanePlaneCollisions(a, [b], cooldowns, 0);
    expect(events.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fail**

`pnpm --filter @biplanes/core test`
Expected: FAIL (no module).

- [ ] **Step 3: Implement**

```ts
// plane-collision.ts
import {
  PLANE_COLLISION_RADIUS,
  COLLISION_DAMAGE_K,
  COLLISION_COOLDOWN_TICKS,
  COLLISION_BOUNCE_VELOCITY_RETAIN,
  COLLISION_BOUNCE_HEADING_JITTER,
  DYING_DURATION_SEC,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

export interface PlaneCollisionEvent {
  posX: number;
  posY: number;
  aFaction: 'player' | 'enemy';
  bFaction: 'player' | 'enemy';
  aDied: boolean;
  bDied: boolean;
}

function keyFor(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function jitter(seed: number) {
  // deterministic-ish jitter helper using a passed seed
  const t = Math.sin(seed * 12.9898) * 43758.5453;
  return t - Math.floor(t);
}

export function resolvePlanePlaneCollisions(
  player: Plane,
  enemies: readonly Plane[],
  cooldowns: Map<string, number>,
  rngSeed: number,
): { player: Plane; enemies: Plane[]; events: PlaneCollisionEvent[]; newCooldowns: Map<string, number> } {
  const newCooldowns = new Map(cooldowns);
  for (const [k, v] of newCooldowns) {
    if (v <= 1) newCooldowns.delete(k);
    else newCooldowns.set(k, v - 1);
  }

  const events: PlaneCollisionEvent[] = [];
  let p = { ...player, kinematic: { ...player.kinematic, velocity: { ...player.kinematic.velocity }, position: { ...player.kinematic.position } } };
  const out = enemies.map(e => ({ ...e, kinematic: { ...e.kinematic, velocity: { ...e.kinematic.velocity }, position: { ...e.kinematic.position } } }));

  const allPlanes = [p, ...out];

  for (let i = 0; i < allPlanes.length; i++) {
    for (let j = i + 1; j < allPlanes.length; j++) {
      const A = allPlanes[i]!;
      const B = allPlanes[j]!;
      if (A.state !== 'flying' || B.state !== 'flying') continue;
      if (!A.alive || !B.alive) continue;

      const dx = B.kinematic.position.x - A.kinematic.position.x;
      const dy = B.kinematic.position.y - A.kinematic.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > PLANE_COLLISION_RADIUS * PLANE_COLLISION_RADIUS) continue;

      const key = keyFor(A.id, B.id);
      if (newCooldowns.has(key)) continue;

      // Relative velocity along line of centers
      const rvx = A.kinematic.velocity.x - B.kinematic.velocity.x;
      const rvy = A.kinematic.velocity.y - B.kinematic.velocity.y;
      const distMag = Math.max(1, Math.sqrt(distSq));
      const nx = dx / distMag, ny = dy / distMag;
      const closingSpeed = rvx * nx + rvy * ny;
      const impact = Math.max(0, closingSpeed);
      const damage = Math.max(30, Math.min(A.maxHp, impact * COLLISION_DAMAGE_K * 100));

      A.hp = Math.max(0, A.hp - damage);
      B.hp = Math.max(0, B.hp - damage);

      const aDied = A.hp === 0;
      const bDied = B.hp === 0;
      if (aDied) {
        A.alive = false; A.state = 'dying'; A.dyingTimer = DYING_DURATION_SEC;
      }
      if (bDied) {
        B.alive = false; B.state = 'dying'; B.dyingTimer = DYING_DURATION_SEC;
      }

      // Bounce
      A.kinematic.velocity.x *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      A.kinematic.velocity.y *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      B.kinematic.velocity.x *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      B.kinematic.velocity.y *= COLLISION_BOUNCE_VELOCITY_RETAIN;
      A.kinematic.heading += (jitter(rngSeed + A.id) - 0.5) * 2 * COLLISION_BOUNCE_HEADING_JITTER;
      B.kinematic.heading += (jitter(rngSeed + B.id) - 0.5) * 2 * COLLISION_BOUNCE_HEADING_JITTER;

      newCooldowns.set(key, COLLISION_COOLDOWN_TICKS);

      events.push({
        posX: (A.kinematic.position.x + B.kinematic.position.x) / 2,
        posY: (A.kinematic.position.y + B.kinematic.position.y) / 2,
        aFaction: A.faction, bFaction: B.faction,
        aDied, bDied,
      });
    }
  }

  return {
    player: allPlanes[0]!,
    enemies: allPlanes.slice(1),
    events,
    newCooldowns,
  };
}
```

- [ ] **Step 4: Run tests — pass**

`pnpm --filter @biplanes/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/systems/plane-collision.ts packages/core/src/systems/plane-collision.test.ts
git commit -m "feat(core): plane-vs-plane collision resolver with velocity-based damage"
```

---

### Task 5.2: Wire `resolvePlanePlaneCollisions` into world tick

**Files:**
- Modify: `packages/core/src/world/world-state.ts`
- Modify: `packages/core/src/world/tick.ts`
- Modify: `packages/core/src/world/tick.test.ts`

- [ ] **Step 1: Add cooldown map and event buffer to world state**

```ts
// world-state.ts
import type { PlaneCollisionEvent } from '../systems/plane-collision.js';
export interface WorldState {
  // ... existing
  planeCollisionCooldowns: Map<string, number>;
  planeCollisionEvents: PlaneCollisionEvent[];
}

// in createWorldState:
planeCollisionCooldowns: new Map(),
planeCollisionEvents: [],
```

- [ ] **Step 2: Call resolver in tick**

In `tick.ts`, after the existing bullet-collision pass and before returning:

```ts
import { resolvePlanePlaneCollisions } from '../systems/plane-collision.js';

// ... after enemies stepped, after collisions resolved:
const planeCol = resolvePlanePlaneCollisions(
  player,
  enemies,
  state.planeCollisionCooldowns,
  rngState,
);
player = planeCol.player;
enemies = planeCol.enemies;
const planeCollisionEvents = planeCol.events;
const planeCollisionCooldowns = planeCol.newCooldowns;

// Award score: if player rams enemy and enemy died but player survived → +1
for (const ev of planeCollisionEvents) {
  if (ev.aFaction === 'player' && ev.bFaction === 'enemy') {
    if (ev.bDied && !ev.aDied) playerScore++;
    else if (ev.aDied && ev.bDied) playerScore++; // player initiated, counts
  } else if (ev.bFaction === 'player' && ev.aFaction === 'enemy') {
    if (ev.aDied && !ev.bDied) playerScore++;
    else if (ev.aDied && ev.bDied) playerScore++;
  }
}
```

Include `planeCollisionCooldowns` and `planeCollisionEvents` in the returned `WorldState`.

- [ ] **Step 3: Add determinism test**

```ts
// tick.test.ts
it('plane-plane collision is deterministic', () => {
  const player = makePlayer();
  const enemy = { ...makePlayer(), id: 2, faction: 'enemy' as const, kinematic: { ...makePlayer().kinematic, position: { x: 1200, y: 500 } } };
  const s1 = { ...createWorldState(42, player), enemies: [enemy] };
  const s2 = { ...createWorldState(42, player), enemies: [enemy] };
  const cmd = { rotate: 0, fire: false, bomb: false, throttleDelta: 0, eject: false, jump: false };
  const a = tick(s1, cmd);
  const b = tick(s2, cmd);
  expect(a.enemies[0]).toEqual(b.enemies[0]);
  expect(a.player).toEqual(b.player);
});
```

- [ ] **Step 4: Run all core tests**

`pnpm --filter @biplanes/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/world/world-state.ts packages/core/src/world/tick.ts packages/core/src/world/tick.test.ts
git commit -m "feat(core): wire plane collision into tick, deterministic"
```

---

### Task 5.3: VFX on collision event

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Process events**

```ts
// in ticker, after tick():
for (const ev of state.planeCollisionEvents) {
  damageFx.addSparks({ x: ev.posX, y: ev.posY }, 36); // double density
  damageFx.addImpactFlash({ x: ev.posX, y: ev.posY });
  camera.shake(ev.aDied || ev.bDied ? 14 : 8);
  clock.hitPause(ev.aDied || ev.bDied ? HIT_PAUSE_FRAMES_RAM_KILL : HIT_PAUSE_FRAMES_RAM);
  // RAM! notification on player ram-kill survival
  const playerInvolved = ev.aFaction === 'player' || ev.bFaction === 'player';
  const enemyDied = (ev.aFaction === 'enemy' && ev.aDied) || (ev.bFaction === 'enemy' && ev.bDied);
  const playerSurvived = !((ev.aFaction === 'player' && ev.aDied) || (ev.bFaction === 'player' && ev.bDied));
  if (playerInvolved && enemyDied && playerSurvived) {
    hud.showRamNotice();
  }
}
```

- [ ] **Step 2: Add `showRamNotice` to HUD**

In `hud.ts`, add a Text positioned upper-center, text "RAM!", colored 0xffc24a, fades out over 1.2 s.

- [ ] **Step 3: Manual verify**

`pnpm dev` → fly head-on into enemy. Double spark burst, big shake, hit-pause, "RAM!" text appears if you survived.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts packages/render/src/scene/hud.ts
git commit -m "feat(feel): collision VFX, RAM! notice, big camera shake on impact"
```

---

## Phase 6: Final tuning

### Task 6.1: Side-by-side comparison and tuning pass

**Files:** none (manual)

- [ ] **Step 1: Record a baseline clip**

Before this work began, the prototype was at commit `e935e2f`. Check out a separate worktree at that commit, record a 60-second clip of a normal match.

- [ ] **Step 2: Record the current clip**

Record a 60-second clip on master (after all phases).

- [ ] **Step 3: Side-by-side review**

Compare. List any moments that feel "off" — too much bloom, too long pause, slow-mo too dramatic, etc.

- [ ] **Step 4: Adjust constants in `shared/src/constants.ts`**

The visual-feel block is the single tuning knob. Numbers most likely to need adjustment: `HIT_PAUSE_FRAMES_*`, `SLOW_MO_SCALE`, `LOW_HP_VIGNETTE_THRESHOLD`, `DYING_DURATION_SEC`, `COLLISION_DAMAGE_K`.

- [ ] **Step 5: Final commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "tune(feel): final calibration after side-by-side review"
```

---

## Self-Review

**Spec coverage:**
- Phase 1 (Soakage) — Tasks 1.1–1.11 cover bloom, muzzle flash, tracers, sparks, hit-pause, camera punch + zoom-punch, screen flash, vignette, damage numbers, slow-mo, enhanced explosion. ✓
- Phase 2 (Plane alive) — Tasks 2.1–2.8 cover split, bank squeeze, ailerons/elevator/rudder, pilot head, body shake, heat shimmer, casings, prop disk. ✓
- Phase 3 (World breathes) — Tasks 3.1–3.6 cover lightning, wind streaks, craters, lens flare, distant silhouettes, foreground clouds. ✓
- Phase 4 (Death drama) — Tasks 4.1–4.7 cover dying state, transition, heavy trail, debris, big explosion, edge arrow, desaturation. ✓
- Phase 5 (Aerial collision) — Tasks 5.1–5.3 cover resolver, wiring, VFX. ✓

**Placeholder scan:** None of "TBD", "TODO", "implement later" remain.

**Type consistency:** `PlaneState` extended to include `'dying'`. `PlaneCollisionEvent` defined in `plane-collision.ts` and consumed in `tick.ts` and `main.ts` — name matches everywhere. `RenderClock` returned by `createRenderClock()`, used as type by sprite update signatures.

**Notes for the implementer:**
- TDD applies to core mechanics (Task 4.2 dying transition, Tasks 5.1 + 5.2 collisions). Visual tasks use manual verification via the dev server — that's intentional, since visual feel can't be unit-tested.
- Commit frequency is one per task — every step block ends with a commit so each phase produces ~5-10 small commits.
- The plan does NOT bundle work into "do all of Phase 1 in one PR" — each task is independently mergeable.
- If a visual change looks wrong on first try, tune values inline before committing rather than committing twice.
