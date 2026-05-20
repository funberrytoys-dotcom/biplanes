# Biplanes Combat Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable 2D side-view biplane dogfight prototype with stall physics, bot enemies, wave spawning, and a Vampire-Survivors-style build crafting loop. Validates "does the core feel fun?" before scaling to campaign/hub/multiplayer.

**Architecture:** pnpm monorepo. Headless physics in pure TypeScript (`packages/core/`) — testable, no DOM. PixiJS-based renderer (`packages/render/`) reads core state and interpolates. Input layer (`packages/input/`) normalizes keyboard/touch to `PlayerCommand` structs. AI bots emit the same structs as players. App wrapper (`apps/web/`) ties it all together for browser/TMA.

**Tech Stack:** TypeScript 5.x, PixiJS 8.x, Vite 5.x, pnpm workspaces, Vitest, ESLint with `no-restricted-imports` for core isolation.

**Reference material:** Original BT Biplanes Java source from https://github.com/TheRealPinkie/BT_Biplanes_src — clone to `vendor/bt-biplanes-reference/` (gitignored) for physics calibration.

**Spec source:** [docs/superpowers/specs/2026-05-21-biplanes-design.md](../specs/2026-05-21-biplanes-design.md) §6.

**Out of scope (deferred to post-prototype):** TMA SDK integration, Supabase, hub/base UI, campaign, mission selection, multiple heroes, monetization, cosmetics, polished art, music, leaderboard, multiplayer.

---

## File Structure (target)

```
biplanes/
├── package.json                            # root, pnpm workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md (already exists)
├── CLAUDE.md (already exists)
├── docs/ (already exists)
├── vendor/                                  # gitignored
│   └── bt-biplanes-reference/               # cloned for physics ref
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts                     # PlayerCommand, Vec2, EntityId
│   │       ├── constants.ts                 # TICK_HZ, WORLD_W, WORLD_H, etc.
│   │       └── index.ts
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── .eslintrc.cjs                    # no-restricted-imports
│   │   └── src/
│   │       ├── math/
│   │       │   ├── vec2.ts
│   │       │   └── vec2.test.ts
│   │       ├── rng/
│   │       │   ├── mulberry32.ts
│   │       │   └── mulberry32.test.ts
│   │       ├── physics/
│   │       │   ├── plane-physics.ts         # stall, thrust, gravity
│   │       │   └── plane-physics.test.ts
│   │       ├── entities/
│   │       │   ├── plane.ts                 # Plane state struct + helpers
│   │       │   ├── bullet.ts
│   │       │   └── pickup.ts
│   │       ├── ai/
│   │       │   ├── chase-policy.ts          # bot: chase player, fire when in front
│   │       │   └── chase-policy.test.ts
│   │       ├── systems/
│   │       │   ├── weapon-system.ts         # firing, cooldowns
│   │       │   ├── collision-system.ts      # bullet vs plane, plane vs world bounds
│   │       │   ├── spawn-system.ts          # wave spawning
│   │       │   └── xp-system.ts             # XP pickup, level-up trigger
│   │       ├── upgrades/
│   │       │   ├── upgrade-pool.ts          # 8-10 starter upgrades + 1-2 evolutions
│   │       │   ├── apply-upgrade.ts
│   │       │   └── apply-upgrade.test.ts
│   │       ├── world/
│   │       │   ├── world-state.ts           # WorldState type
│   │       │   ├── tick.ts                  # main tick(state, commands, dt) -> state
│   │       │   └── tick.test.ts
│   │       └── index.ts
│   ├── input/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── keyboard.ts
│   │       ├── touch.ts
│   │       └── index.ts
│   ├── render/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── pixi-app.ts                  # init Pixi.Application
│   │       ├── scene/
│   │       │   ├── plane-sprite.ts          # render a plane from state
│   │       │   ├── bullet-sprite.ts
│   │       │   ├── sky-background.ts        # gradient + parallax silhouettes
│   │       │   └── hud.ts                   # HP, XP, level
│   │       ├── camera.ts                    # follow + shake
│   │       └── index.ts
│   └── app/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts                      # game loop orchestrator
│           ├── screens/
│           │   ├── menu-screen.ts
│           │   ├── run-screen.ts
│           │   ├── level-up-screen.ts
│           │   └── death-screen.ts
│           └── index.ts
└── apps/
    └── web/
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        └── src/
            └── main.ts                      # import from packages/app
```

---

## Phase 0 — Foundation

### Task 1: Initialize git repo + clone BT Biplanes reference

**Files:**
- Create: `.gitignore`
- Create: `vendor/bt-biplanes-reference/` (cloned, gitignored)

- [ ] **Step 1: Init git, create .gitignore**

Run from `C:\Users\serge\Documents\CC PROJECTS\Biplanes\`:
```bash
git init
```

Create `.gitignore`:
```
node_modules/
dist/
.DS_Store
*.log
.env
.env.local
vendor/
.vite/
coverage/
.idea/
.vscode/
```

- [ ] **Step 2: Clone BT Biplanes reference into vendor**

```bash
mkdir -p vendor
git clone https://github.com/TheRealPinkie/BT_Biplanes_src.git vendor/bt-biplanes-reference
```

- [ ] **Step 3: Commit foundation files**

```bash
git add .gitignore README.md CLAUDE.md docs/
git commit -m "chore: initial commit with design docs and gitignore"
```

---

### Task 2: pnpm monorepo skeleton

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.eslintrc.cjs` (root)

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "biplanes",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @biplanes/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "vitest": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist", "vendor"]
}
```

- [ ] **Step 4: Create root .eslintrc.cjs**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist/', 'node_modules/', 'vendor/'],
  env: { browser: true, node: true, es2022: true }
};
```

- [ ] **Step 5: Install root deps and commit**

```bash
pnpm install
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .eslintrc.cjs
git commit -m "chore: pnpm monorepo skeleton with TS+ESLint base"
```

---

### Task 3: shared package — types and constants

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@biplanes/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: types.ts**

```typescript
export type EntityId = number;

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerCommand {
  rotate: -1 | 0 | 1; // -1 = CCW, 0 = none, 1 = CW
  fire: boolean;
  bomb: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

- [ ] **Step 4: constants.ts**

```typescript
export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;

export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 2000;
export const GROUND_Y = WORLD_HEIGHT - 50;

export const PLANE_THRUST = 280;      // pixels/sec acceleration
export const PLANE_GRAVITY = 380;      // pixels/sec^2 downward
export const PLANE_TURN_RATE = 2.6;    // radians/sec at full input
export const PLANE_MAX_SPEED = 600;
export const PLANE_MIN_LIFT_SPEED = 80; // below this speed, lift collapses
export const PLANE_STALL_ANGLE = 1.2;   // radians; nose-up angle relative to velocity at which stall starts

export const PLANE_INITIAL_HP = 100;
export const ENEMY_INITIAL_HP_LIGHT = 30;
export const ENEMY_INITIAL_HP_HEAVY = 90;

export const BULLET_SPEED = 900;
export const BULLET_LIFETIME = 1.2;
export const MACHINE_GUN_COOLDOWN = 0.12;
export const MACHINE_GUN_DAMAGE = 10;

export const XP_PER_KILL_LIGHT = 5;
export const XP_PER_KILL_HEAVY = 12;
export const XP_PICKUP_MAGNET_RANGE = 120;
export const XP_PICKUP_ABSORB_RANGE = 30;

export const LEVEL_UP_THRESHOLDS = [
  10, 25, 50, 90, 150, 230, 330, 450,
];
```

- [ ] **Step 5: index.ts**

```typescript
export * from './types.js';
export * from './constants.js';
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @biplanes/shared typecheck
git add packages/shared
git commit -m "feat(shared): types and tunable constants for physics/combat"
```

Expected: typecheck passes with no errors.

---

### Task 4: core package skeleton + lint isolation

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/.eslintrc.cjs`
- Create: `packages/core/src/index.ts` (stub)

- [ ] **Step 1: package.json**

```json
{
  "name": "@biplanes/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "@biplanes/shared": "workspace:*"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
```

- [ ] **Step 4: .eslintrc.cjs (the critical isolation rule)**

```javascript
module.exports = {
  extends: ['../../.eslintrc.cjs'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['pixi.js', 'pixi.js/*', '@pixi/*'],
            message: 'core/ must NOT import PixiJS. Render belongs in packages/render.',
          },
          {
            group: ['@biplanes/render', '@biplanes/render/*'],
            message: 'core/ must NOT import from render. Data flows core -> render, not back.',
          },
        ],
      },
    ],
  },
  env: { browser: false, node: true },
};
```

- [ ] **Step 5: stub index.ts**

```typescript
// Public API of @biplanes/core — re-exports added per task as features land.
export {};
```

- [ ] **Step 6: Install vitest in workspace and commit**

```bash
pnpm install
pnpm --filter @biplanes/core typecheck
git add packages/core
git commit -m "feat(core): package skeleton with Vitest and import-isolation lint"
```

Expected: typecheck passes.

---

## Phase 1 — Physics core (the heart)

### Task 5: Vec2 math utility (TDD)

**Files:**
- Create: `packages/core/src/math/vec2.ts`
- Create: `packages/core/src/math/vec2.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/math/vec2.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { add, sub, scale, length, normalize, rotate, angleOf, dot } from './vec2.js';

describe('vec2', () => {
  it('adds two vectors', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it('subtracts two vectors', () => {
    expect(sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
  });

  it('scales a vector', () => {
    expect(scale({ x: 2, y: -3 }, 4)).toEqual({ x: 8, y: -12 });
  });

  it('computes length', () => {
    expect(length({ x: 3, y: 4 })).toBeCloseTo(5);
    expect(length({ x: 0, y: 0 })).toBe(0);
  });

  it('normalizes a vector to unit length', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    expect(length(n)).toBeCloseTo(1);
  });

  it('returns zero vector when normalizing zero', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('rotates by angle (radians)', () => {
    const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });

  it('computes angle of a vector', () => {
    expect(angleOf({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(angleOf({ x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('computes dot product', () => {
    expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test
```
Expected: all 9 tests fail (file not found).

