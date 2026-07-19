# Codex task — Make the biplane controls intuitive & responsive (WITHOUT softening the dogfight)

You are working in the **Biplanes** repo (TypeScript / PixiJS / Vite, pnpm workspaces): a 2D
side-view biplane **dogfight** game (Vampire-Survivors-style build loop), mobile-first, played
on phones **through the browser**. The core is a **deterministic 60 Hz simulation** (replayable
from `seed + commands`) with a thin Pixi renderer.

## Goal
Make the flight controls **more responsive and more intuitive on a mobile browser**, WITHOUT
changing what makes the dogfight work: **sharp, instant maneuvering — tight loops and getting on
the enemy's tail.**

## HARD CONSTRAINTS — read first (these encode failures already hit)
1. **DO NOT make steering analog / proportional / "smooth".** This was tried and it RUINED the
   game — turns became sluggish, you couldn't complete a loop or chase a tail. Steering must keep
   **instant maximum turn-rate**: deflect past the deadzone → the plane turns at FULL rate
   immediately, no ramp, no softness. The current tristate `rotate ∈ {-1,0,1}`
   (`heading += rotate * PLANE_TURN_RATE * dt`) delivers that and is CORRECT. Keep instant turning.
2. **DO NOT change the flight/stall model.** Stall + energy management (climb bleeds speed →
   stall → sink; dive regains speed) is the SOUL of the game (from the original BT Biplanes).
   `packages/core/src/physics/plane-physics.ts` `stepPlane` — leave its physics behaviour intact.
3. **DO NOT change takeoff.** Each round/run starts on the runway with throttle at 0; the player
   gives gas to take off (`resetThrottle()` on round start). Intentional — keep it.
4. **Preserve determinism.** The sim replays from (seed, commands). Input is a `PlayerCommand`.
   Don't add non-deterministic state to the replay-critical core; don't break determinism/replay tests.
5. **Never freeze the renderer.** Do NOT add a `BlurFilter` on a masked sprite (it froze Pixi on
   mobile GPUs). No unbounded per-frame loops. `dt` is clamped ≤ 0.2 — keep that.
6. **Everything behind a rollback toggle.** Any control change must be switchable via a URL param
   (e.g. `?controls=classic`) AND localStorage, defaulting so it can be reverted instantly — for
   A/B testing on a real phone with no redeploy.
7. **Do NOT deploy.** Work on a branch, keep tests green, leave it for the owner to test on his
   phone. Auto-deploy fires on push to `feat/hud-animated-panel` — do NOT push there.

## The REAL problems to fix (from a 16-agent design council + code review)
Prioritise **#1** — it's the owner's actual complaint ("the stick is sometimes unresponsive,
maybe because it runs in a browser") and it does NOT touch the turn feel.

### 1. (TOP PRIORITY) Browser touch input is laggy / "sticks"
- `packages/input/src/touch.ts` reads touches ONLY inside `touchstart`/`touchmove`/`touchend`
  and stores the last position. On a heavy frame the browser coalesces/delays `touchmove`, so the
  stick freezes at its last reported spot until the next event — this is the felt "unresponsiveness".
- Fix direction: use **Pointer Events** (`pointerdown/move/up`, plus `getCoalescedEvents()` where
  available) and/or **sample the latest known pointer position every frame** in the game loop, not
  only on DOM events. Ensure `touch-action: none` on the canvas and `preventDefault` so the browser
  never scrolls/steals the gesture; check for passive-listener pitfalls. Goal: the stick position the
  sim reads each tick is always the freshest finger position.
- This must NOT change the steering mapping or the instant turn — only make the input fresher.

### 2. Steering intuitiveness (CAREFUL — keep instant full-rate)
- `resolveJoystickRotate` collapses a 2D stick to tristate with a confusing rule (a vertical push
  also maps to a left/right turn via the `|dy| > |dx|*0.92` branch), and it is **heading-relative**,
  so when the plane FACES LEFT the screen sense inverts ("push up" tips the nose DOWN). Newcomers
  get disoriented.
