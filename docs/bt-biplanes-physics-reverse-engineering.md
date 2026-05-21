# BT Biplanes — Reverse-Engineered Flight Physics

Source: `vendor/bt-biplanes-reference/` (decompiled J2ME jar).
Frame rate target: **20 FPS** on 128×128 screens (`b.x = 50` ms sleep in `b.run()`), **40 FPS** on larger screens (`b.x = 25` ms). Treat the canonical tick as **50 ms (20 Hz)** — that's what the physics constants were tuned against.

> Key insight up-front: there is **no separate gravity vector**. The plane is a **scalar-speed + heading** model. "Gravity" is implemented in two complementary places:
> 1. **Pitch bleeds/feeds the scalar speed** every tick (climbing reduces `g`, diving increases it). This is the energy-management loop.
> 2. **A low-speed "fall" injection** drops the plane downward (adds to y position, not velocity) whenever `g < 230`. This is the stall.
>
> The plane physically *cannot* fly backwards relative to its nose, and the angle changes only in 22.5° steps (16-frame sprite). Thrust is also pitch-dependent — pointing straight up gives **zero thrust**.

---

## Source files of interest

| File | Role |
|---|---|
| `e.java` | **Player/plane class.** Holds all per-plane state. Contains the per-tick physics method `a(Graphics, boolean)`, rotate `b(int)`, throttle-up `c()`, throttle-down `d()`, fire `a()`, eject `b()`, AI `e()`, and the static `az[]` angle lookup. |
| `f.java` | Bullet class. Uses the same `sin*speed >> 7` motion idiom — confirms the projection convention. |
| `b.java` | Main class. Holds the sin lookup table `dl[]` (line 178), the trig helpers `f()`/`g()`/`h()` (lines 2170–2211), the atan2-ish helper `b(int,int,int,int)` (line 2213) used only by AI, the angle-diff helper `b(int,int)` (line 2242), random `c(int)` (line 2041), and the main game loop `run()` (line 621) with frame pacing constant `x` (50 ms or 25 ms). |
| `d.java`, `g.java`, `c.java`, `h.java`, `i.java` | Rendering / UI / font / audio / input — no physics. |

---

## State variables (per plane, all `int`, in `e.java`)

| Field | Purpose | Units / range |
|---|---|---|
| `a` | Mode: `0` = taking off (rolling on the ground), `1` = flying, `2` = exploding, `3` = dead/respawn timer. | enum |
| `bb` | World x position, **fixed-point: pixels << 6** (i.e. 1 px = 64). | 0 .. 255·64 = 16320 |
| `c` | World y position, same fixed-point. | 0 .. 208·64 |
| `d`, `e` | Screen x, y. Always `bb >> 6`, `c >> 6`. | px |
| `f` | Sprite frame **and** heading index. 0..15. Drives `h` via `az[]`. | 0..15 |
| `g` | **Scalar speed** (the only "velocity" the plane has). | 0..250 normal, 0..350 in a dive. Unit: position fixed-point per tick — i.e. `g` directly increments `bb`/`c` after a `sin*g >> 7` projection. |
| `h` | **Heading in degrees**, 0..359. Compass-style: **0° = nose-up, 90° = nose-right, 180° = nose-down, 270° = nose-left.** Always one of the 16 quantised values from `az[]`. | deg |
| `i` | Orientation: `2` = plane facing left, `3` = plane facing right. Picks which half of `az[]` to read. | enum |
| `j` | Turn cooldown (ticks until next allowed rotation). Set to `2` after manual turn, `5` after auto-righting while ejected. | ticks |
| `k` | Fire cooldown. | ticks |
| `as` | "Throttle held" flag — when true, `c()` is auto-called every tick. | bool |
| `v` | Pilot/eject state machine: 0=in plane, 1=ejected falling, 2=parachute, 3=dead, 4=on ground walking, 5=picked up. | enum |
| `w,x,y,z` | Ejected pilot pos/vel (separate physics). | px<<6 / px-per-tick |
| `az[32]` | Static angle lookup. `az[0..15]` for facing-left, `az[16..31]` for facing-right. | deg |