- [ ] **Step 3: Implement vec2.ts**

```typescript
import type { Vec2 } from '@biplanes/shared';

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vec2): Vec2 {
  const l = length(v);
  if (l === 0) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

export function rotate(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @biplanes/core test
```
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/math
git commit -m "feat(core): vec2 math utility with full test coverage"
```

---

### Task 6: Seeded RNG (TDD)

**Files:**
- Create: `packages/core/src/rng/mulberry32.ts`
- Create: `packages/core/src/rng/mulberry32.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/rng/mulberry32.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from './mulberry32.js';

describe('mulberry32 PRNG', () => {
  it('produces deterministic sequence for same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBeCloseTo(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const aVals = Array.from({ length: 5 }, () => a.next());
    const bVals = Array.from({ length: 5 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() returns integer in [min, max)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(5, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('pick() returns one of provided items', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('pickN() returns n distinct items', () => {
    const rng = createRng(11);
    const items = [1, 2, 3, 4, 5];
    const picked = rng.pickN(items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach(p => expect(items).toContain(p));
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 3: Implement mulberry32.ts**

```typescript
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  pickN<T>(items: readonly T[], n: number): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min: number, max: number): number {
    return Math.floor(next() * (max - min)) + min;
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty array');
    return items[range(0, items.length)]!;
  }

  function pickN<T>(items: readonly T[], n: number): T[] {
    if (n > items.length) throw new Error('pickN: n > items.length');
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = range(0, pool.length);
      out.push(pool[idx]!);
      pool.splice(idx, 1);
    }
    return out;
  }

  return { next, range, pick, pickN };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rng
git commit -m "feat(core): mulberry32 seeded RNG with range/pick/pickN helpers"
```

---

### Task 7: Plane physics — thrust, gravity, turning, stall (TDD)

**Reference:** Study `vendor/bt-biplanes-reference/` source files first. Look for `Player.java`, `Plane.java`, or similar — find: thrust value, gravity, turn rate, stall threshold. These ARE the gold-standard tuning. Mirror the spirit, not the exact code.

**Files:**
- Create: `packages/core/src/physics/plane-physics.ts`
- Create: `packages/core/src/physics/plane-physics.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/physics/plane-physics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { stepPlane, isStalling, type PlaneKinematic } from './plane-physics.js';
import { TICK_DT, PLANE_GRAVITY, GROUND_Y } from '@biplanes/shared';

function makePlane(overrides: Partial<PlaneKinematic> = {}): PlaneKinematic {
  return {
    position: { x: 1000, y: 500 },
    velocity: { x: 200, y: 0 },
    heading: 0,
    throttleOn: true,
    ...overrides,
  };
}

describe('plane-physics', () => {
  it('gravity pulls plane down when no thrust and level', () => {
    const p = makePlane({ velocity: { x: 0, y: 0 }, throttleOn: false });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.velocity.y).toBeGreaterThan(0);
    expect(after.velocity.y).toBeCloseTo(PLANE_GRAVITY * TICK_DT, 2);
  });

  it('thrust accelerates plane in heading direction', () => {
    const p = makePlane({ velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.velocity.x).toBeGreaterThan(0);
  });

  it('rotate input changes heading', () => {
    const p = makePlane({ heading: 0 });
    const ccw = stepPlane(p, { rotate: -1 }, TICK_DT);
    const cw = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(ccw.heading).toBeLessThan(0);
    expect(cw.heading).toBeGreaterThan(0);
  });

  it('position advances by velocity', () => {
    const p = makePlane({ velocity: { x: 100, y: 50 }, throttleOn: false });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.x).toBeCloseTo(1000 + 100 * TICK_DT, 1);
    // y is affected by gravity too, so just check positive
    expect(after.position.y).toBeGreaterThan(500);
  });

  it('isStalling returns true when nose far above velocity vector AND slow', () => {
    const p = makePlane({
      heading: -Math.PI / 2 + 0.05, // pointing nearly straight up
      velocity: { x: 30, y: -20 },  // slow climb
    });
    expect(isStalling(p)).toBe(true);
  });

  it('isStalling returns false when fast and aligned', () => {
    const p = makePlane({
      heading: 0,
      velocity: { x: 400, y: 0 },
    });
    expect(isStalling(p)).toBe(false);
  });

  it('during stall, gravity dominates even with throttle', () => {
    // Plane pointing straight up but barely moving — should fall.
    const p = makePlane({
      heading: -Math.PI / 2,
      velocity: { x: 0, y: -10 },
      throttleOn: true,
    });
    // Simulate one second
    let s = p;
    for (let i = 0; i < 60; i++) {
      s = stepPlane(s, { rotate: 0 }, TICK_DT);
    }
    expect(s.velocity.y).toBeGreaterThan(50); // falling, not climbing
  });

  it('plane never goes below ground', () => {
    const p = makePlane({
      position: { x: 1000, y: GROUND_Y - 5 },
      velocity: { x: 0, y: 500 },
      throttleOn: false,
    });
    const after = stepPlane(p, { rotate: 0 }, TICK_DT);
    expect(after.position.y).toBeLessThanOrEqual(GROUND_Y);
  });

  it('determinism: same input produces same output', () => {
    const p = makePlane();
    const a = stepPlane(p, { rotate: 1 }, TICK_DT);
    const b = stepPlane(p, { rotate: 1 }, TICK_DT);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- plane-physics
```

- [ ] **Step 3: Implement plane-physics.ts**

```typescript
import {
  TICK_DT,
  PLANE_THRUST,
  PLANE_GRAVITY,
  PLANE_TURN_RATE,
  PLANE_MAX_SPEED,
  PLANE_MIN_LIFT_SPEED,
  PLANE_STALL_ANGLE,
  GROUND_Y,
  WORLD_WIDTH,
  type Vec2,
} from '@biplanes/shared';
import { length, angleOf } from '../math/vec2.js';

export interface PlaneKinematic {
  position: Vec2;
  velocity: Vec2;
  heading: number;     // radians; 0 = pointing +x (right)
  throttleOn: boolean;
}

export interface PhysicsInput {
  rotate: -1 | 0 | 1;
}

/**
 * Returns true if the plane's nose points significantly away from its velocity
 * vector AND the plane is moving slowly enough that lift collapses.
 *
 * This is the core BT-Biplanes feel: nose-up + slow = drop like a rock.
 */
export function isStalling(p: PlaneKinematic): boolean {
  const speed = length(p.velocity);
  if (speed >= PLANE_MIN_LIFT_SPEED * 1.5) return false;

  // If barely moving, "stalling" depends on heading vs gravity direction.
  if (speed < 5) {
    // Pointing roughly upward (heading is negative angle in screen coords)
    return p.heading < -0.3 && p.heading > -Math.PI + 0.3;
  }

  const velAngle = angleOf(p.velocity);
  let diff = p.heading - velAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  // Stall if nose is more than STALL_ANGLE above velocity vector (i.e. trying to climb steeply while slow)
  // In screen coords "up" is negative y, so nose above velocity = heading more negative
  return diff < -PLANE_STALL_ANGLE || diff > Math.PI - PLANE_STALL_ANGLE;
}

export function stepPlane(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT
): PlaneKinematic {
  // 1) Update heading from rotation input
  const heading = p.heading + input.rotate * PLANE_TURN_RATE * dt;

  // 2) Compute thrust acceleration (in heading direction)
  const stalling = isStalling(p);
  const effectiveThrust = stalling ? PLANE_THRUST * 0.2 : (p.throttleOn ? PLANE_THRUST : 0);

  let ax = Math.cos(heading) * effectiveThrust;
  let ay = Math.sin(heading) * effectiveThrust;

  // 3) Gravity
  ay += PLANE_GRAVITY;

  // 4) Velocity update
  let vx = p.velocity.x + ax * dt;
  let vy = p.velocity.y + ay * dt;

  // 5) Speed cap
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > PLANE_MAX_SPEED) {
    vx = (vx / speed) * PLANE_MAX_SPEED;
    vy = (vy / speed) * PLANE_MAX_SPEED;
  }

  // 6) Position update
  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;

  // 7) World bounds (wrap on x, clamp on y to ground)
  if (px < 0) px += WORLD_WIDTH;
  if (px >= WORLD_WIDTH) px -= WORLD_WIDTH;
  if (py > GROUND_Y) {
    py = GROUND_Y;
    vy = Math.min(vy, 0);
  }

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading,
    throttleOn: p.throttleOn,
  };
}
```

- [ ] **Step 4: Run, expect all pass**

```bash
pnpm --filter @biplanes/core test
```

If a test fails: tune the constants in `packages/shared/src/constants.ts` (thrust/gravity/stall threshold) until the physics tests pass AND the test scenarios feel right. Iterate.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/core/src/physics
git commit -m "feat(core): plane physics with thrust/gravity/stall mechanics"
```

---

### Task 8: WorldState + tick orchestrator (TDD)

**Files:**
- Create: `packages/core/src/world/world-state.ts`
- Create: `packages/core/src/world/tick.ts`
- Create: `packages/core/src/world/tick.test.ts`
- Create: `packages/core/src/entities/plane.ts`
- Create: `packages/core/src/entities/bullet.ts`

- [ ] **Step 1: Define entity types**

`packages/core/src/entities/plane.ts`:
```typescript
import type { EntityId } from '@biplanes/shared';
import type { PlaneKinematic } from '../physics/plane-physics.js';

export type PlaneFaction = 'player' | 'enemy';

export interface Plane {
  id: EntityId;
  faction: PlaneFaction;
  kinematic: PlaneKinematic;
  hp: number;
  maxHp: number;
  weaponCooldown: number; // seconds until next shot allowed
  alive: boolean;
}
```

`packages/core/src/entities/bullet.ts`:
```typescript
import type { EntityId, Vec2 } from '@biplanes/shared';

export interface Bullet {
  id: EntityId;
  ownerId: EntityId;
  position: Vec2;
  velocity: Vec2;
  lifetime: number;       // seconds remaining
  damage: number;
  alive: boolean;
}
```

- [ ] **Step 2: Define WorldState**

`packages/core/src/world/world-state.ts`:
```typescript
import type { EntityId } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

export interface WorldState {
  timeSec: number;          // wall clock since run started
  tickCount: number;
  nextEntityId: EntityId;
  rngSeed: number;
  rngState: number;         // current PRNG state (for replay)

  player: Plane;
  enemies: Plane[];
  bullets: Bullet[];

  xpCollected: number;
  level: number;
  pendingLevelUp: boolean;  // true between earning level-up and choosing upgrade
  
  gameOver: boolean;
}

export function createWorldState(seed: number, player: Plane): WorldState {
  return {
    timeSec: 0,
    tickCount: 0,
    nextEntityId: player.id + 1,
    rngSeed: seed,
    rngState: seed,
    player,
    enemies: [],
    bullets: [],
    xpCollected: 0,
    level: 1,
    pendingLevelUp: false,
    gameOver: false,
  };
}
```

- [ ] **Step 3: Write failing tick test**

`packages/core/src/world/tick.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { tick } from './tick.js';
import { createWorldState } from './world-state.js';
import { TICK_DT, PLANE_INITIAL_HP } from '@biplanes/shared';

function makePlayer() {
  return {
    id: 1,
    faction: 'player' as const,
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 200, y: 0 },
      heading: 0,
      throttleOn: true,
    },
    hp: PLANE_INITIAL_HP,
    maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0,
    alive: true,
  };
}

describe('world tick', () => {
  it('advances time', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false });
    expect(after.timeSec).toBeCloseTo(TICK_DT);
    expect(after.tickCount).toBe(1);
  });

  it('moves player plane based on physics', () => {
    const s = createWorldState(42, makePlayer());
    const after = tick(s, { rotate: 0, fire: false, bomb: false });
    expect(after.player.kinematic.position.x).toBeGreaterThan(500);
  });

  it('is deterministic for same input', () => {
    const s = createWorldState(42, makePlayer());
    const a = tick(s, { rotate: 1, fire: false, bomb: false });
    const b = tick(s, { rotate: 1, fire: false, bomb: false });
    expect(a).toEqual(b);
  });

  it('does not mutate input state', () => {
    const s = createWorldState(42, makePlayer());
    const before = JSON.stringify(s);
    tick(s, { rotate: 1, fire: false, bomb: false });
    expect(JSON.stringify(s)).toBe(before);
  });
});
```

- [ ] **Step 4: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- tick
```

- [ ] **Step 5: Implement tick.ts**

```typescript
import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  // Step 1: Advance player physics
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  const newPlayer = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: Math.max(0, state.player.weaponCooldown - TICK_DT),
  };

  // Future tasks add: enemies stepping, bullets advancing, collisions, spawning, XP, etc.

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    player: newPlayer,
  };
}
```

- [ ] **Step 6: Run, expect pass**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/entities packages/core/src/world
git commit -m "feat(core): WorldState and tick orchestrator (player only)"
```

---

### Task 9: Bullet system — firing and movement (TDD)

**Files:**
- Create: `packages/core/src/systems/weapon-system.ts`
- Create: `packages/core/src/systems/weapon-system.test.ts`
- Modify: `packages/core/src/world/tick.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/systems/weapon-system.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { firePlayerWeapon, stepBullets, makeBulletFromPlane } from './weapon-system.js';
import type { Plane } from '../entities/plane.js';
import { TICK_DT, BULLET_SPEED } from '@biplanes/shared';

function makePlayer(): Plane {
  return {
    id: 1,
    faction: 'player',
    kinematic: {
      position: { x: 500, y: 500 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: true,
    },
    hp: 100,
    maxHp: 100,
    weaponCooldown: 0,
    alive: true,
  };
}

describe('weapon-system', () => {
  it('firePlayerWeapon emits a bullet when cooldown is zero and fire is true', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullet).toBeDefined();
    expect(result.newCooldown).toBeGreaterThan(0);
  });

  it('firePlayerWeapon emits nothing when cooldown > 0', () => {
    const p = { ...makePlayer(), weaponCooldown: 0.1 };
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullet).toBeUndefined();
  });

  it('firePlayerWeapon emits nothing when fire is false', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, false, 999);
    expect(result.bullet).toBeUndefined();
  });

  it('bullet inherits plane heading as velocity direction', () => {
    const p = makePlayer();
    const result = firePlayerWeapon(p, true, 999);
    expect(result.bullet!.velocity.x).toBeCloseTo(BULLET_SPEED);
    expect(result.bullet!.velocity.y).toBeCloseTo(0);
  });

  it('stepBullets advances bullet position and decreases lifetime', () => {
    const b = makeBulletFromPlane(makePlayer(), 999);
    const [stepped] = stepBullets([b]);
    expect(stepped!.position.x).toBeGreaterThan(b.position.x);
    expect(stepped!.lifetime).toBeLessThan(b.lifetime);
  });

  it('stepBullets removes dead bullets', () => {
    const b = { ...makeBulletFromPlane(makePlayer(), 999), lifetime: TICK_DT / 2 };
    const stepped = stepBullets([b]);
    expect(stepped).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- weapon
```

- [ ] **Step 3: Implement weapon-system.ts**

```typescript
import {
  TICK_DT,
  BULLET_SPEED,
  BULLET_LIFETIME,
  MACHINE_GUN_COOLDOWN,
  MACHINE_GUN_DAMAGE,
  type EntityId,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

export function makeBulletFromPlane(plane: Plane, id: EntityId): Bullet {
  const cos = Math.cos(plane.kinematic.heading);
  const sin = Math.sin(plane.kinematic.heading);
  // Spawn slightly in front of plane nose
  const offset = 28;
  return {
    id,
    ownerId: plane.id,
    position: {
      x: plane.kinematic.position.x + cos * offset,
      y: plane.kinematic.position.y + sin * offset,
    },
    velocity: {
      x: cos * BULLET_SPEED + plane.kinematic.velocity.x * 0.3,
      y: sin * BULLET_SPEED + plane.kinematic.velocity.y * 0.3,
    },
    lifetime: BULLET_LIFETIME,
    damage: MACHINE_GUN_DAMAGE,
    alive: true,
  };
}

export interface FireResult {
  bullet?: Bullet;
  newCooldown: number;
}

export function firePlayerWeapon(
  plane: Plane,
  fireInput: boolean,
  bulletId: EntityId
): FireResult {
  if (!fireInput || plane.weaponCooldown > 0 || !plane.alive) {
    return { newCooldown: plane.weaponCooldown };
  }
  return {
    bullet: makeBulletFromPlane(plane, bulletId),
    newCooldown: MACHINE_GUN_COOLDOWN,
  };
}

export function stepBullets(bullets: readonly Bullet[]): Bullet[] {
  const out: Bullet[] = [];
  for (const b of bullets) {
    const newLifetime = b.lifetime - TICK_DT;
    if (newLifetime <= 0) continue;
    out.push({
      ...b,
      position: {
        x: b.position.x + b.velocity.x * TICK_DT,
        y: b.position.y + b.velocity.y * TICK_DT,
      },
      lifetime: newLifetime,
    });
  }
  return out;
}
```

- [ ] **Step 4: Wire into tick.ts**

Replace `packages/core/src/world/tick.ts` with:
```typescript
import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  // Player physics
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  // Player weapon
  const fireResult = firePlayerWeapon(
    state.player,
    playerCommand.fire,
    state.nextEntityId
  );

  const newBullets = stepBullets(state.bullets);
  if (fireResult.bullet) newBullets.push(fireResult.bullet);

  const newPlayer = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: fireResult.newCooldown,
  };

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId: state.nextEntityId + (fireResult.bullet ? 1 : 0),
    player: newPlayer,
    bullets: newBullets,
  };
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/systems/weapon-system.ts packages/core/src/systems/weapon-system.test.ts packages/core/src/world/tick.ts
git commit -m "feat(core): machine gun firing and bullet stepping"
```

---

### Task 10: AI chase policy for bots (TDD)

**Files:**
- Create: `packages/core/src/ai/chase-policy.ts`
- Create: `packages/core/src/ai/chase-policy.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/ai/chase-policy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { chasePolicy } from './chase-policy.js';
import type { Plane } from '../entities/plane.js';

function makePlane(x: number, y: number, heading: number): Plane {
  return {
    id: 1,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: 200, y: 0 },
      heading,
      throttleOn: true,
    },
    hp: 30,
    maxHp: 30,
    weaponCooldown: 0,
    alive: true,
  };
}

describe('chase policy', () => {
  it('turns toward target when target is above', () => {
    const enemy = makePlane(500, 500, 0); // pointing right
    const target = makePlane(500, 400, 0); // above
    const cmd = chasePolicy(enemy, target);
    // In screen coords "up" is -y, so we need to rotate CCW (negative)
    expect(cmd.rotate).toBe(-1);
  });

  it('turns toward target when target is below', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(500, 600, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(1);
  });

  it('does not turn when target is directly ahead', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(900, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(0);
  });

  it('fires when target is roughly in front and close', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(700, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(true);
  });

  it('does not fire when target is behind', () => {
    const enemy = makePlane(500, 500, 0); // facing right
    const target = makePlane(200, 500, 0); // behind
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });

  it('does not fire when target is too far', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(2500, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- chase
```

- [ ] **Step 3: Implement chase-policy.ts**

```typescript
import type { PlayerCommand } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

const FIRE_RANGE = 600;
const FIRE_CONE = Math.PI / 6; // ±30°
const TURN_DEADZONE = 0.08;    // radians

export function chasePolicy(self: Plane, target: Plane): PlayerCommand {
  const dx = target.kinematic.position.x - self.kinematic.position.x;
  const dy = target.kinematic.position.y - self.kinematic.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - self.kinematic.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  let rotate: -1 | 0 | 1 = 0;
  if (diff > TURN_DEADZONE) rotate = 1;
  else if (diff < -TURN_DEADZONE) rotate = -1;

  const inCone = Math.abs(diff) < FIRE_CONE;
  const inRange = distance < FIRE_RANGE;
  const fire = inCone && inRange;

  return { rotate, fire, bomb: false };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ai
git commit -m "feat(core): chase AI policy for enemy bots"
```

---

### Task 11: Collision system + damage + death (TDD)

**Files:**
- Create: `packages/core/src/systems/collision-system.ts`
- Create: `packages/core/src/systems/collision-system.test.ts`
- Modify: `packages/core/src/world/tick.ts` to step enemies and resolve collisions

- [ ] **Step 1: Write failing tests**

`packages/core/src/systems/collision-system.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveBulletPlaneHits } from './collision-system.js';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

function makePlane(id: number, x: number, y: number, faction: 'player' | 'enemy', hp = 30): Plane {
  return {
    id, faction,
    kinematic: {
      position: { x, y }, velocity: { x: 0, y: 0 },
      heading: 0, throttleOn: true,
    },
    hp, maxHp: hp,
    weaponCooldown: 0, alive: true,
  };
}

function makeBullet(id: number, x: number, y: number, ownerId: number, damage = 10): Bullet {
  return {
    id, ownerId,
    position: { x, y }, velocity: { x: 100, y: 0 },
    lifetime: 1.0, damage, alive: true,
  };
}

describe('collision-system', () => {
  it('bullet from player hits enemy and deals damage', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 510, 500, 'enemy', 30);
    const bullet = makeBullet(99, 510, 500, 1, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.enemies[0]!.hp).toBe(20);
    expect(result.bullets).toHaveLength(0);
    expect(result.kills).toBe(0);
  });

  it('bullet from enemy hits player and deals damage', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 800, 500, 'enemy');
    const bullet = makeBullet(99, 505, 500, 2, 15);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.player.hp).toBe(85);
    expect(result.bullets).toHaveLength(0);
  });

  it('bullet does not hit its owner', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 800, 500, 'enemy');
    const bullet = makeBullet(99, 500, 500, 1, 10); // owned by player, at player

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.player.hp).toBe(100);
    expect(result.bullets).toHaveLength(1);
  });

  it('kill is counted when hp drops to 0', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 510, 500, 'enemy', 5);
    const bullet = makeBullet(99, 510, 500, 1, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.enemies[0]!.alive).toBe(false);
    expect(result.enemies[0]!.hp).toBe(0);
    expect(result.kills).toBe(1);
  });

  it('bullet far from any plane passes through', () => {
    const player = makePlane(1, 500, 500, 'player');
    const enemy = makePlane(2, 1000, 1000, 'enemy');
    const bullet = makeBullet(99, 0, 0, 99, 10);

    const result = resolveBulletPlaneHits([bullet], player, [enemy]);
    expect(result.bullets).toHaveLength(1);
    expect(result.player.hp).toBe(100);
    expect(result.enemies[0]!.hp).toBe(30);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- collision
```

- [ ] **Step 3: Implement collision-system.ts**

```typescript
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';

const PLANE_HIT_RADIUS = 22;

export interface CollisionResult {
  bullets: Bullet[];
  player: Plane;
  enemies: Plane[];
  kills: number;
}

export function resolveBulletPlaneHits(
  bullets: readonly Bullet[],
  player: Plane,
  enemies: readonly Plane[]
): CollisionResult {
  let newPlayer = { ...player };
  const newEnemies = enemies.map(e => ({ ...e }));
  const remainingBullets: Bullet[] = [];
  let kills = 0;

  for (const b of bullets) {
    let consumed = false;

    // Check player (if bullet not from player)
    if (b.ownerId !== player.id && player.alive) {
      const dx = b.position.x - player.kinematic.position.x;
      const dy = b.position.y - player.kinematic.position.y;
      if (dx * dx + dy * dy < PLANE_HIT_RADIUS * PLANE_HIT_RADIUS) {
        newPlayer = { ...newPlayer, hp: Math.max(0, newPlayer.hp - b.damage) };
        if (newPlayer.hp === 0) newPlayer.alive = false;
        consumed = true;
      }
    }

    if (!consumed) {
      for (const e of newEnemies) {
        if (e.id === b.ownerId || !e.alive) continue;
        const dx = b.position.x - e.kinematic.position.x;
        const dy = b.position.y - e.kinematic.position.y;
        if (dx * dx + dy * dy < PLANE_HIT_RADIUS * PLANE_HIT_RADIUS) {
          e.hp = Math.max(0, e.hp - b.damage);
          if (e.hp === 0 && e.alive) {
            e.alive = false;
            kills++;
          }
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) remainingBullets.push(b);
  }

  return { bullets: remainingBullets, player: newPlayer, enemies: newEnemies, kills };
}
```

- [ ] **Step 4: Integrate into tick.ts**

Replace `packages/core/src/world/tick.ts`:
```typescript
import { TICK_DT, type PlayerCommand } from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, makeBulletFromPlane, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { chasePolicy } from '../ai/chase-policy.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver) return state;

  // 1. Player physics + weapon
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  let nextEntityId = state.nextEntityId;
  const newBulletList = stepBullets(state.bullets);

  const fireResult = firePlayerWeapon(state.player, playerCommand.fire, nextEntityId);
  if (fireResult.bullet) {
    newBulletList.push(fireResult.bullet);
    nextEntityId++;
  }

  let player = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: fireResult.newCooldown,
  };

  // 2. Enemy AI + physics + weapons
  let enemies: typeof state.enemies = state.enemies.map(e => {
    if (!e.alive) return e;
    const cmd = chasePolicy(e, player);
    const newKin = stepPlane(e.kinematic, { rotate: cmd.rotate }, TICK_DT);
    let newCooldown = Math.max(0, e.weaponCooldown - TICK_DT);

    if (cmd.fire && newCooldown === 0) {
      const fakeForFire = { ...e, weaponCooldown: 0, kinematic: newKin };
      const result = firePlayerWeapon(fakeForFire, true, nextEntityId);
      if (result.bullet) {
        newBulletList.push(result.bullet);
        nextEntityId++;
        newCooldown = result.newCooldown;
      }
    }

    return { ...e, kinematic: newKin, weaponCooldown: newCooldown };
  });

  // 3. Collisions
  const collision = resolveBulletPlaneHits(newBulletList, player, enemies);
  player = collision.player;
  enemies = collision.enemies;

  // 4. Game over check
  const gameOver = !player.alive;

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId,
    player,
    enemies,
    bullets: collision.bullets,
    gameOver,
  };
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): collision system, damage, death, enemy AI integration in tick"
```

---

### Task 12: Wave spawn system + XP system (TDD)

**Files:**
- Create: `packages/core/src/systems/spawn-system.ts`
- Create: `packages/core/src/systems/spawn-system.test.ts`
- Modify: `packages/core/src/world/tick.ts` to spawn over time and award XP

- [ ] **Step 1: Write failing tests**

`packages/core/src/systems/spawn-system.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeSpawnsThisTick, makeEnemyPlane } from './spawn-system.js';
import { createRng } from '../rng/mulberry32.js';

