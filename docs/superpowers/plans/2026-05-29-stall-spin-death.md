# Stall → Spin → Death Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the campaign (softFloor), a plane that loses airspeed nose-up departs into a recoverable spin that falls down the screen; recover with throttle + nose-down, or die if it spins into the bottom. A thrustless low-speed plane can never hover.

**Architecture:** New deterministic `spinning` plane state in the headless core. Entry is evaluated from `flying`; the spin runs its own physics step (`stepPlaneSpin`) that always sinks; recovery returns to `flying`; reaching the floor while spinning routes to the existing death/crashed path. Gated by the existing `softFloor` world flag so arcade mode is untouched. Render shows the tumble automatically (sprite rotation follows heading) plus a player STALL warning.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest. Core packages: `@biplanes/shared` (constants), `@biplanes/core` (physics + state machine), `@biplanes/render` (sprites/HUD), `@biplanes/app` (wiring).

**Spec:** `docs/superpowers/specs/2026-05-29-stall-spin-death-design.md`

---

### Task 1: Tuning constants

**Files:**
- Modify: `packages/shared/src/constants.ts` (append after the existing `// === Plane physics` block / near other tunables)

- [ ] **Step 1: Add the spin constants**

Append to `packages/shared/src/constants.ts`:

```typescript
// === Stall → spin → death (campaign / softFloor only) ===
// Cruise sits ~570 px/s and G_STALL is 620, so these deep-stall values are far
// below normal flight — you only spin if you genuinely kill your energy nose-up.
export const SPIN_STALL_SPEED = 200;        // px/sec — below this (nose up) a spin can start
export const SPIN_NOSE_UP = -0.35;          // sin(heading) below this = nose meaningfully up
export const SPIN_ENTRY_DELAY = 0.4;        // sec both conditions must hold before departure
export const SPIN_ROTATE_RATE = 4.0;        // rad/sec autorotation while spinning
export const SPIN_CONTROL_AUTHORITY = 0.2;  // fraction of normal rotate input retained in spin
export const SPIN_RECOVER_SPEED = 500;      // px/sec at/above which the plane exits the spin
export const SPIN_SINK = 700;               // px/sec constant downward fall while spinning (never hovers)
export const STALL_WARN_SPEED = 320;        // px/sec (nose up) at/below which the STALL warning shows
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @biplanes/shared typecheck`
Expected: no errors (if `@biplanes/shared` has no `typecheck` script, run `pnpm --filter @biplanes/core typecheck` — it imports shared).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(physics): add stall→spin→death tuning constants"
```

---

### Task 2: Add `spinning` state + `stallTimer` to the Plane type

**Files:**
- Modify: `packages/core/src/entities/plane.ts`

- [ ] **Step 1: Extend the state union and document it**

In `packages/core/src/entities/plane.ts`, change the `PlaneState` doc comment and union, and add a `stallTimer` field:

```typescript
/**
 * Lifecycle state of a plane.
 * - 'taxi'     — on the runway, ground roll, automatic throttle until liftoff.
 * - 'flying'   — normal dogfight physics.
 * - 'spinning' — departed into a stall/spin (campaign only); falls and can be
 *                recovered with speed, or dies if it spins into the floor.
 * - 'dying'    — lethal hit absorbed; plane spins down trailing fire for DYING_DURATION_SEC, then transitions to 'crashed'.
 * - 'crashed'  — invisible, can't fire, ticking down respawnTimer.
 * - 'spawning' — transient one-tick state used to reset to runway.
 */
export type PlaneState = 'taxi' | 'flying' | 'spinning' | 'crashed' | 'spawning' | 'dying';
```

And inside the `Plane` interface, add after `dyingTimer`:

```typescript
  dyingTimer?: number;    // seconds remaining in death-spin (only meaningful when state === 'dying')
  stallTimer?: number;    // seconds the plane has held the near-stall entry condition (flying → spinning)
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @biplanes/core typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/entities/plane.ts
git commit -m "feat(core): add 'spinning' plane state and stallTimer field"
```

---

### Task 3: `stepPlaneSpin` physics

**Files:**
- Modify: `packages/core/src/physics/plane-physics.ts`
- Test: `packages/core/src/physics/plane-physics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/physics/plane-physics.test.ts`:

```typescript
import { stepPlaneSpin } from './plane-physics.js';
import { SPIN_RECOVER_SPEED } from '@biplanes/shared';

