import { describe, expect, it } from 'vitest';
import { resolveMissionOneFrameGate } from './mission-one-frame-gate.js';

describe('mission one frame gate', () => {
  it('opens the upgrade choice instead of silently pausing when a level-up is pending', () => {
    expect(resolveMissionOneFrameGate({
      choicesShowing: false,
      pendingLevelUp: true,
    })).toBe('open-upgrade');
  });

  it('pauses while an upgrade choice is already visible', () => {
    expect(resolveMissionOneFrameGate({
      choicesShowing: true,
      pendingLevelUp: true,
    })).toBe('pause');
  });

  it('continues ticking when no overlay blocks the mission', () => {
    expect(resolveMissionOneFrameGate({
      choicesShowing: false,
      pendingLevelUp: false,
    })).toBe('tick');
  });
});