describe('spawn-system', () => {
  it('spawns nothing in first 2 seconds (warmup)', () => {
    const rng = createRng(42);
    const result = computeSpawnsThisTick(1.0, 0, rng, { x: 500, y: 500 });
    expect(result.count).toBe(0);
  });

  it('spawns more often as time progresses', () => {
    const rng = createRng(42);
    const earlyCount = computeSpawnsThisTick(10, 9.5, rng, { x: 500, y: 500 }).count;
    const lateCount = computeSpawnsThisTick(120, 119.5, rng, { x: 500, y: 500 }).count;
    expect(lateCount).toBeGreaterThanOrEqual(earlyCount);
  });

  it('makeEnemyPlane creates valid enemy near player but off-screen', () => {
    const rng = createRng(42);
    const e = makeEnemyPlane(99, { x: 500, y: 500 }, rng);
    expect(e.faction).toBe('enemy');
    expect(e.alive).toBe(true);
    expect(e.hp).toBeGreaterThan(0);
    const dx = e.kinematic.position.x - 500;
    const dy = e.kinematic.position.y - 500;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(400); // spawned off-screen
    expect(dist).toBeLessThan(1200);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- spawn
```

- [ ] **Step 3: Implement spawn-system.ts**

```typescript
import {
  ENEMY_INITIAL_HP_LIGHT,
  PLANE_INITIAL_HP,
  type EntityId,
  type Vec2,
} from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Rng } from '../rng/mulberry32.js';

const WARMUP_SECONDS = 2;

export interface SpawnResult {
  count: number;
}

/**
 * Returns how many enemies should spawn during the interval [prevTime, nowTime].
 * Difficulty ramps over time: 1 enemy every 3s at t=0, every 0.6s at t=180.
 */
export function computeSpawnsThisTick(
  nowTime: number,
  prevTime: number,
  _rng: Rng,
  _playerPos: Vec2
): SpawnResult {
  if (nowTime < WARMUP_SECONDS) return { count: 0 };

  const targetInterval = Math.max(0.6, 3.0 - nowTime / 60); // shrinks over time
  const spawnsPerSec = 1 / targetInterval;
  const dt = nowTime - prevTime;
  const expected = spawnsPerSec * dt;

  // Stochastic discretization
  const count = Math.floor(expected) + (_rng.next() < (expected % 1) ? 1 : 0);
  return { count };
}

export function makeEnemyPlane(id: EntityId, around: Vec2, rng: Rng): Plane {
  const angle = rng.next() * Math.PI * 2;
  const distance = 600 + rng.next() * 200;
  const px = around.x + Math.cos(angle) * distance;
  const py = around.y + Math.sin(angle) * distance;

  // Velocity points roughly toward player
  const dx = around.x - px;
  const dy = around.y - py;
  const ndist = Math.sqrt(dx * dx + dy * dy);
  const heading = Math.atan2(dy, dx);
  const speed = 220;

  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: px, y: py },
      velocity: { x: (dx / ndist) * speed, y: (dy / ndist) * speed },
      heading,
      throttleOn: true,
    },
    hp: ENEMY_INITIAL_HP_LIGHT,
    maxHp: ENEMY_INITIAL_HP_LIGHT,
    weaponCooldown: 0.5 + rng.next() * 1.0,
    alive: true,
  };
}
```

- [ ] **Step 4: Integrate into tick.ts and add XP**

Update `packages/core/src/world/tick.ts` — final form for prototype:
```typescript
import {
  TICK_DT,
  XP_PER_KILL_LIGHT,
  LEVEL_UP_THRESHOLDS,
  type PlayerCommand,
} from '@biplanes/shared';
import { stepPlane } from '../physics/plane-physics.js';
import { firePlayerWeapon, stepBullets } from '../systems/weapon-system.js';
import { resolveBulletPlaneHits } from '../systems/collision-system.js';
import { computeSpawnsThisTick, makeEnemyPlane } from '../systems/spawn-system.js';
import { chasePolicy } from '../ai/chase-policy.js';
import { createRng } from '../rng/mulberry32.js';
import type { WorldState } from './world-state.js';

