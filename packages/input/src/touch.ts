import type { PlayerCommand } from '@biplanes/shared';

type RoundZone = { x: number; y: number; r: number };
type TouchPoint = { x: number; y: number };

/** Vertical throttle lever. Drag up = more gas. Value persists when released. */
export type SliderZone = { x: number; yTop: number; yBottom: number; w: number };

const JOYSTICK_DEADZONE_RATIO = 0.055;
/** Absolute floor (px) so the deadzone doesn't collapse below thumb tremor on tiny phones,
 *  where r*0.055 would be ~2.5px and invite phantom turns at the instant tristate rate. */
const MIN_DEADZONE_PX = 3;
/** A mostly-vertical stick push reads as pitch when |dy| > |dx| * this. Exported as the single
 *  source of truth so the classic and screen-relative steering modes can never silently diverge. */
export const JOYSTICK_VERTICAL_BIAS = 0.92;
const DEFAULT_THROTTLE = 0.85;

/** Deadzone radius in px for a given stick radius (ratio of the radius, floored to a minimum). */
export function joystickDeadzonePx(radius: number): number {
  return Math.max(MIN_DEADZONE_PX, radius * JOYSTICK_DEADZONE_RATIO);
}

export interface TouchZones {
  joystick: RoundZone;
  fire: RoundZone;
  special: RoundZone;
  boost: RoundZone;
  eject: RoundZone;
  throttle: SliderZone;
}

export interface TouchController {
  current(): PlayerCommand;
  destroy(): void;
  // expose for render to draw the buttons
  zones: TouchZones;
  /** True while a thumb is actively driving the floating stick. */
  joystickActive(): boolean;
  /** Dynamic centre of the floating stick (where the thumb landed). */
  joystickOrigin(): TouchPoint;
  joystickKnob(): TouchPoint;
  /** Raw stick offset from origin + deadzone, for screen-relative steering. null = idle. */
  joystickVector(): { dx: number; dy: number; deadzone: number } | null;
  /** 0..1 lever position, for the on-screen knob. */
  throttleValue(): number;
  /** When true, current() reports throttleTarget (touch device using the lever). */
  setThrottleEngaged(engaged: boolean): void;
  /** Snap the lever (and reported throttle) back to zero — e.g. at a round start. */
  resetThrottle(): void;
  updateZones(viewportW: number, viewportH: number): void;
}

export interface CreateTouchControllerOptions {
  /**
   * Input freshness path (#1 fix). true (default) = Pointer Events with getCoalescedEvents,
   * pointer capture, a cached canvas rect and per-frame sampling, so the position the sim
   * reads each tick is always the freshest finger position. false = the legacy touch-event
   * path (kept for A/B rollback via ?input=legacy). Either way the steering MAPPING and the
   * instant full-rate turn are identical.
   */
  pointer?: boolean;
}

export function resolveTouchZones(w: number, h: number): TouchZones {
  const base = Math.min(w, h);
  const landscape = w > h;
  const stickR = Math.max(62, Math.min(102, base * 0.158));
  const buttonR = Math.max(31, Math.min(50, base * 0.082));
  const marginX = Math.max(22, base * 0.055, landscape ? Math.min(76, w * 0.075) : 0);
  const safeBottom = landscape ? Math.min(78, h * 0.15) : Math.max(22, base * 0.1);

  const fireR = buttonR * 1.18;
  // Keep the big fire button fully above the bottom safe inset.
  const lowerY = h - Math.max(safeBottom + fireR, base * 0.13);

  // Vertical throttle lever hugs the right edge.
  const sliderW = buttonR * 0.92;
  const sliderX = w - marginX - sliderW * 0.5;
  const sliderTop = Math.max(h * 0.14, base * 0.12);
  const sliderBottom = lowerY + fireR * 0.2;

  // Action buttons form a 2x2 grid left of the throttle lever (two per row,
  // stacked). Fire sits bottom-inner, nearest the thumb. The top row is nudged
  // right by 20% of the column gap for a slight staggered feel.
  const fireX = sliderX - sliderW * 0.5 - buttonR * 1.25 - fireR;
  const colGapX = fireR + buttonR + Math.max(12, buttonR * 0.34);
  const rowGapY = fireR + buttonR + Math.max(12, buttonR * 0.3);
  const leftColX = fireX - colGapX;
  const upperY = lowerY - rowGapY;
  const topRowShift = colGapX * 0.2;

  return {
    joystick: {
      x: marginX + stickR,
      y: h - Math.max(stickR + 18, base * 0.18),
      r: stickR,
    },
    fire: { x: fireX, y: lowerY, r: fireR },
    boost: { x: leftColX, y: lowerY, r: buttonR },
    special: { x: fireX + topRowShift, y: upperY, r: buttonR },
    eject: { x: leftColX + topRowShift, y: upperY, r: buttonR * 0.9 },
    throttle: { x: sliderX, yTop: sliderTop, yBottom: sliderBottom, w: sliderW },
  };
}