- You MAY make the mapping clearer (e.g. cleaner pitch intent, optionally screen-relative so "up =
  nose toward the top of the screen" regardless of facing) — **ONLY if it keeps instant full-rate
  turning** (deflection past the deadzone = full turn rate, no proportional softness).
- Screen-relative / inversion-removal changes muscle memory → put it behind the toggle; default to
  current behaviour, make the intuitive variant opt-in (or default for first-time players only).
- It is perfectly acceptable to conclude "keep tristate, just clean it up." **Snappiness > cleverness.**

### 3. Throttle (ГАЗ) legibility
- The lever is just a bar. Make it a readable gauge with colour zones (holds altitude / careful /
  too low = stalling). Do NOT change throttle behaviour — only readability.

### 4. Onboarding
- Tutorial hints exist (`packages/app/src/mobile-touch-guide.ts`, `first-sortie-guidance.ts`) but
  are wired only for Campaign. Enable brief first-time hints in **Arena and Забег** (with a "seen"
  flag so veterans aren't nagged): give gas to fly, pull the nose to turn, dive to regain speed,
  don't stall.

### 5. Feedback
- The on-screen stick renders as a smooth analog knob but the output is a switch — make the render
  honest. Show a stall warning BEFORE the stall (while speed is dropping), not after. Optional: a
  short haptic buzz on stall on mobile.

## Key files
- `packages/input/src/touch.ts` — touch controller (floating stick, throttle lever, buttons). The
  input-freshness fix lives mostly here + in main.ts.
- `packages/input/src/keyboard.ts` — keyboard mapping.
- `packages/app/src/main.ts` — `currentCommand()` merges keyboard+touch into a `PlayerCommand`
  each frame (search `currentCommand`, `createTouchController`, canvas event listeners). Per-frame
  sampling + canvas listener changes are wired here.
- `packages/shared/src/types.ts` — `PlayerCommand` (`rotate` is the steer command; keep instant-turn
  semantics — if you must widen the type, full-rate turning must remain reachable instantly).
- `packages/core/src/physics/plane-physics.ts` — flight model (DO NOT change behaviour).
- `packages/app/src/mobile-touch-guide.ts`, screens, HUD render — onboarding + throttle/stall feedback.

## Current mechanics (so you needn't rediscover)
- Steer: `PlayerCommand.rotate ∈ {-1,0,1}` → `heading += rotate * PLANE_TURN_RATE * dt` = instant
  full-rate turn. KEEP this snappiness.
- `rotate` is heading-relative (CCW/CW); flying left inverts the screen-vertical sense (the
  intuitiveness issue; optional toggle only).
- Throttle: a vertical lever sets target speed = `G_MAX_LEVEL * throttleLevel`; engine accelerates
  toward it (max thrust at horizontal). Round starts at throttle 0 (runway takeoff — keep).
- Energy/stall: climbing bleeds speed; below `G_STALL` the plane stalls and sinks. Soul — keep.
- AI emits the same `PlayerCommand` (symmetric); AI rotate is heading-relative, keep it full ±1.

## Success criteria
- On a real mobile browser the stick feels **immediately responsive** (no "stuck finger") AND
  turning is **just as sharp** as before — tight loops and tail-chasing still work. Explicitly
  verify the turn did NOT get softer.
- Controls are more legible: throttle gauge, early stall warning, first-time hints in Arena/Забег.
- `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build` all pass; determinism/replay + freeze-hunt
  tests stay green; add tests for any new input logic.
- Every behavioural change is behind a rollback toggle (URL + localStorage), defaults safely,
  nothing is deployed.

## Process
- Create a feature branch (e.g. `feat/controls-responsive`) + a backup tag. Do NOT push to
  `feat/hud-animated-panel`.
- Investigate first; implement the input-freshness fix (#1) BEFORE any mapping change. Keep changes
  small and toggle-guarded.
- Leave a short note of what changed and how to toggle, so the owner can test on a phone.