export function tick(state: WorldState, playerCommand: PlayerCommand): WorldState {
  if (state.gameOver || state.pendingLevelUp) return state;

  let nextEntityId = state.nextEntityId;

  // 1. Player physics + weapon
  const newPlayerKinematic = stepPlane(
    state.player.kinematic,
    { rotate: playerCommand.rotate },
    TICK_DT
  );

  let newBulletList = stepBullets(state.bullets);
  const fireResult = firePlayerWeapon(state.player, playerCommand.fire, nextEntityId);
  if (fireResult.bullet) {
    newBulletList.push(fireResult.bullet);
    nextEntityId++;
  }

  let player = {
    ...state.player,
    kinematic: newPlayerKinematic,
    weaponCooldown: fireResult.newCooldown,
  };

  // 2. Enemy AI + physics + weapons
  let enemies = state.enemies
    .filter(e => e.alive)
    .map(e => {
      const cmd = chasePolicy(e, player);
      const newKin = stepPlane(e.kinematic, { rotate: cmd.rotate }, TICK_DT);
      let newCooldown = Math.max(0, e.weaponCooldown - TICK_DT);

      if (cmd.fire && newCooldown === 0) {
        const fakeForFire = { ...e, weaponCooldown: 0, kinematic: newKin };
        const result = firePlayerWeapon(fakeForFire, true, nextEntityId);
        if (result.bullet) {
          newBulletList.push(result.bullet);
          nextEntityId++;
          newCooldown = result.newCooldown;
        }
      }
      return { ...e, kinematic: newKin, weaponCooldown: newCooldown };
    });

  // 3. Collisions
  const collision = resolveBulletPlaneHits(newBulletList, player, enemies);
  player = collision.player;
  enemies = collision.enemies.filter(e => e.alive);

  // 4. Award XP
  let xpCollected = state.xpCollected + collision.kills * XP_PER_KILL_LIGHT;

  // 5. Level-up check
  let level = state.level;
  let pendingLevelUp = false;
  const nextThreshold = LEVEL_UP_THRESHOLDS[level - 1];
  if (nextThreshold !== undefined && xpCollected >= nextThreshold) {
    level += 1;
    pendingLevelUp = true;
  }

  // 6. Spawning
  const rng = createRng(state.rngState);
  const spawn = computeSpawnsThisTick(state.timeSec + TICK_DT, state.timeSec, rng, player.kinematic.position);
  for (let i = 0; i < spawn.count; i++) {
    enemies.push(makeEnemyPlane(nextEntityId, player.kinematic.position, rng));
    nextEntityId++;
  }

  // Advance RNG state — coarse but deterministic
  let newRngState = state.rngState;
  for (let i = 0; i < spawn.count + 1; i++) newRngState = (newRngState + 0x6d2b79f5) >>> 0;

  return {
    ...state,
    timeSec: state.timeSec + TICK_DT,
    tickCount: state.tickCount + 1,
    nextEntityId,
    rngState: newRngState,
    player,
    enemies,
    bullets: collision.bullets,
    xpCollected,
    level,
    pendingLevelUp,
    gameOver: !player.alive,
  };
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): wave spawning, XP from kills, level-up trigger"
```

---

### Task 13: Upgrade pool + apply-upgrade (TDD)

**Files:**
- Create: `packages/core/src/upgrades/upgrade-pool.ts`
- Create: `packages/core/src/upgrades/apply-upgrade.ts`
- Create: `packages/core/src/upgrades/apply-upgrade.test.ts`
- Modify: `packages/core/src/world/world-state.ts` to track applied upgrades

- [ ] **Step 1: Add applied upgrades to WorldState**

In `packages/core/src/world/world-state.ts`, add inside `WorldState`:
```typescript
  appliedUpgradeIds: string[];      // chronological list of upgrade IDs picked
  damageMultiplier: number;         // 1.0 base, multiplies bullet damage
  fireRateMultiplier: number;       // 1.0 base, divides cooldown
  hpMultiplier: number;             // 1.0 base, multiplies max HP on apply
  xpMagnetRange: number;            // not used yet, future
  hasDrone: boolean;                // future flag for drone companion
