import type { PlayerCommand } from '@biplanes/shared';

type RoundZone = { x: number; y: number; r: number };
type TouchPoint = { x: number; y: number };

/** Vertical throttle lever. Drag up = more gas. Value persists when released. */
export type SliderZone = { x: number; yTop: number; yBottom: number; w: number };

const JOYSTICK_DEADZONE_RATIO = 0.055;
const DEFAULT_THROTTLE = 0.85;

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
  /** 0..1 lever position, for the on-screen knob. */
  throttleValue(): number;
  /** When true, current() reports throttleTarget (touch device using the lever). */
  setThrottleEngaged(engaged: boolean): void;
  updateZones(viewportW: number, viewportH: number): void;
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
  const deadzone = joystick.r * JOYSTICK_DEADZONE_RATIO;
  if (Math.hypot(dx, dy) < deadzone) return 0;

  if (Math.abs(dy) > Math.abs(dx) * 0.92) {
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

export function createTouchController(canvas: HTMLElement): TouchController {
  const state = {
    // Floating joystick: the thumb's first touch on the left defines the centre.
    joystickId: null as number | null,
    joystickOrigin: null as TouchPoint | null,
    joystickPoint: null as TouchPoint | null,
    fire: false,
    special: false,
    boost: false,
    eject: false,
    throttleValue: DEFAULT_THROTTLE,
    throttleEngaged: false,
  };
  let zones: TouchZones = resolveTouchZones(0, 0);
  let viewW = 0;
  let viewH = 0;

  // Virtual stick radius — small travel for a snappy, responsive feel.
  function stickRadius() {
    return Math.max(46, Math.min(86, Math.min(viewW, viewH) * 0.14));
  }

  function updateZones(w: number, h: number) {
    viewW = w;
    viewH = h;
    Object.assign(zones, resolveTouchZones(w, h));
  }

  function inZone(px: number, py: number, z: RoundZone) {
    const dx = px - z.x; const dy = py - z.y;
    return dx * dx + dy * dy <= z.r * z.r;
  }

  // Generous hit band around the lever so it's easy to grab with a thumb.
  function inThrottle(px: number, py: number) {
    const s = zones.throttle;
    const halfW = s.w * 1.1;
    const pad = s.w * 0.5;
    return Math.abs(px - s.x) <= halfW && py >= s.yTop - pad && py <= s.yBottom + pad;
  }

  function onAnyButton(px: number, py: number) {
    return inZone(px, py, zones.fire) || inZone(px, py, zones.special)
      || inZone(px, py, zones.boost) || inZone(px, py, zones.eject) || inThrottle(px, py);
  }

  // The whole left side (minus the right-hand controls) is the stick's pad —
  // the thumb can land anywhere and that becomes the centre.
  function inStickRegion(px: number, py: number) {
    return px < viewW * 0.5 && !onAnyButton(px, py);
  }

  function handleTouches(touches: TouchList) {
    state.fire = state.special = state.boost = state.eject = false;
    const rect = canvas.getBoundingClientRect();

    // 1) Is the active stick-touch still down? Update or release it.
    let stickStillDown = false;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      if (t.identifier === state.joystickId) {
        stickStillDown = true;
        state.joystickPoint = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
    }
    if (state.joystickId !== null && !stickStillDown) {
      state.joystickId = null;
      state.joystickOrigin = null;
      state.joystickPoint = null;
    }

    // 2) Process the rest: claim a new stick touch or light up buttons.
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      if (t.identifier === state.joystickId) continue;
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (inZone(x, y, zones.fire)) state.fire = true;
      if (inZone(x, y, zones.special)) state.special = true;
      if (inZone(x, y, zones.boost)) state.boost = true;
      if (inZone(x, y, zones.eject)) state.eject = true;
      if (inThrottle(x, y)) {
        state.throttleValue = resolveThrottleValue(zones.throttle, y);
        state.throttleEngaged = true;
      } else if (state.joystickId === null && inStickRegion(x, y)) {
        state.joystickId = t.identifier;
        state.joystickOrigin = { x, y };
        state.joystickPoint = { x, y };
      }
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

  function stickZone(): RoundZone {
    const o = state.joystickOrigin ?? { x: zones.joystick.x, y: zones.joystick.y };
    return { x: o.x, y: o.y, r: stickRadius() };
  }

  return {
    current(): PlayerCommand {
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
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouch);
      canvas.removeEventListener('touchcancel', onTouch);
    },
    get zones() { return zones; },
    joystickActive() { return state.joystickOrigin !== null; },
    joystickOrigin() {
      return state.joystickOrigin ?? { x: zones.joystick.x, y: zones.joystick.y };
    },
    joystickKnob() {
      return resolveJoystickKnob(stickZone(), state.joystickPoint);
    },
    throttleValue() { return state.throttleValue; },
    setThrottleEngaged(engaged: boolean) { state.throttleEngaged = engaged; },
    updateZones,
  };
}
