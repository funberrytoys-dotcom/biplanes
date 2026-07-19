import { describe, expect, it } from 'vitest';
import {
  INITIAL_SCREEN_STEER_STATE,
  stepScreenRelativeSteer,
  type ScreenSteerState,
} from './screen-relative-steer.js';

const DZ = 10;

function up(facing: 1 | -1, prev: ScreenSteerState = INITIAL_SCREEN_STEER_STATE) {
  return stepScreenRelativeSteer(prev, { dx: 0, dy: -40, deadzone: DZ, facing });
}
function down(facing: 1 | -1, prev: ScreenSteerState = INITIAL_SCREEN_STEER_STATE) {
  return stepScreenRelativeSteer(prev, { dx: 0, dy: 40, deadzone: DZ, facing });
}

describe('screen-relative steering', () => {
  it('does nothing inside the deadzone', () => {
    const r = stepScreenRelativeSteer(INITIAL_SCREEN_STEER_STATE, { dx: 2, dy: 3, deadzone: DZ, facing: 1 });
    expect(r.rotate).toBe(0);
  });

  it('stick up tips the nose toward the TOP of the screen when facing RIGHT', () => {
    // facing right: CCW (rotate -1) raises the nose.
    expect(up(1).rotate).toBe(-1);
  });

  it('stick up tips the nose toward the TOP of the screen when facing LEFT (inversion fixed)', () => {
    // facing left: classic would give -1 (nose DOWN). Screen-relative flips it to +1.
    expect(up(-1).rotate).toBe(1);
  });

  it('stick down tips the nose toward the BOTTOM regardless of facing', () => {
    expect(down(1).rotate).toBe(1);
    expect(down(-1).rotate).toBe(-1);
  });

  it('HOLDING up keeps the SAME turn even after the facing flips mid-loop (loop preserved)', () => {
    // Rising edge while facing right → latch rotate -1.
    const edge = up(1);
    expect(edge.rotate).toBe(-1);
    // As the loop carries the plane past vertical, facing flips to -1. A naive
    // recompute would flip rotate to +1 and reverse the loop. The latch must NOT.
    const midLoop = up(-1, edge.state);
    expect(midLoop.rotate).toBe(-1); // unchanged → loop continues
    const stillLooping = up(-1, midLoop.state);
    expect(stillLooping.rotate).toBe(-1);
  });

  it('absorbs a transient sideways wobble during a held loop (no reversal)', () => {
    const edge = up(1); // latch rotate -1 while facing right
    // Mid-loop the facing has flipped to -1 and the thumb wobbles sideways but is still
    // mostly pulling up. The latch must hold (a naive re-arm would reverse the loop).
    const wobble = stepScreenRelativeSteer(edge.state, { dx: 45, dy: -40, deadzone: DZ, facing: -1 });
    expect(wobble.rotate).toBe(-1);
    // A genuinely sideways push past the hysteresis margin DOES switch to a horizontal turn.
    const sideways = stepScreenRelativeSteer(edge.state, { dx: 80, dy: -10, deadzone: DZ, facing: -1 });
    expect(sideways.rotate).toBe(1); // dx > 0 → CW
    expect(sideways.state.vDir).toBe(0);
  });

  it('releasing to neutral re-arms the latch so the next push re-reads facing', () => {
    const held = up(1); // latched -1 while facing right
    const released = stepScreenRelativeSteer(held.state, { dx: 0, dy: 0, deadzone: DZ, facing: -1 });
    expect(released.rotate).toBe(0);
    expect(released.state).toEqual(INITIAL_SCREEN_STEER_STATE);
    // New push while now facing left → re-evaluated → +1 (nose toward top).
    const repush = up(-1, released.state);
    expect(repush.rotate).toBe(1);
  });

  it('switching from a vertical hold to a horizontal push turns left/right classically', () => {
    const held = up(1);
    const horiz = stepScreenRelativeSteer(held.state, { dx: -40, dy: 0, deadzone: DZ, facing: 1 });
    expect(horiz.rotate).toBe(-1); // left push → CCW
    // and the vertical latch is re-armed
    expect(horiz.state.vDir).toBe(0);
  });
});