```

Update `createWorldState` initializer to set these to defaults (`[]`, `1.0`, `1.0`, `1.0`, base value, `false`).

- [ ] **Step 2: Define upgrade pool**

`packages/core/src/upgrades/upgrade-pool.ts`:
```typescript
export type UpgradeId =
  | 'damage_plus_25'
  | 'damage_plus_50'
  | 'fire_rate_plus_25'
  | 'fire_rate_plus_50'
  | 'hp_plus_25'
  | 'hp_plus_50'
  | 'magnet_range_plus'
  | 'drone_wingman'
  | 'piercing_bullets'   // placeholder for proto
  | 'gatling_evolution'; // evolution of damage + fire rate stacks

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  category: 'weapon' | 'plane' | 'passive' | 'companion';
  isEvolution: boolean;
  evolutionRequires?: UpgradeId[]; // both must be present
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { id: 'damage_plus_25', title: '+25% Damage', description: 'Bullets hurt more.', category: 'passive', isEvolution: false },
  { id: 'damage_plus_50', title: '+50% Damage', description: 'Bullets hurt a lot more.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_25', title: '+25% Fire Rate', description: 'Shoot faster.', category: 'passive', isEvolution: false },
  { id: 'fire_rate_plus_50', title: '+50% Fire Rate', description: 'Shoot much faster.', category: 'passive', isEvolution: false },
  { id: 'hp_plus_25', title: '+25% Max HP', description: 'Tougher airframe.', category: 'plane', isEvolution: false },
  { id: 'hp_plus_50', title: '+50% Max HP', description: 'Reinforced armor.', category: 'plane', isEvolution: false },
  { id: 'magnet_range_plus', title: 'XP Magnet', description: 'Wider XP pickup range.', category: 'passive', isEvolution: false },
  { id: 'drone_wingman', title: 'Drone Wingman', description: 'A small drone fires alongside you.', category: 'companion', isEvolution: false },
  { id: 'piercing_bullets', title: 'Piercing Bullets', description: 'Bullets pass through one enemy.', category: 'weapon', isEvolution: false },
  { id: 'gatling_evolution', title: '⚡ Gatling Gun', description: 'EVOLUTION: continuous stream of fire.', category: 'weapon', isEvolution: true, evolutionRequires: ['damage_plus_50', 'fire_rate_plus_50'] },
];

export function rollUpgradeChoices(
  applied: readonly string[],
  rng: { pickN: <T>(items: readonly T[], n: number) => T[] }
): UpgradeDef[] {
  const available = UPGRADE_DEFS.filter(u => {
    if (applied.includes(u.id)) return false;
    if (u.isEvolution) {
      return u.evolutionRequires!.every(req => applied.includes(req));
    }
    return true;
  });

  if (available.length === 0) return [];
  const n = Math.min(3, available.length);
  return rng.pickN(available, n);
}
```

- [ ] **Step 3: Write failing apply-upgrade tests**

`packages/core/src/upgrades/apply-upgrade.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applyUpgrade } from './apply-upgrade.js';
import { createWorldState } from '../world/world-state.js';
import { PLANE_INITIAL_HP } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, heading: 0, throttleOn: true },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
  };
}

describe('applyUpgrade', () => {
  it('damage_plus_25 increases damageMultiplier by 25%', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.damageMultiplier).toBeCloseTo(1.25);
  });

  it('fire_rate_plus_50 increases fireRateMultiplier by 50%', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'fire_rate_plus_50');
    expect(after.fireRateMultiplier).toBeCloseTo(1.5);
  });

  it('hp_plus_25 increases max HP and current HP proportionally', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'hp_plus_25');
    expect(after.player.maxHp).toBeCloseTo(PLANE_INITIAL_HP * 1.25);
    expect(after.player.hp).toBeCloseTo(PLANE_INITIAL_HP * 1.25);
  });

  it('appends id to appliedUpgradeIds', () => {
    const s = createWorldState(42, makePlayer());
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.appliedUpgradeIds).toEqual(['damage_plus_25']);
  });

  it('clears pendingLevelUp', () => {
    const s = { ...createWorldState(42, makePlayer()), pendingLevelUp: true };
    const after = applyUpgrade(s, 'damage_plus_25');
    expect(after.pendingLevelUp).toBe(false);
  });
});
```

- [ ] **Step 4: Run, expect fail**

```bash
pnpm --filter @biplanes/core test -- apply-upgrade
```

- [ ] **Step 5: Implement apply-upgrade.ts**

```typescript
import type { WorldState } from '../world/world-state.js';
import type { UpgradeId } from './upgrade-pool.js';

