import { describe, expect, it } from 'vitest';
import { commandFromKeys } from './keyboard.js';

const cmd = (...codes: string[]) => commandFromKeys(new Set(codes));

describe('keyboard command mapping', () => {
  it('A rotates left, D rotates right (arrows alias)', () => {
    expect(cmd('KeyA').rotate).toBe(-1);
    expect(cmd('ArrowLeft').rotate).toBe(-1);
    expect(cmd('KeyD').rotate).toBe(1);
    expect(cmd('ArrowRight').rotate).toBe(1);
  });

  it('A+D held together cancel to no rotation', () => {
    expect(cmd('KeyA', 'KeyD').rotate).toBe(0);
  });

  it('W = throttle up, S = throttle down, both = hold', () => {
    expect(cmd('KeyW').throttleDelta).toBe(1);
    expect(cmd('KeyS').throttleDelta).toBe(-1);
    expect(cmd('KeyW', 'KeyS').throttleDelta).toBe(0);
  });

  it('Space drives both fire and jump; B drives bomb and special; Q is special', () => {
    const space = cmd('Space');
    expect(space.fire).toBe(true);
    expect(space.jump).toBe(true);
    const b = cmd('KeyB');
    expect(b.bomb).toBe(true);
    expect(b.special).toBe(true);
    expect(cmd('KeyQ').special).toBe(true);
    expect(cmd('ShiftLeft').boost).toBe(true);
    expect(cmd('KeyE').eject).toBe(true);
  });

  it('an empty key set (the post-blur state) is a fully neutral command', () => {
    const c = cmd();
    expect(c).toMatchObject({
      rotate: 0, throttleDelta: 0, fire: false, jump: false,
      bomb: false, special: false, boost: false, eject: false,
    });
  });
});
