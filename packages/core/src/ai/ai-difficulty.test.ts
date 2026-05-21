import { describe, it, expect } from 'vitest';
import { aiCommand, createAiState } from './chase-policy.js';
import { DIFFICULTIES } from './difficulty.js';
import type { Plane } from '../entities/plane.js';

function makePlane(x: number, y: number, heading: number, hp = 30): Plane {
  return {
    id: 1,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: 200, y: 0 },
      heading,
      throttleOn: true,
      g: 1200, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp,
    maxHp: 30,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

describe('ai difficulty params', () => {
  it('ground avoidance pulls AI up when below threshold (Easy)', () => {
    // Easy groundAvoidY = 600. Place enemy below that, heading sideways.
    // Target above so default aim would be slightly up — but ground override should
    // dominate and produce a strong upward (CCW = -1) rotation.
    const ai = createAiState(123);
    const easy = DIFFICULTIES.easy;
    // Enemy at y=800 — well past groundAvoidY (600), should panic upward.
    const enemy = makePlane(500, 800, 0);
    // Target also at y=800 directly ahead — without override, AI would NOT turn.
    const target = makePlane(700, 800, 0);
    const { cmd } = aiCommand(enemy, target, easy, ai, 30, 1 / 60, 1.0);
    // Must rotate up (CCW = -1) because of ground avoidance override
    expect(cmd.rotate).toBe(-1);
  });

  it('hard AI does NOT pull up at same altitude where Easy would (above its threshold)', () => {
    // Hard groundAvoidY = 850. At y=800 Hard is fine, target ahead means no turn.
    const ai = createAiState(123);
    const hard = DIFFICULTIES.hard;
    const enemy = makePlane(500, 800, 0);
    const target = makePlane(700, 800, 0);
    const { cmd } = aiCommand(enemy, target, hard, ai, 30, 1 / 60, 1.0);
    // Should NOT be -1 from ground avoidance — target is dead ahead.
    // With tiny wobble it might be 0 or 1, but should not be -1.
    expect(cmd.rotate).not.toBe(-1);
  });

  it('fire range respects difficulty — Easy fires only when close', () => {
    const ai = createAiState(99);
    const easy = DIFFICULTIES.easy;
    // Easy range = 350. Place target at 400 ahead.
    const enemy = makePlane(500, 500, 0);
    const farTarget = makePlane(900, 500, 0); // 400 away
    const { cmd: cmdFar } = aiCommand(enemy, farTarget, easy, ai, 30, 1 / 60, 1.0);
    expect(cmdFar.fire).toBe(false);

    // At 300 (within Easy range), should fire.
    const ai2 = createAiState(99);
    const nearTarget = makePlane(800, 500, 0); // 300 away
    const { cmd: cmdNear } = aiCommand(enemy, nearTarget, easy, ai2, 30, 1 / 60, 1.0);
    expect(cmdNear.fire).toBe(true);
  });

  it('fire range respects difficulty — Hard fires at long range', () => {
    const ai = createAiState(99);
    const hard = DIFFICULTIES.hard;
    // Hard range = 750. Target at 700 ahead should fire.
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(1200, 500, 0); // 700 away
    const { cmd } = aiCommand(enemy, target, hard, ai, 30, 1 / 60, 1.0);
    expect(cmd.fire).toBe(true);
  });

  it('fire cone respects difficulty — Hard refuses to fire at wide angles Easy accepts', () => {
    // Hard cone = π/9 (~20°), Easy cone = π/4 (~45°).
    // Place target at ~30° off heading.
    const ai1 = createAiState(7);
    const ai2 = createAiState(7);
    const enemy = makePlane(500, 500, 0); // facing right (heading 0)
    // Target 30° below ahead: dx=200, dy=200*tan(30°)≈115. atan2(115,200)≈0.52 rad ~ 30°
    const target = makePlane(700, 615, 0); // ~30° below horizontal, dist ~230
    const easyResult = aiCommand(enemy, target, DIFFICULTIES.easy, ai1, 30, 1 / 60, 1.0);
    const hardResult = aiCommand(enemy, target, DIFFICULTIES.hard, ai2, 30, 1 / 60, 1.0);
    // Easy cone is ±45°, so 30° is inside → fires (range 350, dist ~230 OK).
    // Hard cone is ±20°, so 30° is outside → does not fire.
    expect(easyResult.cmd.fire).toBe(true);
    expect(hardResult.cmd.fire).toBe(false);
  });
});