export function applyUpgrade(state: WorldState, id: UpgradeId): WorldState {
  let damageMultiplier = state.damageMultiplier;
  let fireRateMultiplier = state.fireRateMultiplier;
  let hasDrone = state.hasDrone;
  let player = state.player;
  let xpMagnetRange = state.xpMagnetRange;

  switch (id) {
    case 'damage_plus_25': damageMultiplier *= 1.25; break;
    case 'damage_plus_50': damageMultiplier *= 1.5; break;
    case 'fire_rate_plus_25': fireRateMultiplier *= 1.25; break;
    case 'fire_rate_plus_50': fireRateMultiplier *= 1.5; break;
    case 'hp_plus_25': {
      const newMax = player.maxHp * 1.25;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'hp_plus_50': {
      const newMax = player.maxHp * 1.5;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'magnet_range_plus': xpMagnetRange = (xpMagnetRange || 120) * 1.5; break;
    case 'drone_wingman': hasDrone = true; break;
    case 'piercing_bullets': /* prototype: no-op effect for now */ break;
    case 'gatling_evolution':
      damageMultiplier *= 1.5;
      fireRateMultiplier *= 2.0;
      break;
  }

  return {
    ...state,
    player,
    damageMultiplier,
    fireRateMultiplier,
    hasDrone,
    xpMagnetRange,
    appliedUpgradeIds: [...state.appliedUpgradeIds, id],
    pendingLevelUp: false,
  };
}
```

- [ ] **Step 6: Run all tests**

```bash
pnpm --filter @biplanes/core test
```

- [ ] **Step 7: Wire damage & fire-rate multipliers into weapon-system**

Modify `packages/core/src/systems/weapon-system.ts` — `firePlayerWeapon` should accept a multiplier:
```typescript
export function firePlayerWeapon(
  plane: Plane,
  fireInput: boolean,
  bulletId: EntityId,
  damageMultiplier: number = 1,
  fireRateMultiplier: number = 1
): FireResult {
  if (!fireInput || plane.weaponCooldown > 0 || !plane.alive) {
    return { newCooldown: plane.weaponCooldown };
  }
  const bullet = makeBulletFromPlane(plane, bulletId);
  bullet.damage = bullet.damage * damageMultiplier;
  return {
    bullet,
    newCooldown: MACHINE_GUN_COOLDOWN / fireRateMultiplier,
  };
}
```

Update tick.ts call site:
```typescript
const fireResult = firePlayerWeapon(
  state.player, playerCommand.fire, nextEntityId,
  state.damageMultiplier, state.fireRateMultiplier
);
```

Update existing weapon-system tests so they pass multipliers explicitly or rely on defaults (defaults are 1, so existing tests should still pass).

- [ ] **Step 8: Run all tests, commit**

```bash
pnpm --filter @biplanes/core test
git add packages/core/src
git commit -m "feat(core): upgrade pool, apply-upgrade, multiplier wiring"
```

---

### Task 14: Core package public API

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Re-export the public surface**

```typescript
export * from './world/world-state.js';
export * from './world/tick.js';
export * from './entities/plane.js';
export * from './entities/bullet.js';
export * from './physics/plane-physics.js';
export * from './upgrades/upgrade-pool.js';
export * from './upgrades/apply-upgrade.js';
export * from './rng/mulberry32.js';
```

- [ ] **Step 2: Typecheck, lint, commit**

```bash
pnpm --filter @biplanes/core typecheck
pnpm --filter @biplanes/core lint
git add packages/core/src/index.ts
git commit -m "chore(core): export public API"
```

Expected: typecheck and lint pass; lint must enforce no pixi/render imports from core.

---

## Phase 2 — Input layer

### Task 15: Input package — keyboard + touch → PlayerCommand

**Files:**
- Create: `packages/input/package.json`
- Create: `packages/input/tsconfig.json`
- Create: `packages/input/src/keyboard.ts`
- Create: `packages/input/src/touch.ts`
- Create: `packages/input/src/index.ts`

- [ ] **Step 1: package.json + tsconfig**

```json
{
  "name": "@biplanes/input",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "@biplanes/shared": "workspace:*"
  }
}
```

tsconfig (mirror others):
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }
```

- [ ] **Step 2: keyboard.ts**

```typescript
import type { PlayerCommand } from '@biplanes/shared';

export interface KeyboardController {
  current(): PlayerCommand;
  destroy(): void;
}

export function createKeyboardController(): KeyboardController {
  const keys = new Set<string>();
  const onDown = (e: KeyboardEvent) => keys.add(e.code);
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  return {
    current(): PlayerCommand {
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      let rotate: -1 | 0 | 1 = 0;
      if (left && !right) rotate = -1;
      else if (right && !left) rotate = 1;

      return {
        rotate,
        fire: keys.has('Space'),
        bomb: keys.has('ShiftLeft') || keys.has('KeyB'),
      };
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}
```

- [ ] **Step 3: touch.ts (mobile overlay)**

```typescript
import type { PlayerCommand } from '@biplanes/shared';

export interface TouchController {
  current(): PlayerCommand;
  destroy(): void;
  // expose for render to draw the buttons
  zones: {
    rotateCcw: { x: number; y: number; r: number };
    rotateCw: { x: number; y: number; r: number };
    fire: { x: number; y: number; r: number };
    bomb: { x: number; y: number; r: number };
  };
  updateZones(viewportW: number, viewportH: number): void;
}

export function createTouchController(canvas: HTMLElement): TouchController {
  const state = { rotateCcw: false, rotateCw: false, fire: false, bomb: false };
  const zones = {
    rotateCcw: { x: 0, y: 0, r: 0 },
    rotateCw: { x: 0, y: 0, r: 0 },
    fire: { x: 0, y: 0, r: 0 },
    bomb: { x: 0, y: 0, r: 0 },
  };

  function updateZones(w: number, h: number) {
    const r = Math.min(w, h) * 0.08;
    zones.rotateCcw = { x: r * 1.2, y: h - r * 1.2, r };
    zones.rotateCw = { x: r * 3.2, y: h - r * 1.2, r };
    zones.fire = { x: w - r * 1.5, y: h - r * 1.5, r: r * 1.2 };
    zones.bomb = { x: w - r * 3.5, y: h - r * 1.5, r };
  }

  function inZone(px: number, py: number, z: { x: number; y: number; r: number }) {
    const dx = px - z.x; const dy = py - z.y;
    return dx * dx + dy * dy < z.r * z.r;
  }

  function handleTouches(touches: TouchList) {
    state.rotateCcw = state.rotateCw = state.fire = state.bomb = false;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (inZone(x, y, zones.rotateCcw)) state.rotateCcw = true;
      if (inZone(x, y, zones.rotateCw)) state.rotateCw = true;
      if (inZone(x, y, zones.fire)) state.fire = true;
      if (inZone(x, y, zones.bomb)) state.bomb = true;
    }
  }

  const onTouch = (e: TouchEvent) => {
    e.preventDefault();
    handleTouches(e.touches);
  };

  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('touchmove', onTouch, { passive: false });
  canvas.addEventListener('touchend', onTouch, { passive: false });
  canvas.addEventListener('touchcancel', onTouch, { passive: false });

  return {
    current(): PlayerCommand {
      let rotate: -1 | 0 | 1 = 0;
      if (state.rotateCcw && !state.rotateCw) rotate = -1;
      else if (state.rotateCw && !state.rotateCcw) rotate = 1;
      return { rotate, fire: state.fire, bomb: state.bomb };
    },
    destroy() {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouch);
      canvas.removeEventListener('touchcancel', onTouch);
    },
    zones,
    updateZones,
  };
}
```

- [ ] **Step 4: index.ts**

```typescript
export * from './keyboard.js';
export * from './touch.js';
```

- [ ] **Step 5: Install, typecheck, commit**

```bash
pnpm install
pnpm --filter @biplanes/input typecheck
git add packages/input
git commit -m "feat(input): keyboard and touch controllers emitting PlayerCommand"
```

---

## Phase 3 — Render layer

### Task 16: Render package — Pixi setup + plane sprite + camera

**Files:**
- Create: `packages/render/package.json`
- Create: `packages/render/tsconfig.json`
- Create: `packages/render/src/pixi-app.ts`
- Create: `packages/render/src/scene/plane-sprite.ts`
- Create: `packages/render/src/scene/bullet-sprite.ts`
- Create: `packages/render/src/scene/sky-background.ts`
- Create: `packages/render/src/scene/hud.ts`
- Create: `packages/render/src/camera.ts`
- Create: `packages/render/src/index.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@biplanes/render",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "@biplanes/shared": "workspace:*",
    "@biplanes/core": "workspace:*",
    "pixi.js": "^8.2.0"
  }
}
```

- [ ] **Step 2: tsconfig.json — same shape as others**

- [ ] **Step 3: pixi-app.ts**

```typescript
import { Application } from 'pixi.js';

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    background: 0x1a2a4a,
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  container.appendChild(app.canvas);
  return app;
}
```

- [ ] **Step 4: scene/sky-background.ts**

```typescript
import { Container, Graphics, Sprite, Texture } from 'pixi.js';

export function createSkyBackground(width: number, height: number): Container {
  const c = new Container();

  // Gradient sky via tinted graphics (simple two-band for prototype)
  const top = new Graphics().rect(0, 0, width, height * 0.6).fill(0x1f4f8b);
  const bottom = new Graphics().rect(0, height * 0.6, width, height * 0.4).fill(0xd8985c);
  c.addChild(top, bottom);

  // Cloud silhouettes (parallax placeholders)
  for (let i = 0; i < 8; i++) {
    const cloud = new Graphics()
      .ellipse((i * width) / 8, height * 0.2 + Math.random() * height * 0.3, 80 + Math.random() * 60, 20 + Math.random() * 15)
      .fill({ color: 0xffffff, alpha: 0.25 });
    c.addChild(cloud);
  }

  // Floating rock silhouettes (parallax)
  for (let i = 0; i < 4; i++) {
    const rock = new Graphics()
      .ellipse((i * width) / 4 + 200, height * 0.7, 180, 50)
      .fill({ color: 0x000000, alpha: 0.4 });
    c.addChild(rock);
  }

  return c;
}
```

- [ ] **Step 5: scene/plane-sprite.ts**

```typescript
import { Container, Graphics } from 'pixi.js';
import type { Plane } from '@biplanes/core';

export function createPlaneSprite(faction: 'player' | 'enemy'): { container: Container; update: (p: Plane) => void } {
  const c = new Container();

  const body = new Graphics()
    .moveTo(20, 0)
    .lineTo(-16, -10)
    .lineTo(-12, 0)
    .lineTo(-16, 10)
    .closePath()
    .fill(faction === 'player' ? 0xf4d35e : 0xc0392b);

  const wingTop = new Graphics().rect(-10, -16, 22, 4).fill(faction === 'player' ? 0xeab308 : 0x922b21);
  const wingBot = new Graphics().rect(-10, 12, 22, 4).fill(faction === 'player' ? 0xeab308 : 0x922b21);

  c.addChild(wingTop, wingBot, body);

  return {
    container: c,
    update(p: Plane) {
      c.x = p.kinematic.position.x;
      c.y = p.kinematic.position.y;
      c.rotation = p.kinematic.heading;
      c.alpha = p.alive ? 1 : 0;
    },
  };
}
```

- [ ] **Step 6: scene/bullet-sprite.ts**

```typescript
import { Container, Graphics } from 'pixi.js';
import type { Bullet } from '@biplanes/core';

export class BulletPool {
  private pool: Graphics[] = [];
  private active = new Map<number, Graphics>();
  constructor(private container: Container) {}

  sync(bullets: readonly Bullet[]) {
    const seen = new Set<number>();
    for (const b of bullets) {
      seen.add(b.id);
      let g = this.active.get(b.id);
      if (!g) {
        g = this.pool.pop() ?? new Graphics().circle(0, 0, 3).fill(0xfff5a0);
        this.container.addChild(g);
        this.active.set(b.id, g);
      }
      g.x = b.position.x;
      g.y = b.position.y;
    }
    for (const [id, g] of this.active) {
      if (!seen.has(id)) {
        this.container.removeChild(g);
        this.active.delete(id);
        this.pool.push(g);
      }
    }
  }
}
```

- [ ] **Step 7: camera.ts**

```typescript
import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';

export function createCamera(worldRoot: Container, screenW: number, screenH: number) {
  let shakeAmount = 0;
  return {
    follow(player: Plane) {
      const tx = -player.kinematic.position.x + screenW / 2;
      const ty = -player.kinematic.position.y + screenH / 2;
      worldRoot.x += (tx - worldRoot.x) * 0.15;
      worldRoot.y += (ty - worldRoot.y) * 0.15;

      if (shakeAmount > 0) {
        worldRoot.x += (Math.random() - 0.5) * shakeAmount;
        worldRoot.y += (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= 0.85;
      }
    },
    shake(amount: number) { shakeAmount = Math.max(shakeAmount, amount); },
    setScreen(w: number, h: number) { screenW = w; screenH = h; },
  };
}
```

- [ ] **Step 8: scene/hud.ts**

```typescript
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

export function createHud(width: number, height: number) {
  const c = new Container();
  const hpBg = new Graphics().rect(20, 20, 240, 20).fill(0x000000);
  const hpFill = new Graphics().rect(22, 22, 236, 16).fill(0xe74c3c);
  const xpBg = new Graphics().rect(20, 50, 240, 10).fill(0x000000);
  const xpFill = new Graphics().rect(22, 52, 0, 6).fill(0xf1c40f);

  const style = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: 0xffffff });
  const text = new Text({ text: '', style });
  text.x = 20; text.y = 70;

  c.addChild(hpBg, hpFill, xpBg, xpFill, text);

  return {
    container: c,
    update(s: WorldState) {
      const hpPct = Math.max(0, s.player.hp / s.player.maxHp);
      hpFill.clear().rect(22, 22, 236 * hpPct, 16).fill(0xe74c3c);

      const prevThreshold = s.level >= 2 ? [10, 25, 50, 90, 150, 230, 330, 450][s.level - 2] ?? 0 : 0;
      const nextThreshold = [10, 25, 50, 90, 150, 230, 330, 450][s.level - 1] ?? 999999;
      const xpPct = Math.max(0, Math.min(1, (s.xpCollected - prevThreshold) / (nextThreshold - prevThreshold)));
      xpFill.clear().rect(22, 52, 236 * xpPct, 6).fill(0xf1c40f);

      text.text = `LVL ${s.level}   TIME ${s.timeSec.toFixed(1)}s   ENEMIES ${s.enemies.length}`;
    },
    resize(w: number, h: number) { width = w; height = h; },
  };
}
```

- [ ] **Step 9: index.ts**

```typescript
export * from './pixi-app.js';
export * from './scene/sky-background.js';
export * from './scene/plane-sprite.js';
export * from './scene/bullet-sprite.js';
export * from './scene/hud.js';
export * from './camera.js';
```

- [ ] **Step 10: Install, typecheck, commit**

```bash
pnpm install
pnpm --filter @biplanes/render typecheck
git add packages/render
git commit -m "feat(render): Pixi setup, plane/bullet/sky/HUD/camera"
```

---

## Phase 4 — App orchestrator

### Task 17: App package — main game loop, screens

**Files:**
- Create: `packages/app/package.json`
- Create: `packages/app/tsconfig.json`
- Create: `packages/app/src/main.ts`
- Create: `packages/app/src/screens/level-up-screen.ts`
- Create: `packages/app/src/screens/death-screen.ts`
- Create: `packages/app/src/index.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@biplanes/app",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "@biplanes/shared": "workspace:*",
    "@biplanes/core": "workspace:*",
    "@biplanes/render": "workspace:*",
    "@biplanes/input": "workspace:*",
    "pixi.js": "^8.2.0"
  }
}
```

- [ ] **Step 2: screens/level-up-screen.ts**

```typescript
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { UpgradeDef } from '@biplanes/core';

export function createLevelUpScreen(width: number, height: number, onPick: (id: string) => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.6 });
  c.addChild(dim);

  const titleStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 32, fill: 0xffffff, fontWeight: 'bold' });
  const title = new Text({ text: 'LEVEL UP — CHOOSE ONE', style: titleStyle });
  title.x = (width - title.width) / 2;
  title.y = height * 0.15;
  c.addChild(title);

  const buttons: { container: Container; setUpgrade: (u: UpgradeDef) => void }[] = [];

  for (let i = 0; i < 3; i++) {
    const btn = new Container();
    btn.x = (width / 3) * i + width / 6 - 140;
    btn.y = height * 0.35;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics().roundRect(0, 0, 280, 180, 12).fill(0x2c3e50).stroke({ width: 3, color: 0xf1c40f });
    btn.addChild(bg);

    const t = new Text({
      text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 20, fill: 0xffffff, fontWeight: 'bold', wordWrap: true, wordWrapWidth: 260 }),
    });
    t.x = 14; t.y = 14;
    btn.addChild(t);

    const d = new Text({
      text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: 0xbdc3c7, wordWrap: true, wordWrapWidth: 260 }),
    });
    d.x = 14; d.y = 60;
    btn.addChild(d);

    let currentId = '';
    btn.on('pointerdown', () => { if (currentId) onPick(currentId); });

    buttons.push({
      container: btn,
      setUpgrade(u: UpgradeDef) {
        currentId = u.id;
        t.text = u.title;
        d.text = u.description;
      },
    });

    c.addChild(btn);
  }

  return {
    container: c,
    show(choices: readonly UpgradeDef[]) {
      c.visible = true;
      buttons.forEach((b, i) => {
        const u = choices[i];
        if (u) { b.setUpgrade(u); b.container.visible = true; }
        else { b.container.visible = false; }
      });
    },
    hide() { c.visible = false; },
    resize(w: number, h: number) {
      dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
      title.x = (w - title.width) / 2;
      title.y = h * 0.15;
      buttons.forEach((b, i) => {
        b.container.x = (w / 3) * i + w / 6 - 140;
        b.container.y = h * 0.35;
      });
    },
  };
}
```

- [ ] **Step 3: screens/death-screen.ts**

```typescript
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

export function createDeathScreen(width: number, height: number, onRestart: () => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.7 });
  c.addChild(dim);

  const title = new Text({ text: 'YOU DIED', style: new TextStyle({ fontFamily: 'monospace', fontSize: 48, fill: 0xe74c3c, fontWeight: 'bold' }) });
  c.addChild(title);

  const stats = new Text({ text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 18, fill: 0xffffff, align: 'center' }) });
  c.addChild(stats);

  const button = new Container();
  button.eventMode = 'static';
  button.cursor = 'pointer';
  const btnBg = new Graphics().roundRect(0, 0, 240, 60, 12).fill(0x27ae60);
  const btnText = new Text({ text: 'TRY AGAIN', style: new TextStyle({ fontFamily: 'monospace', fontSize: 22, fill: 0xffffff, fontWeight: 'bold' }) });
  btnText.x = (240 - btnText.width) / 2;
  btnText.y = (60 - btnText.height) / 2;
  button.addChild(btnBg, btnText);
  button.on('pointerdown', onRestart);
  c.addChild(button);

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.7 });
    title.x = (w - title.width) / 2;
    title.y = h * 0.25;
    stats.x = (w - stats.width) / 2;
    stats.y = h * 0.4;
    button.x = (w - 240) / 2;
    button.y = h * 0.65;
  }
  layout(width, height);

  return {
    container: c,
    show(state: WorldState) {
      stats.text = `Survived: ${state.timeSec.toFixed(1)}s\nLevel: ${state.level}\nXP: ${state.xpCollected}\nUpgrades: ${state.appliedUpgradeIds.length}`;
      stats.x = (c.parent ? c.parent.width : 800 - stats.width) / 2;
      c.visible = true;
    },
    hide() { c.visible = false; },
    resize(w: number, h: number) { layout(w, h); },
  };
}
```

- [ ] **Step 4: main.ts (game loop orchestrator)**

```typescript
import { Container } from 'pixi.js';
import {
  TICK_DT, TICK_HZ,
  PLANE_INITIAL_HP,
  type PlayerCommand,
} from '@biplanes/shared';
import {
  createWorldState, tick,
  applyUpgrade,
  rollUpgradeChoices,
  createRng,
  type WorldState,
  type Plane,
} from '@biplanes/core';
import {
  createPixiApp,
  createSkyBackground,
  createPlaneSprite,
  BulletPool,
  createCamera,
  createHud,
} from '@biplanes/render';
import {
  createKeyboardController,
  createTouchController,
} from '@biplanes/input';
import { createLevelUpScreen } from './screens/level-up-screen.js';
import { createDeathScreen } from './screens/death-screen.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 2000, y: 1000 }, velocity: { x: 250, y: 0 }, heading: 0, throttleOn: true },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
  };
}

export async function startGame(container: HTMLElement) {
  const app = await createPixiApp(container);
  const { width, height } = app.screen;

  // World layer (camera follows)
  const worldLayer = new Container();
  app.stage.addChild(worldLayer);

  const sky = createSkyBackground(8000, 4000);
  sky.x = -2000; sky.y = -1000;
  worldLayer.addChild(sky);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  worldLayer.addChild(bulletLayer, planeLayer);

  const bullets = new BulletPool(bulletLayer);
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  const camera = createCamera(worldLayer, width, height);

  // UI layer (fixed)
  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  const hud = createHud(width, height);
  uiLayer.addChild(hud.container);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
  let pendingChoices: ReturnType<typeof rollUpgradeChoices> = [];

  const levelUpScreen = createLevelUpScreen(width, height, (id) => {
    state = applyUpgrade(state, id as never);
    levelUpScreen.hide();
  });
  uiLayer.addChild(levelUpScreen.container);

  const deathScreen = createDeathScreen(width, height, () => {
    state = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
    deathScreen.hide();
  });
  uiLayer.addChild(deathScreen.container);

  // Input
  const kb = createKeyboardController();
  const touch = createTouchController(app.canvas);
  touch.updateZones(width, height);

  function currentCommand(): PlayerCommand {
    const k = kb.current();
    const t = touch.current();
    return {
      rotate: (k.rotate || t.rotate) as -1 | 0 | 1,
      fire: k.fire || t.fire,
      bomb: k.bomb || t.bomb,
    };
  }

  // Fixed-timestep loop with interpolation accumulator
  let acc = 0;
  app.ticker.add(({ deltaMS }) => {
    acc += deltaMS / 1000;
    const cmd = currentCommand();
    let safety = 8;
    while (acc >= TICK_DT && safety > 0) {
      state = tick(state, cmd);
      acc -= TICK_DT;
      safety--;

      // Trigger level-up screen
      if (state.pendingLevelUp && !levelUpScreen.container.visible) {
        const rng = createRng(state.rngState);
        pendingChoices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
        if (pendingChoices.length === 0) {
          state = { ...state, pendingLevelUp: false };
        } else {
          levelUpScreen.show(pendingChoices);
        }
      }

      // Death screen
      if (state.gameOver && !deathScreen.container.visible) {
        deathScreen.show(state);
      }
    }

    // Render
    playerSprite.update(state.player);

    // Sync enemy sprites
    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy');
        planeLayer.addChild(s.container);
        enemySprites.set(e.id, s);
      }
      s.update(e);
    }
    for (const [id, s] of enemySprites) {
      if (!seenEnemy.has(id)) {
        planeLayer.removeChild(s.container);
        enemySprites.delete(id);
      }
    }

    bullets.sync(state.bullets);
    hud.update(state);
    camera.follow(state.player);
  });

  // Resize
  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    camera.setScreen(w, h);
    hud.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
    touch.updateZones(w, h);
  };
  window.addEventListener('resize', onResize);
}
```

- [ ] **Step 5: index.ts**

```typescript
export { startGame } from './main.js';
```

- [ ] **Step 6: tsconfig.json — same shape**

- [ ] **Step 7: Install, typecheck, commit**

```bash
pnpm install
pnpm --filter @biplanes/app typecheck
git add packages/app
git commit -m "feat(app): game loop orchestrator, level-up + death screens"
```

---

## Phase 5 — Web entry

### Task 18: Vite web app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@biplanes/web",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@biplanes/app": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: tsconfig.json — same shape**

- [ ] **Step 3: vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'es2022' },
});
```

- [ ] **Step 4: index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Biplanes Prototype</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0a1428; touch-action: none; }
    #game { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: src/main.ts**

```typescript
import { startGame } from '@biplanes/app';