---

## Per-tick physics algorithm (mode `a == 1` = flying)

This is the heart of the model. Pseudocode, in order, exactly as in `e.java` lines 388–573:

```
// 0. If "throttle" key is held, apply thrust BEFORE the move (line 391: if (this.as) c())
if (as) {
    if (g <= 250) {
        g += abs(sin(h)) * 8 >> 7        // pitch-dependent thrust
        if (g > 250) g = 250
    }
}

// 1. Translate by velocity = (sin(h), -cos(h)) * g.
//    Note: sin/cos here are scaled by 128, so `>> 7` divides by 128.
//    Note: y is screen-y (down is positive), so cos>0 (climbing) SUBTRACTS from y.
bb +=  sin(h) * g >> 7                   // x += sin(h) * g / 128
i2  =  cos(h) * g >> 7
c   -= i2                                // y -= cos(h) * g / 128

// 2. PITCH BLEEDS/FEEDS SPEED  ("gravity" expressed on scalar speed):
i1 = 0
if (2 <= f <= 6) {                       // nose-up sprites (climbing)
    g -= cos(h) >> 5                     // cos(h) is positive here -> g decreases
    if (g < 0) g = 0
}
else if (10 <= f <= 14) {                // nose-down sprites (diving)
    g -= cos(h) >> 5                     // cos(h) is negative here -> g INCREASES
    if (g > 350) g = 350                 // dive lets you exceed normal max (250 -> 350)
}

// 3. STALL DROP — if speed is below 230, force the plane downward in screen-space.
//    This is the closest thing to gravity. It is applied to POSITION, not velocity.
if (g < 230) {
    i1 = 250 * (230 - g) / 230
    c += i1                              // pull the plane down (in fixed-point units)
}

// 4. If the "stall drop" was bigger than the climb component, kill the throttle flag.
if (i1 > i2) as = false                  // auto-release throttle visual

// 5. Decrement cooldowns
if (j > 0) j--
if (k > 0) k--

// 6. Recompute screen-space
d = bb >> 6
e = c >> 6

// 7. Ground collision -> explode (mode 2)
if (a < 2 && (e > 182 || (e > 164 && 104 < d < 150))) {
    f()    // explosion, mode = 2, etc.
}

// 8. World wrap on X (256-wide world), clamp top (e<0), wrap-or-die bottom.
if (d < 0)        { d = 255; bb = d << 6 }
else if (d > 255) { d = 0;   bb = d << 6 }
if (e < 0) {                             // hit ceiling
    e = 0; c = 0
    g -= 10                              // ceiling penalty (bleed speed)
}
```

### Key magnitudes (per tick, for f=8 → h=90°, full horizontal flight at max speed)

- `sin(90°)` table value = `128`. So `bb += 128 * 250 >> 7 = 250` fixed-point = **3.9 px / tick = ~78 px/s @ 20 Hz**.
- Pitch-bleed rate (climbing at h=0°, cos=128): `g -= 128 >> 5 = 4 per tick = 80/s`. At 80/s you go from 250 → 0 in about 3 seconds of pure straight-up climbing.
- Pitch-feed rate (diving at h=180°, cos=-128): `g += 4 per tick`, capped at 350 (so a steep dive saturates from 250 in ~25 ticks = 1.25 s).
- Stall drop at `g=0`: `c += 250` fixed-point = ~3.9 px / tick = ~78 px/s **downward** in addition to whatever the velocity says.

---

## Constants (with translation to modern units)

Assume target: 60 FPS, world 4000 px wide, screen ~2160×3840 portrait or 1920×1080 landscape. The original world is **256 px wide**, screen 128 px tall (visible 0..182 px). So scale factor to a 4000-px world is **×15.625** in space. The tick rate scale factor is **20 Hz → 60 Hz = ÷3** (apply per-tick deltas 3× per second more often).