export function resolveJoystickRotate(
  joystick: RoundZone,
  point: TouchPoint | null,
): -1 | 0 | 1 {
  if (!point || joystick.r <= 0) return 0;
  const dx = point.x - joystick.x;
  const dy = point.y - joystick.y;
  const deadzone = joystickDeadzonePx(joystick.r);
  if (Math.hypot(dx, dy) < deadzone) return 0;

  // A mostly-vertical push is read as pitch (up = -1 / CCW, down = +1 / CW); otherwise the
  // horizontal push decides the turn. The bias (<1) makes the vertical band a touch wider than
  // 45°, since thumbs push up/down more cleanly than dead-sideways. Output is tristate, so any
  // deflection past the deadzone = an INSTANT full-rate turn (no proportional softness).
  if (Math.abs(dy) > Math.abs(dx) * JOYSTICK_VERTICAL_BIAS) {
    return dy < 0 ? -1 : 1;
  }
  if (dx < -deadzone) return -1;
  if (dx > deadzone) return 1;
  return 0;
}

export function resolveJoystickKnob(
  joystick: RoundZone,
  point: TouchPoint | null,
): TouchPoint {
  if (!point || joystick.r <= 0) return { x: joystick.x, y: joystick.y };
  const dx = point.x - joystick.x;
  const dy = point.y - joystick.y;
  const distance = Math.hypot(dx, dy);
  const maxDistance = joystick.r * 0.72;
  if (distance <= maxDistance || distance === 0) return point;
  const scale = maxDistance / distance;
  return { x: joystick.x + dx * scale, y: joystick.y + dy * scale };
}

/** Map a touch Y inside the lever to a 0..1 throttle value (top = full gas). */
export function resolveThrottleValue(slider: SliderZone, y: number): number {
  const span = slider.yBottom - slider.yTop;
  if (span <= 0) return DEFAULT_THROTTLE;
  return Math.max(0, Math.min(1, (slider.yBottom - y) / span));
}

// === Pure classification ============================================================
// A single function maps the set of active pointers (whether they arrived via Pointer or
// Touch events) to the control state. Keeping it pure makes the claim/release/button logic
// unit-testable without a DOM, and lets the fresh + legacy paths share identical behaviour.

export interface PointerSample {
  id: number;
  /** canvas-local pixels */
  x: number;
  y: number;
}

export interface StickState {
  joystickId: number | null;
  joystickOrigin: TouchPoint | null;
  joystickPoint: TouchPoint | null;
  fire: boolean;
  special: boolean;
  boost: boolean;
  eject: boolean;
  throttleValue: number;
  throttleEngaged: boolean;
}

export function createStickState(): StickState {
  return {
    joystickId: null,
    joystickOrigin: null,
    joystickPoint: null,
    fire: false,
    special: false,
    boost: false,
    eject: false,
    throttleValue: DEFAULT_THROTTLE,
    throttleEngaged: false,
  };
}

export interface ClassifyContext {
  zones: TouchZones;
  viewW: number;
}

function inZone(px: number, py: number, z: RoundZone) {
  const dx = px - z.x;
  const dy = py - z.y;
  return dx * dx + dy * dy <= z.r * z.r;
}

function inThrottle(px: number, py: number, s: SliderZone) {
  // Generous hit band around the lever so it's easy to grab with a thumb.
  const halfW = s.w * 1.1;
  const pad = s.w * 0.5;
  return Math.abs(px - s.x) <= halfW && py >= s.yTop - pad && py <= s.yBottom + pad;
}

function onAnyButton(px: number, py: number, zones: TouchZones) {
  return inZone(px, py, zones.fire) || inZone(px, py, zones.special)
    || inZone(px, py, zones.boost) || inZone(px, py, zones.eject) || inThrottle(px, py, zones.throttle);
}

function inStickRegion(px: number, py: number, zones: TouchZones, viewW: number) {
  // The whole left side (minus the right-hand controls) is the stick's pad — the thumb can
  // land anywhere there and that becomes the floating centre.
  return px < viewW * 0.5 && !onAnyButton(px, py, zones);
}