const container = document.getElementById('game');
if (!container) throw new Error('No #game element');
startGame(container).catch(err => {
  console.error('Game failed to start', err);
  container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
});
```

- [ ] **Step 6: Install, run dev, commit**

```bash
pnpm install
pnpm --filter @biplanes/web typecheck
pnpm dev
```

Open http://localhost:5173 in browser. Expect: plane on screen, A/D rotates, Space fires, enemies spawn after 2s, dies when HP runs out, level-up screen appears, death screen with restart.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): Vite entry serving the playable prototype"
```

---

## Phase 6 — Polish, full-test pass, ship

### Task 19: Full-suite tests pass + lint clean

- [ ] **Step 1: Run all packages**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected:
- All Vitest tests pass (count: ~30-40 unit tests across core)
- TypeScript: 0 errors across all packages
- ESLint: 0 errors. `packages/core/.eslintrc.cjs` MUST enforce no pixi/render imports.

If lint fails: fix violations. If a violation reveals an architectural mistake (core importing pixi), refactor — don't suppress.

- [ ] **Step 2: Verify isolation rule actually fires**

Add a temporary line to `packages/core/src/index.ts`:
```typescript
import { Application } from 'pixi.js'; // should ERROR on lint
```

Run:
```bash
pnpm --filter @biplanes/core lint
```
Expected: lint error citing `no-restricted-imports`.

