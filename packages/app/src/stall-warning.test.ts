import { describe, expect, it } from 'vitest';
import {
  resolveStallWarning,
  STALL_HARD_SPEED,
  STALL_WARN_SPEED,
} from './stall-warning.js';

describe('pre-stall warning', () => {
  it('is silent at healthy cruise speed', () => {
    expect(resolveStallWarning(680, 680)).toBe('none');
    expect(resolveStallWarning(600, 600)).toBe('none');
  });

  it('warns EARLY (amber) while speed is still dropping toward the stall', () => {
    expect(resolveStallWarning(STALL_WARN_SPEED - 10, STALL_WARN_SPEED + 5)).toBe('near');
  });

  it('does NOT nag once the player is recovering speed', () => {
    // Below the warn band but accelerating again (g > prevG) → stay quiet.
    expect(resolveStallWarning(STALL_WARN_SPEED - 10, STALL_WARN_SPEED - 40)).toBe('none');
  });

  it('shouts (red) once speed craters into a real sink', () => {
    expect(resolveStallWarning(STALL_HARD_SPEED - 1, STALL_HARD_SPEED + 50)).toBe('stall');
    expect(resolveStallWarning(200, 250)).toBe('stall');
  });
});