/**
 * Derive the new control state from the active pointers. Pure: does not mutate `prev`.
 * - The joystick pointer is tracked by id; it is released when its pointer disappears.
 * - Remaining pointers light up buttons / drive the lever.
 * - A free pointer that lands in the stick region claims the floating joystick (origin =
 *   where it landed).
 */
export function classifyPointerState(
  prev: StickState,
  pointers: readonly PointerSample[],
  ctx: ClassifyContext,
): StickState {
  const { zones, viewW } = ctx;
  const next = createStickState();
  next.throttleValue = prev.throttleValue;
  next.throttleEngaged = prev.throttleEngaged;
  next.joystickId = prev.joystickId;
  next.joystickOrigin = prev.joystickOrigin;
  next.joystickPoint = prev.joystickPoint;

  // 1) Is the active stick pointer still down? Update its position or release it.
  if (next.joystickId !== null) {
    const held = pointers.find((p) => p.id === next.joystickId);
    if (held) {
      next.joystickPoint = { x: held.x, y: held.y };
    } else {
      next.joystickId = null;
      next.joystickOrigin = null;
      next.joystickPoint = null;
    }
  }

  // 2) Process the rest: light buttons / drive lever, or claim a new stick pointer.
  for (const p of pointers) {
    if (p.id === next.joystickId) continue;
    if (inZone(p.x, p.y, zones.fire)) next.fire = true;
    if (inZone(p.x, p.y, zones.special)) next.special = true;
    if (inZone(p.x, p.y, zones.boost)) next.boost = true;
    if (inZone(p.x, p.y, zones.eject)) next.eject = true;
    if (inThrottle(p.x, p.y, zones.throttle)) {
      next.throttleValue = resolveThrottleValue(zones.throttle, p.y);
      next.throttleEngaged = true;
    } else if (next.joystickId === null && inStickRegion(p.x, p.y, zones, viewW)) {
      next.joystickId = p.id;
      next.joystickOrigin = { x: p.x, y: p.y };
      next.joystickPoint = { x: p.x, y: p.y };
    }
  }

  return next;
}