Remove the temp line:
```bash
git checkout packages/core/src/index.ts
```

Re-run lint to confirm clean:
```bash
pnpm --filter @biplanes/core lint
```

- [ ] **Step 3: Manual play-test checklist**

Run `pnpm dev`, open browser. Verify:
- [ ] Plane appears, throttle audibly works (visually drifts forward).
- [ ] A/D rotate the plane. Continuous press = continuous rotation.
- [ ] Plane falls under gravity if you don't actively turn.
- [ ] Pulling nose far above horizon while slow = plane drops (stall).
- [ ] Space fires bullets in nose direction.
- [ ] Bullets fly straight, fade after ~1 second.
- [ ] After ~2s, enemies start spawning off-screen and flying toward player.
- [ ] Enemy bullets damage player; HP bar shrinks.
- [ ] Killing enemies fills XP bar.
- [ ] Reaching XP threshold pauses game, shows 3 upgrade choices.
- [ ] Clicking an upgrade applies it; game resumes.
- [ ] Damage and fire-rate upgrades actually change feel.
- [ ] Hitting 0 HP shows death screen with stats.
- [ ] "TRY AGAIN" restarts cleanly.
- [ ] On mobile (DevTools device mode), touch zones in corners work.
- [ ] Window resize doesn't break layout.

- [ ] **Step 4: Commit polish if needed**

If any manual issue found, fix it, commit per-fix:
```bash
git add <paths>
git commit -m "fix: <one-line description>"
```

---

### Task 20: README update + completion mark

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md status section**

In `README.md` change the "Статус" line and "Что уже сделано" section. Add a new "Как запустить" section:

```markdown
## Как запустить прототип

```bash
pnpm install
pnpm dev
```

Откроется на http://localhost:5173. Управление: A/D — поворот, Space — огонь, Shift — бомба (пока заглушка). На мобильном — две зоны слева внизу для поворота, кнопка справа внизу для огня.
```

Update status to: `Прототип боёвки v0.1 — играбелен (2026-05-21). Следующий шаг: фидбек владельца + калибровка физики.`

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: prototype shipped, update README run instructions"
```

- [ ] **Step 3: Final tag**

```bash
git tag prototype-v0.1
```

---

## Self-Review

**Spec coverage** (spec §6 "Прототип боёвки" requirements):
- ✅ Технический фундамент (pnpm + TS + PixiJS) — Tasks 1-4, 16, 18
- ✅ Одна играбельная сцена — Task 18
- ✅ Самолёт Чико с физикой stall — Task 7
- ✅ 2-3 типа врагов — Task 12 (one type; expand in iteration if needed — flagged as future work)
- ✅ Спавн волн нарастающей сложности 3-5 мин — Task 12
- ⚠️ Один босс к концу 5 минут — DEFERRED (mentioned in spec; prototype ships without boss to keep scope tight; add as Task 21 if owner wants)
- ✅ Стрельба из пулемёта, HP, урон, смерть — Tasks 9, 11
- ✅ Build-loop: XP, level-up, 3 опции, ~8-10 апгрейдов, 1-2 эволюции — Tasks 12, 13
- ✅ Keyboard + touch управление — Task 15
- ✅ Экран смерти со статистикой + restart — Task 17

**Placeholders:** Scanned — no "TBD"/"fill in later" in code steps. Boss is the one deferral, flagged explicitly above.

**Type consistency:** `PlayerCommand`, `Plane`, `Bullet`, `WorldState`, `PlaneKinematic`, `UpgradeId`, `UpgradeDef` are used consistently across tasks. Method signatures align between definition and call sites.

**Open from spec:**
- Boss spawn at end of 5 min — recommended Task 21 follow-up. Reuses Plane entity with heavy HP + custom AI policy (e.g., circles player at distance, fires bursts).
- Audio (SFX/music) — explicitly out of scope per spec §6.
- TMA SDK wrapper — out of scope per spec §6.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-combat-prototype.md`. Auto-proceeding with **subagent-driven execution** (owner is non-technical and explicitly delegated autonomous implementation: "оставляю, все разрешения есть, начинай писать код").

Next step: invoke `superpowers:subagent-driven-development` to dispatch fresh subagents per task with two-stage review between tasks.
