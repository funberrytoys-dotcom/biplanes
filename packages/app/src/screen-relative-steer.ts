// Opt-in "screen-relative" steering (behind ?steer=screen — default OFF).
//
// THE PROBLEM it solves: the steer command is heading-relative, so when the plane
// faces LEFT, pushing the stick UP tips the nose DOWN on screen. Newcomers get
// disoriented. Screen-relative makes "stick up = nose toward the top of the screen"
// regardless of which way the plane faces.
//
// THE TRAP it avoids: you CANNOT just recompute the turn sign from the current facing
// every frame. During a loop the facing flips halfway through, which would flip the
// turn sign and REVERSE the loop — killing the one thing that makes the dogfight work.
//
// THE FIX: latch. The screen-vertical direction is sampled at the RISING EDGE of a
// vertical stick push (using the facing AT THAT MOMENT) and then HELD for as long as
// the player keeps pushing that way — so a held "up" keeps turning the same direction
// and completes the loop, exactly like classic. Releasing (or switching axis) re-arms
// the latch so the next push is re-evaluated against the then-current facing.
//
// Output stays a tristate {-1,0,1} → the physics turn is STILL instant, full-rate.
// This is input-layer only; the recorded PlayerCommand is the resulting tristate, so
// replay/determinism is untouched.

// Single source of truth shared with classic steering (resolveJoystickRotate), so the two modes
// can never silently disagree on "which axis wins".
import { JOYSTICK_VERTICAL_BIAS as VERTICAL_BIAS } from '@biplanes/input';
/**
 * Hysteresis for LEAVING an engaged vertical latch: while a vertical turn is held, the stick
 * must go CLEARLY sideways (dx dominates dy by this margin) before we switch to a horizontal
 * turn. This absorbs a small sideways thumb wobble during a held loop, which would otherwise
 * momentarily re-arm the latch and reverse the loop after the facing flips.
 */
const HORIZONTAL_BREAK_BIAS = 1.3;

export interface ScreenSteerState {
  /** Latched screen-vertical direction: -1 = toward top, +1 = toward bottom, 0 = none. */
  vDir: -1 | 0 | 1;
  /** The heading-relative rotate latched for that vertical direction. */
  rotate: -1 | 0 | 1;
}

export const INITIAL_SCREEN_STEER_STATE: ScreenSteerState = { vDir: 0, rotate: 0 };

export interface ScreenSteerInput {
  /** Stick offset from its origin, screen pixels (x right, y down). */
  dx: number;
  dy: number;
  /** Deadzone radius in pixels. */
  deadzone: number;
  /** Plane facing: 1 = right, -1 = left. */
  facing: 1 | -1;
}

export interface ScreenSteerResult {
  rotate: -1 | 0 | 1;
  state: ScreenSteerState;
}

/**
 * Resolve one frame of screen-relative steering. Pure: feed it the previous latch
 * state and it returns the rotate to apply + the next latch state.
 */
export function stepScreenRelativeSteer(
  prev: ScreenSteerState,
  input: ScreenSteerInput,
): ScreenSteerResult {
  const { dx, dy, deadzone, facing } = input;

  // Inside the deadzone → no turn, re-arm the latch.
  if (Math.hypot(dx, dy) < deadzone) {
    return { rotate: 0, state: INITIAL_SCREEN_STEER_STATE };
  }

  // toward top  → facing right: rotate -1 (CCW) ; facing left: rotate +1 ; toward bottom: opposite.
  const rotateForVertical = (vDir: -1 | 1): -1 | 1 =>
    vDir === -1 ? ((-facing) as -1 | 1) : (facing as -1 | 1);

  // A vertical latch is already engaged → HOLD it through a sideways wobble so a held loop
  // never reverses. Only a CLEARLY horizontal push breaks out to a left/right turn; a genuine
  // up<->down reversal re-latches against the current facing.
  if (prev.vDir !== 0) {
    const clearlyHorizontal = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BREAK_BIAS;
    if (!clearlyHorizontal) {
      const vDir: -1 | 1 = dy < 0 ? -1 : 1;
      if (vDir === prev.vDir) return { rotate: prev.rotate, state: prev };
      const rotate = rotateForVertical(vDir);
      return { rotate, state: { vDir, rotate } };
    }
    const rotate: -1 | 1 = dx < 0 ? -1 : 1;
    return { rotate, state: INITIAL_SCREEN_STEER_STATE };
  }

  // No latch yet (fresh deflection) → pick the axis the usual way.
  const verticalDominant = Math.abs(dy) > Math.abs(dx) * VERTICAL_BIAS;
  if (verticalDominant) {
    const vDir: -1 | 1 = dy < 0 ? -1 : 1; // -1 = toward top of screen, +1 = toward bottom
    const rotate = rotateForVertical(vDir);
    return { rotate, state: { vDir, rotate } };
  }

  // Horizontal-dominant push → classic left/right turn (a held horizontal turn loops fine).
  const rotate: -1 | 1 = dx < 0 ? -1 : 1;
  return { rotate, state: INITIAL_SCREEN_STEER_STATE };
}