export function createTouchController(
  canvas: HTMLElement,
  options: CreateTouchControllerOptions = {},
): TouchController {
  const usePointer = options.pointer !== false;
  let state = createStickState();
  // Active pointers, canvas-local. Updated cheaply by the event handlers; classification
  // happens per-frame in sample() so the sim always reads the freshest finger position.
  const pointers = new Map<number, TouchPoint>();
  let zones: TouchZones = resolveTouchZones(0, 0);
  let viewW = 0;
  let viewH = 0;
  // Cached canvas offset — refreshed on resize/scroll/gesture-start instead of on every
  // move event, so a heavy frame's move handler never forces a synchronous layout.
  let rectLeft = 0;
  let rectTop = 0;

  // Make sure the browser never steals the gesture for scroll/zoom/selection on the canvas
  // itself (touch-action is not inherited, so the body's `none` is not enough).
  try {
    const s = canvas.style as CSSStyleDeclaration & { webkitUserSelect?: string; webkitTouchCallout?: string };
    s.touchAction = 'none';
    s.userSelect = 'none';
    s.webkitUserSelect = 'none';
    s.webkitTouchCallout = 'none';
  } catch {
    /* non-DOM environment — ignore */
  }

  function refreshRect() {
    const r = canvas.getBoundingClientRect();
    rectLeft = r.left;
    rectTop = r.top;
  }

  // Virtual stick radius — small travel for a snappy, responsive feel.
  function stickRadius() {
    return Math.max(46, Math.min(86, Math.min(viewW, viewH) * 0.14));
  }

  function updateZones(w: number, h: number) {
    viewW = w;
    viewH = h;
    Object.assign(zones, resolveTouchZones(w, h));
    refreshRect();
  }

  function sample() {
    state = classifyPointerState(state, [...pointers.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })), {
      zones,
      viewW,
    });
  }

  function stickZone(): RoundZone {
    const o = state.joystickOrigin ?? { x: zones.joystick.x, y: zones.joystick.y };
    return { x: o.x, y: o.y, r: stickRadius() };
  }

  // === Event wiring ================================================================
  const cleanups: Array<() => void> = [];

  if (usePointer) {
    const localOf = (e: { clientX: number; clientY: number }): TouchPoint => ({
      x: e.clientX - rectLeft,
      y: e.clientY - rectTop,
    });

    // Only finger/stylus drives the on-screen controls. Mouse is IGNORED so a desktop
    // (PC/Steam, or the dev browser) keeps keyboard-only play — without this a left-drag in
    // the canvas's left half would claim the (hidden) stick and steer, and preventDefault
    // would swallow canvas clicks. Touch HUD shows only on touch devices anyway.
    const isStickPointer = (e: PointerEvent) => e.pointerType !== 'mouse';

    const onPointerDown = (e: PointerEvent) => {
      if (!isStickPointer(e)) return;
      // Refresh the rect once per gesture start (cheap, infrequent) so the offset is exact
      // even if layout shifted (iOS address-bar collapse, rotation).
      refreshRect();
      e.preventDefault();
      pointers.set(e.pointerId, localOf(e));
      // Capture so we keep getting moves even if the thumb drifts off the canvas — this is
      // the classic "stuck stick when the finger leaves the element" fix.
      try { (canvas as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      sample();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isStickPointer(e) || !pointers.has(e.pointerId)) return;
      // Use the most recent coalesced sample — the browser may bundle several moves into one
      // event on a heavy frame; the last coalesced one is the freshest finger position.
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      const fresh = coalesced && coalesced.length > 0 ? coalesced[coalesced.length - 1]! : e;
      pointers.set(e.pointerId, localOf(fresh));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isStickPointer(e)) return;
      pointers.delete(e.pointerId);
      try { (canvas as Element).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      sample();
    };

    canvas.addEventListener('pointerdown', onPointerDown as EventListener, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove as EventListener, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp as EventListener, { passive: true });
    canvas.addEventListener('pointercancel', onPointerUp as EventListener, { passive: true });
    cleanups.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown as EventListener);
      canvas.removeEventListener('pointermove', onPointerMove as EventListener);
      canvas.removeEventListener('pointerup', onPointerUp as EventListener);
      canvas.removeEventListener('pointercancel', onPointerUp as EventListener);
    });

    // Keep the cached rect fresh against scroll/resize/orientation shifts.
    const onLayoutShift = () => refreshRect();
    window.addEventListener('resize', onLayoutShift, { passive: true });
    window.addEventListener('scroll', onLayoutShift, { passive: true });
    window.addEventListener('orientationchange', onLayoutShift, { passive: true });
    window.visualViewport?.addEventListener('resize', onLayoutShift);
    window.visualViewport?.addEventListener('scroll', onLayoutShift);
    cleanups.push(() => {
      window.removeEventListener('resize', onLayoutShift);
      window.removeEventListener('scroll', onLayoutShift);
      window.removeEventListener('orientationchange', onLayoutShift);
      window.visualViewport?.removeEventListener('resize', onLayoutShift);
      window.visualViewport?.removeEventListener('scroll', onLayoutShift);
    });
  } else {
    // Legacy touch-event path (rollback via ?input=legacy). Classifies on each event using a
    // freshly-read rect — i.e. the original behaviour, kept verbatim for A/B comparison.
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      refreshRect();
      pointers.clear();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]!;
        pointers.set(t.identifier, { x: t.clientX - rectLeft, y: t.clientY - rectTop });
      }
      sample();
    };
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouch, { passive: false });
    canvas.addEventListener('touchcancel', onTouch, { passive: false });
    cleanups.push(() => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouch);
      canvas.removeEventListener('touchcancel', onTouch);
    });
  }

  return {
    current(): PlayerCommand {
      // Per-frame freshness: re-classify from the latest pointer positions on the pointer
      // path (the legacy path already classified on its last DOM event).
      if (usePointer) sample();
      const rotate = state.joystickOrigin
        ? resolveJoystickRotate(stickZone(), state.joystickPoint)
        : 0;
      return {
        rotate,
        fire: state.fire,
        bomb: false,
        special: state.special,
        throttleDelta: 0,
        throttleTarget: state.throttleEngaged ? state.throttleValue : null,
        eject: state.eject,
        jump: false,
        boost: state.boost,
      };
    },
    destroy() {
      for (const fn of cleanups) fn();
      pointers.clear();
    },
    get zones() { return zones; },
    joystickActive() { return state.joystickOrigin !== null; },
    joystickOrigin() {
      return state.joystickOrigin ?? { x: zones.joystick.x, y: zones.joystick.y };
    },
    joystickKnob() {
      return resolveJoystickKnob(stickZone(), state.joystickPoint);
    },
    joystickVector() {
      if (!state.joystickOrigin || !state.joystickPoint) return null;
      const z = stickZone();
      return {
        dx: state.joystickPoint.x - z.x,
        dy: state.joystickPoint.y - z.y,
        deadzone: joystickDeadzonePx(z.r),
      };
    },
    throttleValue() { return state.throttleValue; },
    setThrottleEngaged(engaged: boolean) { state.throttleEngaged = engaged; },
    resetThrottle() { state.throttleValue = 0; },
    updateZones,
  };
}
