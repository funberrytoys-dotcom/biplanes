import { describe, expect, it } from 'vitest';
import { resolveJoystickRotate, resolveTouchZones } from './touch.js';

describe('touch control layout', () => {
  it('keeps the flight stick alone on the left and combat buttons on the right', () => {
    const zones = resolveTouchZones(932, 430);
    const leftHalf = 932 / 2;

    expect(zones.joystick.x).toBeLessThan(leftHalf);
    expect(zones.fire.x).toBeGreaterThan(leftHalf);
    expect(zones.special.x).toBeGreaterThan(leftHalf);
    expect(zones.eject.x).toBeGreaterThan(leftHalf);
    expect(zones.throttleUp.x).toBeGreaterThan(leftHalf);
    expect(zones.throttleDown.x).toBeGreaterThan(leftHalf);
  });

  it('stacks throttle up above throttle down near the right edge', () => {
    const zones = resolveTouchZones(932, 430);

    expect(zones.throttleUp.x).toBeGreaterThan(zones.special.x);
    expect(zones.throttleDown.x).toBe(zones.throttleUp.x);
    expect(zones.throttleUp.y).toBeLessThan(zones.throttleDown.y);
    expect(zones.throttleDown.y).toBeLessThan(zones.fire.y);
  });

  it('does not overlap right-side buttons on a short mobile viewport', () => {
    const zones = resolveTouchZones(910, 332);
    const rightButtons = [zones.fire, zones.special, zones.eject, zones.throttleUp, zones.throttleDown];

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

  it('turns only when the stick leaves its deadzone', () => {
    const { joystick } = resolveTouchZones(932, 430);

    expect(resolveJoystickRotate(joystick, null)).toBe(0);
    expect(resolveJoystickRotate(joystick, { x: joystick.x, y: joystick.y })).toBe(0);
    expect(resolveJoystickRotate(joystick, { x: joystick.x - joystick.r * 0.55, y: joystick.y })).toBe(-1);
    expect(resolveJoystickRotate(joystick, { x: joystick.x + joystick.r * 0.55, y: joystick.y })).toBe(1);
  });
});
