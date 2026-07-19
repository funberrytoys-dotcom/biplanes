import { describe, expect, it } from 'vitest';
import {
  classifyPointerState,
  createStickState,
  resolveJoystickKnob,
  resolveJoystickRotate,
  resolveThrottleValue,
  resolveTouchZones,
  type PointerSample,
} from './touch.js';

describe('touch control layout', () => {
  it('keeps the flight stick alone on the left and combat buttons on the right', () => {
    const zones = resolveTouchZones(932, 430);
    const leftHalf = 932 / 2;

    expect(zones.joystick.x).toBeLessThan(leftHalf);
    expect(zones.fire.x).toBeGreaterThan(leftHalf);
    expect(zones.special.x).toBeGreaterThan(leftHalf);
    expect(zones.boost.x).toBeGreaterThan(leftHalf);
    expect(zones.eject.x).toBeGreaterThan(leftHalf);
    expect(zones.throttle.x).toBeGreaterThan(leftHalf);
  });

  it('puts the throttle lever on the far right edge, right of the fire button', () => {
    const zones = resolveTouchZones(932, 430);

    expect(zones.throttle.x).toBeGreaterThan(zones.fire.x);
    expect(zones.throttle.yTop).toBeLessThan(zones.throttle.yBottom);
    // Lever spans a tall vertical range.
    expect(zones.throttle.yBottom - zones.throttle.yTop).toBeGreaterThan(120);
  });

  it('maps lever top to full gas and bottom to idle', () => {
    const { throttle } = resolveTouchZones(932, 430);
    expect(resolveThrottleValue(throttle, throttle.yTop)).toBeCloseTo(1, 2);
    expect(resolveThrottleValue(throttle, throttle.yBottom)).toBeCloseTo(0, 2);
    expect(resolveThrottleValue(throttle, (throttle.yTop + throttle.yBottom) / 2)).toBeCloseTo(0.5, 1);
  });

  it('does not overlap right-side buttons on a short mobile viewport', () => {
    const zones = resolveTouchZones(910, 332);
    const rightButtons = [zones.fire, zones.special, zones.boost, zones.eject];

    for (let i = 0; i < rightButtons.length; i++) {
      for (let j = i + 1; j < rightButtons.length; j++) {
        const a = rightButtons[i]!;
        const b = rightButtons[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('keeps iPhone 15 Pro Max landscape controls inside safe edges', () => {
    const zones = resolveTouchZones(932, 430);
    const landscapeSafeLeft = 59;
    const landscapeSafeRight = 59;
    const landscapeSafeBottom = 21;
    const rightButtons = [zones.fire, zones.special, zones.boost, zones.eject];

    expect(zones.joystick.x - zones.joystick.r).toBeGreaterThanOrEqual(landscapeSafeLeft);
    expect(zones.throttle.x + zones.throttle.w / 2).toBeLessThanOrEqual(932 - landscapeSafeRight);
    for (const zone of rightButtons) {
      expect(zone.x + zone.r).toBeLessThanOrEqual(932 - landscapeSafeRight);
      expect(zone.y + zone.r).toBeLessThanOrEqual(430 - landscapeSafeBottom);
    }
  });

  it('turns only when the stick leaves its deadzone', () => {
    const { joystick } = resolveTouchZones(932, 430);

    expect(resolveJoystickRotate(joystick, null)).toBe(0);
    expect(resolveJoystickRotate(joystick, { x: joystick.x, y: joystick.y })).toBe(0);
    expect(resolveJoystickRotate(joystick, { x: joystick.x - joystick.r * 0.04, y: joystick.y })).toBe(0);
    expect(resolveJoystickRotate(joystick, { x: joystick.x - joystick.r * 0.07, y: joystick.y })).toBe(-1);
    expect(resolveJoystickRotate(joystick, { x: joystick.x + joystick.r * 0.07, y: joystick.y })).toBe(1);
  });

  it('reads vertical stick pulls as flight-stick pitch', () => {
    const { joystick } = resolveTouchZones(932, 430);

    expect(resolveJoystickRotate(joystick, { x: joystick.x, y: joystick.y - joystick.r * 0.1 })).toBe(-1);
    expect(resolveJoystickRotate(joystick, { x: joystick.x, y: joystick.y + joystick.r * 0.1 })).toBe(1);
  });

  it('keeps the visual knob clamped inside the stick ring', () => {
    const { joystick } = resolveTouchZones(932, 430);
    const knob = resolveJoystickKnob(joystick, {
      x: joystick.x + joystick.r * 3,
      y: joystick.y,
    });

    expect(Math.hypot(knob.x - joystick.x, knob.y - joystick.y)).toBeLessThanOrEqual(joystick.r * 0.72);
  });
});

describe('pointer classification (input-freshness core)', () => {
  const W = 932;
  const H = 430;
  const zones = resolveTouchZones(W, H);
  const ctx = { zones, viewW: W };

  function classify(pointers: PointerSample[], prev = createStickState()) {
    return classifyPointerState(prev, pointers, ctx);
  }

  it('a thumb landing on the left pad claims the floating stick at that spot', () => {
    const s = classify([{ id: 1, x: 200, y: 300 }]);
    expect(s.joystickId).toBe(1);
    expect(s.joystickOrigin).toEqual({ x: 200, y: 300 });
    expect(s.joystickPoint).toEqual({ x: 200, y: 300 });
  });

  it('the claimed stick follows its pointer and the origin stays put', () => {
    const claimed = classify([{ id: 1, x: 200, y: 300 }]);
    const moved = classify([{ id: 1, x: 230, y: 260 }], claimed);
    expect(moved.joystickOrigin).toEqual({ x: 200, y: 300 }); // origin pinned to landing spot
    expect(moved.joystickPoint).toEqual({ x: 230, y: 260 }); // freshest finger position
  });

  it('releasing the stick pointer clears the floating stick', () => {
    const claimed = classify([{ id: 1, x: 200, y: 300 }]);
    const released = classify([], claimed);
    expect(released.joystickId).toBeNull();
    expect(released.joystickOrigin).toBeNull();
  });

  it('a second pointer on the fire button fires WITHOUT stealing the stick', () => {
    const claimed = classify([{ id: 1, x: 200, y: 300 }]);
    const s = classify([
      { id: 1, x: 230, y: 260 },
      { id: 2, x: zones.fire.x, y: zones.fire.y },
    ], claimed);
    expect(s.fire).toBe(true);
    expect(s.joystickId).toBe(1); // stick still owned by the first thumb
  });

  it('a pointer on the lever sets + engages the throttle, and the value persists on release', () => {
    const onLever = classify([{ id: 9, x: zones.throttle.x, y: zones.throttle.yTop }]);
    expect(onLever.throttleEngaged).toBe(true);
    expect(onLever.throttleValue).toBeCloseTo(1, 2);
    const released = classify([], onLever);
    expect(released.throttleValue).toBeCloseTo(1, 2); // lever holds its position
  });
});
