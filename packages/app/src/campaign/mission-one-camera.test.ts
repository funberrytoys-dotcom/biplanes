import { describe, expect, it } from 'vitest';
import { getMissionOneEscortFocus } from './mission-one-camera.js';

describe('mission one escort camera', () => {
  it('keeps the player close to frame center when they fly far ahead of the caravan', () => {
    const focus = getMissionOneEscortFocus({
      playerX: 3600,
      playerY: 420,
      caravanX: 1700,
      caravanY: 350,
    });

    expect(focus.x).toBeGreaterThan(3350);
    expect(focus.x).toBeLessThan(3600);
  });

  it('still biases toward the caravan when the player is nearby', () => {
    const focus = getMissionOneEscortFocus({
      playerX: 2200,
      playerY: 430,
      caravanX: 2500,
      caravanY: 360,
    });

    expect(focus.x).toBeGreaterThan(2200);
    expect(focus.x).toBeLessThan(2500);
    expect(focus.zoom).toBeGreaterThan(1);
  });
});