Conversion rule of thumb:
- **Speed-like values** (per tick): `modern = raw * SPACE_SCALE / DT_SCALE` where SPACE_SCALE = 15.625 and DT_SCALE = 3 (when porting a per-tick delta to per-frame at 60 FPS), OR `modern_per_sec = raw * 20 * SPACE_SCALE` (when expressing as units/sec).
- **Position-like values** (the `<< 6` fixed point): drop the fixed-point — just use floats and `pixels = raw / 64`.
- **Accelerations** (per tick²): `modern_per_sec² = raw * 400 * SPACE_SCALE`.

| Original symbol / expression | Raw value | Modern equivalent (4000-px world, units/sec) | Unit | Notes |
|---|---|---|---|---|
| Frame interval `b.x` | 50 ms (or 25) | dt = 1/60 s | — | Use 20 Hz as canonical tuning. |
| `sin/cos` table scale | × 128 | — | — | `h()` returns sin(deg)·128. Hence `>> 7` everywhere = divide by 128. |
| Position fixed-point | `<< 6` | — | px (after shift) | World coords stored ×64. |
| World width | 256 (after `>> 6`) | 4000 px (your scale) | px | Wraps modulo. |
| World vertical play | y ∈ [0, 182] | [0, 2850] @ 4000-wide scale | px | y>182 = ground/explode. |
| Max speed (level) | `g_max = 250` | ~**1220 px/sec** horizontal (= 250·15.625·20/64) | px/sec | When h=90°, this is the cruise top speed. |
| Max speed (diving) | `g_dive_max = 350` | ~**1710 px/sec** | px/sec | Only reachable in steep dive. |
| Thrust gain per tick | `+= |sin(h)|·8 >> 7` (max 8 at h=90°) | ~**+1200 px/sec² horizontal thrust** at h=90° | (speed-units)/sec² | Pitch-modulated: zero thrust when pointing straight up/down. |
| Pitch bleed/feed per tick | `g -= cos(h) >> 5` (max ±4 at vertical) | ~**±600 (speed-units)/sec²** | (speed-units)/sec² | This IS the gravity. Climbing bleeds, diving feeds. |
| Stall threshold | 230 | (~92% of max speed) | dimensionless | Below this, plane sinks. |
| Stall sink rate at g=0 | `c += 250` fixed-point | ~**78 px/sec downward** at 128-wide scale, ~**1220 px/sec** at 4000-wide scale | px/sec | Linear ramp: `sink = 250·(230-g)/230 / 64 px·20/sec`. |
| Throttle-off decel | `g -= 8` per tick | ~**160 (speed-units)/sec²** | — | Only when `d()` (brake) is actively pressed. |
| Ceiling penalty | `g -= 10` on hit | one-shot | — | Hitting top of world (e<0) bleeds 10 speed. |
| Turn rate | `j = 2` after each step | one frame-step per 2 ticks = **5 steps/sec @ 20 Hz** = 5·22.5° = **112°/sec** | deg/sec | At 60 Hz, that's still 112°/sec — port as a "min 100 ms between rotation inputs". |
| Heading discretisation | `az[]` has 16 unique angles | 22.5° increments | deg | See next section. |
| Sin lookup `dl[]` | 90 entries, 0..128 | — | scaled int | `dl[i] = round(sin(i°)·128)`. |
| Bullet speed | 10 per tick | `10·15.625·20/64 = ~49 px/sec` at 128-scale, **~3050 px/sec** at 4000-scale | px/sec | Bullet has TTL 20 ticks = 1 second. |

---

## Angle table `az[32]`

