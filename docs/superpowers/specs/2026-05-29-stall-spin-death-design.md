# Stall → Spin → Death — design spec

- **Version:** 0.1
- **Date:** 2026-05-29
- **Status:** Drafted, pending owner review
- **Owner:** Сергей (product) — non-technical; this spec is the source of truth, chat stays product-level.

## Motivation

The campaign removed lethal ground contact: in story mode the bottom of the map now
turns the plane back like the ceiling (`softFloor`). That left the campaign with no
skill-based failure state for bad piloting. This feature reintroduces danger the *right*
way — as a consequence of the signature stall flight model, not random ground contact.

The fantasy (owner's words): cut throttle at the wrong moment, fail to keep airspeed,
and the plane departs into a spin. With altitude you can recover; spin all the way to
the bottom and you lose.

**Observed today (pre-implementation):** with the bounce-off-bottom in place and no spin
yet, a plane can hang nose-up at zero throttle — neither flying away, nor falling, nor
dying (see owner screenshot). This "floating" state is exactly what the feature removes.
A thrustless plane at low speed must **stall and fall**, never hover. Losing energy at the
apex of a maneuver (low point of thrust, low speed) begins the fall down the screen, and
reaching the bottom while stalled is death.

## Scope

- **In scope:** A new `spinning` plane state in the headless core, its entry/exit rules,
  reduced control during the spin, the loss condition, render feedback (warning + spin
  visual), and wiring so it activates in the campaign.
- **Active when:** `softFloor` is enabled (campaign). In arcade mode the existing ground
  crash remains the failure state and the spin mechanic does not apply (out of scope for
  now; the design leaves room to extend later).
- **Applies to:** all flying planes (player and enemies), symmetrically. Enemy AI already
  avoids stalls, so enemy spins are rare emergent moments, not a balance lever.
- **Out of scope:** new upgrades that interact with spin, multiplayer, arcade-mode spin,
  tutorialization beyond the on-screen warning.

## Player-facing rules

### Entry (departure into spin)

A plane departs into a spin only when **all** of these hold continuously for a short
window (`SPIN_ENTRY_DELAY`):

1. **Nose high** — the nose is meaningfully above the horizon (climbing).
2. **Airspeed near zero** — speed has dropped below a deep-stall threshold
   (`SPIN_STALL_SPEED`), far below normal cruise. Normal stall-edge cruising and any
   dive/level flight never trigger it.

Holding both for the window (not an instant) prevents a momentary dip from triggering a
spin. Just before entry the plane gives a **stall warning** (see Feedback).

### The spin

- The plane drops its nose and autorotates, **losing altitude — it always falls, never
  hovers.** A stalled, thrustless plane cannot hang in the air; gravity wins and it sinks
  down the screen.
- **Control is vague:** rotate input is heavily damped (small corrective authority only);
  the player cannot simply "steer" out of the rotation.
- Speed builds from the nose-down attitude (the dive feeds airspeed).

### Recovery

- **Full throttle + let the nose drop** builds airspeed. Once speed climbs back above the
  recovery threshold (`SPIN_RECOVER_SPEED`), the plane "bites" the air and returns to
  normal controlled flight.
- The higher you were when you departed, the more room you have to recover. Recovery is a
  skill move tied to the exact input that caused the stall (throttle).

### Loss

- If the plane reaches the bottom of the map **while still spinning**, it crashes and dies
  → mission failure, reusing the existing failure flow (same end-state as losing the pilot
  today).
- The `softFloor` turn-back force applies **only in controlled flight**. During a spin it
  is disabled (you are not in control), so the bottom is lethal *only* while spinning.

## Feedback (render)

- **Warning (pre-spin):** when the plane is close to the departure condition (nose high +
  speed approaching the deep-stall threshold), show a blinking `STALL` indicator, fuselage
  shudder (the existing body-shake), and a warning tone. This makes the loss readable and
  reactable, never a surprise death.
- **Spin:** the plane visibly autorotates (reuse/extend the existing death-spin visual)
  and trails smoke; camera stays readable (no extra shake beyond the existing low-HP/feel
  effects).
- **Recovery:** warning clears the moment controlled flight returns.

## Technical approach (decided)

- Add a new `spinning` state to the plane state machine in `packages/core`, alongside
  `flying` / `taxi` / `dying` / `crashed`. The state owns its own per-tick physics
  (autorotation, gravity-fed fall, damped control, speed build, exit check). This keeps it
  deterministic (seeded, replayable — no `Math.random` in the spin), unit-testable, and
  isolated from normal flight.
- Entry is evaluated from `flying`; exit returns to `flying`; reaching the floor while
  `spinning` transitions to the existing death path.
- Gated by the existing `softFloor` flag on world state, so arcade behavior is untouched.
- Render reads the `spinning` state for the warning + spin visual; no sim logic in render.

## Proposed tuning (all tunable; start values)

| Knob | Meaning | Start value |
|---|---|---|
| `SPIN_STALL_SPEED` | speed below which (with nose high) a spin can start | ~200 px/s (cruise ≈ 570, G_STALL = 620) |
| `SPIN_NOSE_UP` | how nose-high counts as "climbing" for entry | sin(heading) < −0.35 |
| `SPIN_ENTRY_DELAY` | how long both conditions must hold before departure | 0.4 s |
| `SPIN_ROTATE_RATE` | autorotation speed during the spin | ~4 rad/s |
| `SPIN_CONTROL_AUTHORITY` | fraction of normal rotate input that still applies | ~0.2 |
| `SPIN_RECOVER_SPEED` | speed at/above which the plane exits the spin | ~500 px/s |
| `STALL_WARN_SPEED` | speed (nose-high) at which the warning starts | ~SPIN_STALL_SPEED × 1.6 |

These calibrate so normal flight (including stall-edge cruise ~570) never trips it; you
have to genuinely kill your energy nose-high.

## Testing

- **Entry:** nose-high + speed below threshold for ≥ delay → enters `spinning`; the same
  but for less than the delay, or nose level/down, or speed above threshold → stays
  `flying`.
- **No false trigger:** normal cruise (g ≈ 570) and dives never enter `spinning`.
- **Recovery:** in `spinning`, applying full throttle and dropping the nose builds speed
  and returns to `flying` once above `SPIN_RECOVER_SPEED`; high-altitude entry recovers,
  low-altitude entry reaches the floor first.
- **Loss:** `spinning` reaching `GROUND_Y` → death/failure path; `softFloor` does not
  rescue a spinning plane.
- **Determinism:** identical inputs reproduce identical spin/recovery (no `Math.random`).
- **Arcade unaffected:** with `softFloor` off, no plane enters `spinning`; ground crash
  unchanged.

## Open questions / future

- Extend spin to arcade mode (replace or coexist with ground crash)?
- Upgrades that ease recovery or warn earlier (e.g., a "stall horn" perk)?