function spinKin(overrides = {}) {
  return {
    position: { x: 900, y: 300 },
    velocity: { x: 0, y: 0 },
    heading: -Math.PI / 2, // nose up
    throttleOn: false,
    g: 80,
    facing: 1 as const,
    throttle: false,
    throttleLevel: 0,
    ...overrides,
  };
}

describe('stepPlaneSpin', () => {
  it('always sinks (never hovers) even at near-zero speed nose-up', () => {
    const out = stepPlaneSpin(spinKin(), { rotate: 0 }, 1 / 60);
    expect(out.position.y).toBeGreaterThan(300); // moved DOWN the screen
  });

  it('builds airspeed past the recovery threshold under full throttle over time', () => {
    let k = spinKin({ throttleLevel: 1, heading: 0.6 }); // throttle + nose down
    for (let i = 0; i < 240; i++) {
      k = stepPlaneSpin(k, { rotate: 0 }, 1 / 60);
    }
    expect(k.g).toBeGreaterThanOrEqual(SPIN_RECOVER_SPEED);
  });

  it('barely responds to rotate input (control is damped)', () => {
    const free = stepPlaneSpin(spinKin(), { rotate: 0 }, 1 / 60);
    const steered = stepPlaneSpin(spinKin(), { rotate: 1 }, 1 / 60);
    // Autorotation dominates; player input shifts heading only slightly.
    expect(Math.abs(steered.heading - free.heading)).toBeLessThan(0.02);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @biplanes/core test -- plane-physics`
Expected: FAIL — `stepPlaneSpin is not a function` / not exported.

- [ ] **Step 3: Implement `stepPlaneSpin`**

In `packages/core/src/physics/plane-physics.ts`, add the new constants to the import block from `@biplanes/shared`:

```typescript
  SPIN_ROTATE_RATE,
  SPIN_CONTROL_AUTHORITY,
  SPIN_SINK,
```

Then append this function after `stepPlane` (before `stepPlaneTaxi`):

```typescript
/**
 * Spin physics (campaign departure). The plane autorotates, is heavily damped to
 * player input, and ALWAYS sinks — a stalled, thrustless plane can never hover.
 * Throttle + a nose-down attitude rebuild airspeed; the caller exits the spin
 * once g >= SPIN_RECOVER_SPEED and ends the plane if it reaches the floor.
 */
export function stepPlaneSpin(
  p: PlaneKinematic,
  input: PhysicsInput,
  dt: number = TICK_DT,
  worldWidth: number = WORLD_WIDTH
): PlaneKinematic {
  // Autorotation plus heavily-damped player authority.
  let heading = p.heading
    + SPIN_ROTATE_RATE * dt
    + input.rotate * PLANE_TURN_RATE * SPIN_CONTROL_AUTHORITY * dt;
  while (heading > Math.PI) heading -= 2 * Math.PI;
  while (heading < -Math.PI) heading += 2 * Math.PI;

  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);

  // Throttle still feeds airspeed (recovery = throttle + nose-down).
  let g = p.g;
  const throttleLevel = Math.max(0, Math.min(1, p.throttleLevel));
  const targetSpeed = G_MAX_LEVEL * throttleLevel;
  const thrustFactor = Math.abs(cosH);
  if (g < targetSpeed) {
    g = Math.min(targetSpeed, g + thrustFactor * THRUST_ACCEL_MAX * dt);
  }
  // Nose-down dive feeds speed.
  const pitchEffect = -sinH * PITCH_BLEED_MAX * dt; // negative when nose-down
  if (pitchEffect <= 0) g = Math.min(G_MAX_DIVE, g - pitchEffect);
  g = Math.max(0, g - g * DRAG_COEFFICIENT * dt);

  // Velocity from heading + a constant strong downward fall (never hovers).
  const vx = cosH * g;
  const vy = sinH * g + SPIN_SINK;

  let px = p.position.x + vx * dt;
  let py = p.position.y + vy * dt;
  if (px < 0) px += worldWidth;
  if (px >= worldWidth) px -= worldWidth;
  // Hard floor backstop — death is decided by the caller, do NOT bounce here.
  if (py > GROUND_Y) py = GROUND_Y;

  return {
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    heading,
    throttleOn: throttleLevel > 0,
    g,
    facing: Math.abs(heading) <= Math.PI / 2 ? 1 : -1,
    throttle: throttleLevel > 0,
    throttleLevel,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @biplanes/core test -- plane-physics`
Expected: PASS (all three new tests, plus existing ones).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/physics/plane-physics.ts packages/core/src/physics/plane-physics.test.ts
git commit -m "feat(physics): stepPlaneSpin — autorotating, always-sinking spin step"
```

---

### Task 4: State machine — entry, spin branch, recovery & death

**Files:**
- Modify: `packages/core/src/world/tick.ts`
- Test: `packages/core/src/world/tick.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/world/tick.test.ts` (reuse the file's existing helpers for building a `WorldState`; if it has a `makeState`/`createWorldState` helper, follow that pattern — otherwise import `createWorldState` from `../world/world-state.js` and a player factory as the other tests in this file already do):

```typescript
import { SPIN_STALL_SPEED, SPIN_ENTRY_DELAY, GROUND_Y, TICK_DT } from '@biplanes/shared';

describe('stall → spin → death', () => {
  // Build a flying player nose-up at near-zero speed, softFloor on.
  function stalledState() {
    const s = makeFlyingState(); // existing helper in this test file
    s.softFloor = true;
    s.player.state = 'flying';
    s.player.kinematic = {
      ...s.player.kinematic,
      position: { x: 900, y: 300 },
      heading: -Math.PI / 2, // nose up
      g: SPIN_STALL_SPEED - 50,
      throttleLevel: 0,
    };
    return s;
  }

  it('enters spinning after holding nose-up near-zero speed past the entry delay', () => {
    let s = stalledState();
    const ticks = Math.ceil(SPIN_ENTRY_DELAY / TICK_DT) + 2;
    for (let i = 0; i < ticks; i++) {
      s = tick(s, { rotate: 0, throttleDelta: 0, fire: false, bomb: false, eject: false, jump: false });
    }
    expect(s.player.state).toBe('spinning');
  });

  it('does not enter spinning during normal cruise', () => {
    let s = makeFlyingState();
    s.softFloor = true;
    s.player.kinematic = { ...s.player.kinematic, heading: 0, g: 570, throttleLevel: 1 };
    for (let i = 0; i < 60; i++) {
      s = tick(s, { rotate: 0, throttleDelta: 0, fire: false, bomb: false, eject: false, jump: false });
    }
    expect(s.player.state).toBe('flying');
  });

  it('a spinning plane that reaches the floor dies (crashed, not alive)', () => {
    let s = stalledState();
    s.player.state = 'spinning';
    s.player.kinematic = { ...s.player.kinematic, position: { x: 900, y: GROUND_Y - 1 }, g: 50 };
    s = tick(s, { rotate: 0, throttleDelta: 0, fire: false, bomb: false, eject: false, jump: false });
    expect(s.player.state).toBe('crashed');
    expect(s.player.alive).toBe(false);
  });

  it('does not spin in arcade mode (softFloor off)', () => {
    let s = stalledState();
    s.softFloor = false;
    const ticks = Math.ceil(SPIN_ENTRY_DELAY / TICK_DT) + 5;
    for (let i = 0; i < ticks; i++) {
      s = tick(s, { rotate: 0, throttleDelta: 0, fire: false, bomb: false, eject: false, jump: false });
    }
    expect(s.player.state).not.toBe('spinning');
  });
});
```

NOTE: if this test file does not already expose `makeFlyingState`, add a small local helper at the top of this `describe` that builds a flying player via the same construction the other tests in the file use (a player whose `state === 'flying'` and is airborne). Do not invent new world fields.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @biplanes/core test -- tick`
Expected: FAIL — player stays `flying` / spinning never happens.

- [ ] **Step 3: Add imports and the spin branch in `stepPlaneByState`**

In `packages/core/src/world/tick.ts`, add to the `@biplanes/shared` import block:

```typescript
  SPIN_STALL_SPEED,
  SPIN_NOSE_UP,
  SPIN_ENTRY_DELAY,
  SPIN_RECOVER_SPEED,
```

and to the physics import:

```typescript
import { stepPlane, stepPlaneTaxi, stepPlaneSpin } from '../physics/plane-physics.js';
```

In `stepPlaneByState`, add a `spinning` branch right after the `'dying'` branch (before `'taxi'`):

```typescript
  if (p.state === 'spinning') {
    // Reaching the floor while stalled is lethal — softFloor does NOT rescue a spin.
    if (p.kinematic.position.y >= GROUND_Y - 0.5) {
      return {
        ...p,
        state: 'crashed',
        alive: false,
        hp: 0,
        stallTimer: 0,
        respawnTimer: p.faction === 'player' ? RESPAWN_DELAY_SEC : ENEMY_RESPAWN_DELAY_SEC,
      };
    }
    const spun = stepPlaneSpin(p.kinematic, { rotate: cmd.rotate }, dt, worldWidth);
    if (spun.g >= SPIN_RECOVER_SPEED) {
      return { ...p, kinematic: spun, state: 'flying', stallTimer: 0 };
    }
    return { ...p, kinematic: spun, state: 'spinning' };
  }
```

- [ ] **Step 4: Add stall-departure detection in the flying tail of `stepPlaneByState`**

Replace the final flying return block (currently the crash check followed by `return { ...p, kinematic: newKin, state: 'flying' };`) with:

```typescript
  const preVy = p.kinematic.velocity.y;
  const newKin = stepPlane(p.kinematic, { rotate: cmd.rotate }, dt, worldWidth, softFloor);

  if (!softFloor && newKin.position.y >= GROUND_Y - 0.5 && preVy > CRASH_VY_THRESHOLD) {
    return {
      ...p,
      kinematic: newKin,
      state: 'crashed',
      respawnTimer: p.faction === 'player' ? RESPAWN_DELAY_SEC : ENEMY_RESPAWN_DELAY_SEC,
      alive: false,
      hp: 0,
    };
  }

  // Campaign stall departure: nose-up + near-zero speed held for SPIN_ENTRY_DELAY → spin.
  if (softFloor) {
    const nearStall = newKin.g < SPIN_STALL_SPEED && Math.sin(newKin.heading) < SPIN_NOSE_UP;
    const stallTimer = nearStall ? (p.stallTimer ?? 0) + dt : 0;
    if (stallTimer >= SPIN_ENTRY_DELAY) {
      return { ...p, kinematic: newKin, state: 'spinning', stallTimer: 0 };
    }
    return { ...p, kinematic: newKin, state: 'flying', stallTimer };
  }

  return { ...p, kinematic: newKin, state: 'flying' };
```

- [ ] **Step 5: Let spinning enemies skip AI/firing (treat like dying)**

Find the enemy-loop early return for dying (currently `if (e.state === 'dying') { return stepPlaneByState(e, { rotate: 0 }, TICK_DT, worldWidth); }`) and change it to:

```typescript
    if (e.state === 'dying' || e.state === 'spinning') {
      // No AI/weapons while dying or spinning; just advance physics.
      return stepPlaneByState(e, { rotate: 0 }, TICK_DT, worldWidth, softFloor);
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @biplanes/core test -- tick`
Expected: PASS (4 new tests + all existing).

- [ ] **Step 7: Run the full core suite**

Run: `pnpm --filter @biplanes/core test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/world/tick.ts packages/core/src/world/tick.test.ts
git commit -m "feat(core): stall departure, spin recovery, and spin-into-floor death"
```

---

### Task 5: Render — STALL warning (spin tumble is automatic)

The spinning sprite already tumbles because `plane-sprite` sets `c.rotation = heading` and the spin autorotates the heading; the sprite stays visible (`alpha = state === 'crashed' ? 0 : 1`). No sprite change needed. This task adds the player STALL warning.

**Files:**
- Modify: `packages/app/src/main.ts`

- [ ] **Step 1: Create the warning text in the UI layer**

In `packages/app/src/main.ts`, near where other `uiLayer` overlays are created (e.g. after `missionObjective`), add:

```typescript
  const stallWarning = new Text({
    text: 'STALL',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 40,
      fill: 0xff3b30,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 4 },
    }),
  });
  stallWarning.anchor.set(0.5);
  stallWarning.visible = false;
  uiLayer.addChild(stallWarning);
```

If `Text` / `TextStyle` are not already imported from `pixi.js` at the top of `main.ts`, add them to that import.

- [ ] **Step 2: Update the warning each frame**

Add the `STALL_WARN_SPEED` and `SPIN_NOSE_UP` imports to the `@biplanes/shared` import block in `main.ts`. Then inside the ticker, after the player/world step (near where other per-frame UI like `missionObjective` is positioned), add:

```typescript
    // STALL warning — show when the player is spinning or nose-up and bleeding into the stall.
    {
      const pl = state.player;
      const nearStall = pl && pl.state === 'flying'
        && pl.kinematic.g < STALL_WARN_SPEED
        && Math.sin(pl.kinematic.heading) < SPIN_NOSE_UP;
      const showWarn = gameRunning && runMode === 'story' && !!pl && pl.alive
        && (pl.state === 'spinning' || nearStall);
      stallWarning.visible = showWarn;
      if (showWarn) {
        stallWarning.alpha = 0.55 + 0.45 * Math.sin(renderTimeSec * 18); // blink
        stallWarning.x = app.screen.width / 2;
        stallWarning.y = app.screen.height * 0.22;
      }
    }
```

(The fuselage shudder already ramps in at low speed — it doubles as the tactile warning. Audio buzzer is deferred: the project has no audio system yet; add it when one exists. Note this to Сергей.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @biplanes/app typecheck` and `pnpm --filter @biplanes/render typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "feat(app): on-screen STALL warning for the player"
```

---

### Task 6: Manual verification in the campaign

**Files:** none (manual).

- [ ] **Step 1: Launch the campaign**

Use the preview server (`launch.json` config `biplanes-dev`, port 5173) and open `http://localhost:5173/?story&skipBriefing`. (Note: the automated screenshot tool times out on this WebGL canvas — verify by playing, and have Сергей confirm feel.)

- [ ] **Step 2: Confirm the behaviors**

- Pull straight up and hold until speed bleeds out → the plane must STALL and fall (it must NOT hover nose-up). STALL warning blinks beforehand.
- High up: enter the spin, then firewall throttle + let the nose drop → it should recover before the bottom.
- Low down: enter the spin with no room → it falls to the bottom and the mission fails (existing failure dialogue).
- Normal dogfighting at cruise speed never triggers a spin.
- Touching the bottom in controlled flight still bounces (softFloor), only a *spin* is lethal at the floor.

- [ ] **Step 3: Tune if needed**

Adjust the Task 1 constants (`SPIN_STALL_SPEED`, `SPIN_ENTRY_DELAY`, `SPIN_SINK`, `SPIN_RECOVER_SPEED`) to taste based on play, then re-commit.

---

## Self-Review

**Spec coverage:**
- Entry (nose-high + near-zero speed, held for delay) → Task 4 Step 4. ✓
- No hover / always falls → Task 3 (`SPIN_SINK` constant downward) + tests. ✓
- Spin: autorotation + damped control → Task 3. ✓
- Recovery (throttle + nose-down → speed → flying) → Task 3 (speed build) + Task 4 (`SPIN_RECOVER_SPEED` exit). ✓
- Loss (spin into floor → death, softFloor doesn't rescue) → Task 4 Step 3. ✓
- Applies to all (player + enemy) → player path + enemy-loop branch (Task 4 Step 5). ✓
- Campaign-only (softFloor gate); arcade unchanged → Task 4 + test. ✓
- Determinism (no Math.random) → all spin code is arithmetic. ✓
- Feedback: warning (visual + existing shudder) → Task 5; spin tumble = automatic heading rotation. Audio deferred (no audio system) — flagged. 

**Placeholder scan:** none — every code step is complete. The one conditional ("if the test file lacks `makeFlyingState`, add a local helper following the file's existing construction") is a real instruction tied to the file's current contents, not a placeholder.

**Type consistency:** `stepPlaneSpin(PlaneKinematic, PhysicsInput, number, number): PlaneKinematic` matches `stepPlane`'s shape and the call in Task 4. `stallTimer?: number` (Task 2) is read/written in Task 4. `'spinning'` added to `PlaneState` (Task 2) and used in Tasks 4 & 5. Constants names are identical across Tasks 1, 3, 4, 5.

**Known follow-ups (out of scope, noted for Сергей):** audio buzzer for the stall warning; optionally disable player firing while spinning; optionally extend the spin to arcade mode.