```
az[0..15]  (orientation i==2, "facing left"):
  index: 0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
  deg : 270  292  315  337   0   22   45   67   90  112  135  157  180  202  225  247

az[16..31] (orientation i==3, "facing right"): mirror of the above
  index: 16   17   18   19   20   21   22   23   24   25   26   27   28   29   30   31
  deg :  90   67   45   22   0   337  315  292  270  247  225  202  180  157  135  112
```

Heading convention: **0° = nose straight up, 90° = nose right, 180° = nose down, 270° = nose left.**

So for both orientations, `f = 4` = "nose up", `f = 12` = "nose down". `f = 0` is "nose horizontal forward" (left if i=2, right if i=3 — wait: i=2 gives az[0]=270=left, i=3 gives az[16+0-no actually az[16]=90 not az[20]…). The orientation switch is performed implicitly: when you change facing direction, `f` advances through the table and the "forward" frame is `f=0` in i=2 and `f=4`? Actually re-checking: at line 174, when `paramInt4 == 2`, `h = 270` (left), at line 176 `h = 90` (right). And at line 263, when the plane reaches `g > 125` and `f == 1` during takeoff (mode 0), `f = 0` is set. So `f=0` is the "horizontal forward" frame for both orientations — for i=2 it's az[0]=270 (left), for i=3 it's az[16]=90 (right). Pitch climbs through f=1..4 (forward, then upward) and dives through f=15..12.

---

## Stall / lift behaviour

There are **three stall-related mechanisms**, in priority order:

1. **Pitch-induced speed drain** (line 412–416). If sprite frame `f ∈ {2..6}` (any nose-above-horizontal heading), every tick `g` loses `cos(h) >> 5` (0..4 per tick). Hold the nose at vertical (h=0°, cos=128) and you bleed 4 speed/tick = 80/sec; at 22° pitch you bleed ~2.3/tick. This is the only thing that brings climbing to a halt.

2. **Below-stall-speed sink** (line 422–425). The instant `g < 230`, `c += 250 * (230 - g) / 230` fixed-point units per tick. This **adds to position directly, not velocity** — it is not affected by heading. It increases linearly as `g` drops, hitting full force at `g = 0` (≈3.9 px/tick downward, equivalent to ~78 px/s in the original 128-wide world).

3. **No upper-AoA stall** — there is no "angle exceeds critical AoA → instant lift loss" check. The plane simply keeps losing energy until it falls. You can hold the nose vertical and the plane will slow to 0 and then sink straight down (the stall-drop applies regardless of heading).

When the plane is ejected or dead (`v != 0`), the body auto-rights itself to nose-horizontal in `a(Graphics, boolean)` lines 533–547 (rotates `f` toward 0 or 8).

---

## Turning model

Discrete, rate-limited, frame-by-frame:

- Pressing left or right calls `e.b(int paramInt)` (paramInt = 2 for left, 3 for right) in `e.java` line 198.
- If `j > 0` (cooldown) → input ignored.
- Otherwise: increment/decrement `f` by **1 step** (= 22.5°), wrap 0↔15, then set `j = 2` (cooldown = 2 ticks = 100 ms at 20 Hz).
- The direction "left key turns clockwise or counterclockwise?" depends on `i` (facing): when facing left (i=2), pressing left (paramInt=2) decrements `f`; when facing right (i=3), pressing left increments `f`. The result is that **left/right inputs always rotate the nose toward up first**, regardless of facing.
- There is no continuous angular velocity — heading is a discrete index into `az[]`.

Effective turn rate: **1 step / 2 ticks = 10 steps/sec = 225°/sec** maximum (if you mash). In practice players see ~112°/sec because input polling is also per-tick.

---

## Re-implementation recipe (for TypeScript port)

```ts
// === constants ===
const TICK_HZ = 20;                        // canonical sim rate; run at 60 and substep, or scale dt
const G_MAX_LEVEL = 250;
const G_MAX_DIVE  = 350;
const G_STALL     = 230;
const TURN_COOLDOWN_TICKS = 2;
const FIRE_COOLDOWN_TICKS = 10;
const HEADINGS_LEFT  = [270, 292, 315, 337,   0,  22,  45,  67,  90, 112, 135, 157, 180, 202, 225, 247];
const HEADINGS_RIGHT = [ 90,  67,  45,  22,   0, 337, 315, 292, 270, 247, 225, 202, 180, 157, 135, 112];
// Heading convention: 0 = nose up, 90 = nose right, 180 = nose down, 270 = nose left.

// sin & cos with the SAME scaling as the original (×128), so the math reads 1:1.
// Or use Math.sin / Math.cos directly and drop the >>7 shifts — see below.
const sinDeg = (deg: number) => Math.sin(deg * Math.PI / 180);
const cosDeg = (deg: number) => Math.cos(deg * Math.PI / 180);

interface Plane {
  x: number;       // world px (float; drop the <<6 fixed-point)
  y: number;       // world px, screen-down positive
  g: number;       // scalar speed (0..350)
  f: number;       // sprite/heading index 0..15
  facing: 2 | 3;   // 2 = left, 3 = right
  turnCd: number;  // ticks until next rotation allowed
  throttle: boolean;
}

function heading(p: Plane): number {
  return (p.facing === 2 ? HEADINGS_LEFT : HEADINGS_RIGHT)[p.f];
}

function rotate(p: Plane, dir: -1 | 1) {
  if (p.turnCd > 0) return;
  // "left key always tips nose toward up" semantics:
  const step = (p.facing === 2 ? -dir : dir);
  p.f = (p.f + step + 16) % 16;
  p.turnCd = TURN_COOLDOWN_TICKS;
}

function tick(p: Plane, dt_ticks: number) {
  // 1. Auto-thrust while throttle held: thrust is pitch-modulated.
  if (p.throttle && p.g <= G_MAX_LEVEL) {
    const h = heading(p);
    p.g += Math.abs(sinDeg(h)) * 8 * dt_ticks;       // was: abs(sin)*8 >> 7
    if (p.g > G_MAX_LEVEL) p.g = G_MAX_LEVEL;
  }

  // 2. Translate by (sin(h), -cos(h)) * g.
  const h = heading(p);
  p.x += sinDeg(h) * p.g * dt_ticks;
  const climbComponent = cosDeg(h) * p.g * dt_ticks;  // positive when climbing
  p.y -= climbComponent;

  // 3. Pitch bleeds/feeds scalar speed (the "gravity"):
  //    Original: if f in 2..6  -> g -= cos(h) >> 5
  //              if f in 10..14 -> g -= cos(h) >> 5   (cos is negative => g grows, cap 350)
  if (p.f >= 2 && p.f <= 6) {
    p.g -= (cosDeg(h) * 128 / 32) * dt_ticks;        // = cos(h) * 4 per tick
    if (p.g < 0) p.g = 0;
  } else if (p.f >= 10 && p.f <= 14) {
    p.g -= (cosDeg(h) * 128 / 32) * dt_ticks;        // cos<0 here -> p.g grows
    if (p.g > G_MAX_DIVE) p.g = G_MAX_DIVE;
  }

  // 4. STALL: if speed is below threshold, pull the plane DOWN in position (not velocity).
  //    This is what makes "slow + nose-up" mean "you start falling".
  if (p.g < G_STALL) {
    const sink = 250 * (G_STALL - p.g) / G_STALL;    // fixed-point units, raw
    p.y += (sink / 64) * dt_ticks;                   // convert <<6 fixed-point to px
  }

  // 5. Cooldowns
  if (p.turnCd > 0) p.turnCd -= dt_ticks;

  // 6. World wrap (X) and ceiling/floor handling
  const W = 256; // or your scaled-up world width
  if (p.x < 0) p.x += W;
  if (p.x >= W) p.x -= W;
  if (p.y < 0) { p.y = 0; p.g -= 10 * dt_ticks; }    // ceiling penalty
  // p.y > GROUND_Y => crash/explode (mode change)
}
```

### Critical do's and don'ts

- **DO NOT** add a 2D gravity vector. Gravity in this game is two things: (a) pitch-bleed on scalar speed, (b) low-speed position-drop. Adding `vy += g*dt` on top will break the energy-management feel.
- **DO** keep heading discrete (or at least keep the 16-step `cos(h)`/`sin(h)` discretisation if you want exact feel). The 22.5° steps are part of the game's signature.
- **DO** keep thrust pitch-modulated. The fact that you get *zero* thrust pointing straight up is what forces players to "dive and pull up", which is the whole point of the dogfight.
- **DO** keep dive max (350) > level max (250). Building speed by diving and then trading it for altitude is the energy loop.
- **DO** make the stall floor (230) high relative to max (250). Most of the time the plane is right on the edge of stall — that's why the controls feel "twitchy".

### Suggested per-second values to use directly (target 60 FPS, 4000-px world)

If you'd rather skip the per-tick translation and just plug into a normal physics integrator:

```ts
const HORIZ_SPEED_MAX  = 1220;   // px/sec at h=90°, g=250
const DIVE_SPEED_MAX   = 1710;   // px/sec at g=350
const STALL_SPEED      = 1120;   // px/sec (g=230)
const THRUST_ACCEL_MAX = 2500;   // px/sec² at horizontal flight  (original ≈ 8/tick · ×scale ≈ 1200 (speed-units)/s² ≈ 1200·15.625/64 px/s²)
const PITCH_BLEED_MAX  = 1250;   // px/sec² speed bleed at vertical climb
const STALL_SINK_MAX   = 1220;   // px/sec downward when g=0
const TURN_RATE        = 112;    // deg/sec (every 100ms you can rotate one 22.5° step)
const GROUND_Y         = 2850;   // px (proportional to original 182/208 ratio)
```

Tune these from there. The bleed/stall numbers in particular are not load-bearing in their exact magnitude — the *ratios* (stall threshold = 92% of max, dive cap = 140% of max, thrust = 0 at vertical) are what produce the gameplay feel.

---

## Open questions

1. **Tick rate ambiguity.** The original sleeps 50 ms on 128-wide screens and 25 ms on wider ones, but the physics constants are the same. Either the game runs at half speed on big phones or the dev didn't care. I've assumed the **20 Hz tuning is canonical** — that's what the playtesters of the J2ME version felt. If the 25 ms branch was the "real" tuning, all per-second numbers above are 2× too small.
2. **Frame `f=0..1` and `f=7..9` and `f=15`.** These are exactly horizontal (`f=0`, `f=8`) or in transitional bands `{0, 1, 7, 8, 9, 15}` that get **no** pitch-bleed treatment. So flying exactly horizontal neither gains nor loses speed from gravity — only stall-sink applies if `g<230`. This is correct in the source but worth flagging since you might want to smooth it out in a modern port.
3. **What pins horizontal cruise speed at exactly `g=250`?** Throttle thrust caps it (line 279). If you hold throttle level you fly at 250 forever. If you release throttle, the brake (`d()`) decays by `-=8/tick` only when actively pressed — there's no aero drag otherwise. So a glider in level flight at `g=250` would just keep going. The original is a J2ME arcade game — don't expect realistic aero.
4. **Atan2 helper `dm[][]`.** Used only by AI for "point at enemy" reasoning. I didn't extract this table — it doesn't affect player physics. Look in `b.java` if you need it for AI port.
5. **Ground hit-box.** The non-rectangular "tower" region `e > 164 && 104 < d < 150` is hard-coded for the 128-wide world. You'll need to express this proportionally for a 4000-wide world.
6. **No roll / no yaw.** This is strictly 2D side-view. The "orientation" `i` is a one-bit "facing left/right" sprite mirror, not a roll. If the player wants to switch facing direction mid-flight, the game forces them through the full 16-frame rotation arc.
