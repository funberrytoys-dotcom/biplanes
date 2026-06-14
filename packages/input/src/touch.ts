import type { PlayerCommand } from '@biplanes/shared';

type RoundZone = { x: number; y: number; r: number };
type TouchPoint = { x: number; y: number };

const JOYSTICK_DEADZONE_RATIO = 0.055;
const JOYSTICK_CAPTURE_RATIO = 1.92;

export interface TouchZones {
  joystick: RoundZone;
  fire: RoundZone;
  special: RoundZone;
  eject: RoundZone;
  throttleUp: RoundZone;
  throttleDown: RoundZone;
}

export interface TouchController {
  current(): PlayerCommand;
  destroy(): void;
  // expose for render to draw the buttons
  zones: TouchZones;
  joystickKnob(): TouchPoint;
  updateZones(viewportW: number, viewportH: number): void;
}

export function resolveTouchZones(w: number, h: number): TouchZones {
  const base = Math.min(w, h);
  const landscape = w > h;
  const stickR = Math.max(62, Math.min(102, base * 0.158));
  const buttonR = Math.max(31, Math.min(52, base * 0.084));
  const marginX = Math.max(22, base * 0.055, landscape ? Math.min(76, w * 0.075) : 0);
  const bottomGuard = Math.max(22 + buttonR, base * 0.115, landscape ? Math.min(80, h * 0.155) : 0);
  const lowerY = h - bottomGuard;
  const midY = lowerY - buttonR * 2.3;
  const upperY = midY - buttonR * 2.3;
  const farRightX = w - marginX - buttonR;
  const innerRightX = farRightX - buttonR * 2.38;

  return {
    joystick: {
      x: marginX + stickR,
      y: h - Math.max(stickR + 18, base * 0.18),
      r: stickR,
    },
    fire: { x: farRightX, y: lowerY, r: buttonR * 1.16 },
    special: { x: innerRightX, y: lowerY, r: buttonR },
    eject: { x: innerRightX, y: upperY, r: buttonR * 0.92 },
    throttleUp: { x: farRightX, y: upperY, r: buttonR * 0.94 },
    throttleDown: { x: farRightX, y: midY, r: buttonR * 0.94 },
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

export function createTouchController(canvas: HTMLElement): TouchController {
  const state = {
    joystickPoint: null as TouchPoint | null,
    fire: false,
    special: false,
    eject: false,
    throttleUp: false,
    throttleDown: false,
  };
  let zones: TouchZones = {
    joystick: { x: 0, y: 0, r: 0 },
    fire: { x: 0, y: 0, r: 0 },
    special: { x: 0, y: 0, r: 0 },
    eject: { x: 0, y: 0, r: 0 },
    throttleUp: { x: 0, y: 0, r: 0 },
    throttleDown: { x: 0, y: 0, r: 0 },
  };

  function updateZones(w: number, h: number) {
    Object.assign(zones, resolveTouchZones(w, h));
  }

  function inZone(px: number, py: number, z: RoundZone) {
    const dx = px - z.x; const dy = py - z.y;
    return dx * dx + dy * dy <= z.r * z.r;
  }

  function inJoystickCapture(px: number, py: number) {
    return inZone(px, py, {
      ...zones.joystick,
      r: zones.joystick.r * JOYSTICK_CAPTURE_RATIO,
    });
  }

  function handleTouches(touches: TouchList) {
    state.joystickPoint = null;
    state.fire = state.special = state.eject = state.throttleUp = state.throttleDown = false;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (inJoystickCapture(x, y)) state.joystickPoint = { x, y };
      if (inZone(x, y, zones.fire)) state.fire = true;
      if (inZone(x, y, zones.special)) state.special = true;
      if (inZone(x, y, zones.eject)) state.eject = true;
      if (inZone(x, y, zones.throttleUp)) state.throttleUp = true;
      if (inZone(x, y, zones.throttleDown)) state.throttleDown = true;
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
      const rotate = resolveJoystickRotate(zones.joystick, state.joystickPoint);
      let throttleDelta: -1 | 0 | 1 = 0;
      if (state.throttleUp && !state.throttleDown) throttleDelta = 1;
      else if (state.throttleDown && !state.throttleUp) throttleDelta = -1;
      return {
        rotate,
        fire: state.fire,
        bomb: false,
        throttleDelta,
        eject: state.eject,
        jump: false,
        boost: state.special,
      };
    },
    destroy() {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouch);
      canvas.removeEventListener('touchcancel', onTouch);
    },
    get zones() { return zones; },
    joystickKnob() {
      return resolveJoystickKnob(zones.joystick, state.joystickPoint);
    },
    updateZones,
  };
}
