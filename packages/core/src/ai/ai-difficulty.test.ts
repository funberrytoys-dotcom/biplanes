import { describe, it, expect } from 'vitest';
import { aiCommand, createAiState } from './chase-policy.js';
import type { AiState } from './chase-policy.js';
import { DIFFICULTIES } from './difficulty.js';
import { G_STALL, GROUND_Y } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

/** Pre-stabilised AI state — bypasses post-takeoff level-out so combat code runs. */
function settled(seed: number): AiState {
  return { ...createAiState(seed), timeFlyingSec: 999 };
}

function makePlane(
  x: number,
  y: number,
  heading: number,
  opts: { hp?: number; g?: number; throttleLevel?: number; facing?: 1 | -1 } = {},
): Plane {
  return {
    id: 1,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: 200, y: 0 },
      heading,
      throttleOn: true,
      g: opts.g ?? 1200,
      facing: opts.facing ?? 1,
      throttle: true,
      throttleLevel: opts.throttleLevel ?? 1,
    },
    hp: opts.hp ?? 30,
    maxHp: 30,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

describe('ai difficulty params', () => {
  it('ground avoidance pulls AI up when below threshold (Easy)', () => {
    // Easy groundClearance = 80. Place enemy 50px above the ground (well inside
    // the 80-px clearance zone) → ground override must rotate up (CCW = -1).
    const ai = settled(123);
    const easy = DIFFICULTIES.easy;
    const enemy = makePlane(500, GROUND_Y - 50, 0);
    const target = makePlane(700, GROUND_Y - 50, 0);
    const { cmd } = aiCommand(enemy, target, easy, ai, 30, 1 / 60, 1.0, true);
    expect(cmd.rotate).toBe(-1);
  });

  it('hard AI pulls up MUCH earlier than Easy (350px clearance vs 80px)', () => {
    // At y = GROUND_Y - 200 Easy is fine (target dead ahead, no override) but
    // Hard (350 clearance) is already in pull-up mode.
    const ai1 = settled(123);
    const ai2 = settled(123);
    const enemyY = GROUND_Y - 200;
    const enemy = makePlane(500, enemyY, 0);
    const target = makePlane(700, enemyY, 0);

    const easyCmd = aiCommand(enemy, target, DIFFICULTIES.easy, ai1, 30, 1 / 60, 1.0, true).cmd;
    const hardCmd = aiCommand(enemy, target, DIFFICULTIES.hard, ai2, 30, 1 / 60, 1.0, true).cmd;

    // Easy doesn't pull up (above its threshold)
    expect(easyCmd.rotate).not.toBe(-1);
    // Hard pulls up (inside its big-margin zone)
    expect(hardCmd.rotate).toBe(-1);
  });

  it('fire range respects difficulty — Easy fires only when close', () => {
    const ai = settled(99);
    const easy = DIFFICULTIES.easy;
    const enemy = makePlane(500, 500, 0);
    const farTarget = makePlane(900, 500, 0); // 400 away — outside Easy 300
    const { cmd: cmdFar } = aiCommand(enemy, farTarget, easy, ai, 30, 1 / 60, 1.0, true);
    expect(cmdFar.fire).toBe(false);

    const ai2 = settled(99);
    const nearTarget = makePlane(750, 500, 0); // 250 away — inside Easy 300
    const { cmd: cmdNear } = aiCommand(enemy, nearTarget, easy, ai2, 30, 1 / 60, 1.0, true);
    expect(cmdNear.fire).toBe(true);
  });

  it('fire range respects difficulty — Hard fires at long range', () => {
    const ai = settled(99);
    const hard = DIFFICULTIES.hard;
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(1200, 500, 0); // 700 away — inside Hard 800
    const { cmd } = aiCommand(enemy, target, hard, ai, 30, 1 / 60, 1.0, true);
    expect(cmd.fire).toBe(true);
  });

  it('fire cone respects difficulty — Hard refuses wide angles Easy accepts', () => {
    const ai1 = settled(7);
    const ai2 = settled(7);
    const enemy = makePlane(500, 500, 0);
    // ~30° below horizontal, dist ~230 (inside both ranges)
    const target = makePlane(700, 615, 0);
    const easyResult = aiCommand(enemy, target, DIFFICULTIES.easy, ai1, 30, 1 / 60, 1.0, true);
    const hardResult = aiCommand(enemy, target, DIFFICULTIES.hard, ai2, 30, 1 / 60, 1.0, true);
    // Easy cone ±51° → fires. Hard cone ±18° → refuses.
    expect(easyResult.cmd.fire).toBe(true);
    expect(hardResult.cmd.fire).toBe(false);
  });

  // ============================================================
  // New tests: survival, throttle management, rookie behaviour
  // ============================================================

  it('stall avoidance triggers when slow and nose-up (Hard)', () => {
    // Hard has stallAvoidEnabled=true. Nose pointed up (heading = -π/2 = straight
    // up in screen coords), speed below G_STALL * 1.15. AI must NOT keep climbing
    // — it should flatten / dive (rotate=+1) to recover energy.
    const ai = settled(42);
    // heading -1.2 rad → strongly nose-up (sin(-1.2) ≈ -0.93 < -0.3 ✓)
    const enemy = makePlane(800, 400, -1.2, { g: G_STALL * 1.0 });
    const target = makePlane(800, 100, 0); // target far above — combat code would beg us to climb harder
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 1.0, true);
    // Stall override → desired heading = +0.1 (slight dive). Current heading
    // -1.2 → diff ≈ +1.3 → rotate = +1.
    expect(cmd.rotate).toBe(1);
    // Should NOT fire while pulling out of a stall
    expect(cmd.fire).toBe(false);
  });

  it('easy AI does NOT engage stall avoidance — climbs into death', () => {
    // Same scenario but on Easy (stallAvoidEnabled=false). Target far above,
    // AI is slow and nose-up. Easy should still try to chase (rotate toward
    // target = up = -1) instead of recovering.
    const ai = settled(42);
    // Place enemy where ground-avoid is NOT triggered (y is fine) and ceiling-
    // avoid is NOT triggered (y > Easy ceilingClearance=60). Use y=400.
    const enemy = makePlane(800, 400, -1.2, { g: G_STALL * 1.0 });
    const target = makePlane(800, 100, 0);
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.easy, ai, 30, 1 / 60, 1.0, true);
    // Easy is past its 0.5s post-takeoff buffer (we pass timeSec=1.0 + wasFlying=true),
    // doesn't recognise stall, sees target above, keeps trying to climb (rotate=-1)
    // OR sometimes a rookie mistake fires. The key assertion: it is NOT pulling
    // the nose down to recover (NOT +1 from stall logic).
    expect(cmd.rotate).not.toBe(1);
  });

  it('hard AI manages throttle: diving on target below produces throttleDelta = -1', () => {
    // Hard: manageThrottle=true, diveThrottle=0.6. With a target ~200px below
    // (so dyToTarget > 60 → throttleIntent=diveThrottle=0.6) and current
    // throttle at 1.0, the AI must command throttleDelta=-1 to wind down.
    const ai = settled(11);
    const enemy = makePlane(800, 300, 0, { throttleLevel: 1.0, g: 700 });
    const target = makePlane(900, 550, 0); // 250 below, dx=100
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 1.0, true);
    expect(cmd.throttleDelta).toBe(-1);
  });

  it('easy AI never touches throttle (manageThrottle=false)', () => {
    // Same dive scenario on Easy: throttleDelta must stay 0.
    const ai = settled(11);
    const enemy = makePlane(800, 300, 0, { throttleLevel: 1.0, g: 700 });
    const target = makePlane(900, 550, 0);
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.easy, ai, 30, 1 / 60, 1.0, true);
    expect(cmd.throttleDelta).toBe(0);
  });

  it('post-takeoff: AI just levels out and does not chase', () => {
    // Fresh enemy (wasFlying=false → resets timeFlyingSec=0). On the first tick
    // with timeFlying < postTakeoffStabilizationSec the AI levels (heading=0)
    // regardless of where the target is.
    const ai = createAiState(5);
    // Target way above — without stabilisation the AI would climb hard.
    const enemy = makePlane(300, 600, 0, { g: 520 });
    const target = makePlane(300, 100, 0);
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 0.1, false);
    // Current heading already 0 → no rotation needed → not -1 (no climb)
    expect(cmd.rotate).not.toBe(-1);
    // Should NOT fire during post-takeoff
    expect(cmd.fire).toBe(false);
  });

  it('post-takeoff keeps left-facing enemies level toward the battlefield', () => {
    const ai = createAiState(5);
    const enemy = makePlane(1700, 900, Math.PI, { g: 520, facing: -1 });
    const target = makePlane(300, 100, 0);
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 0.1, false);

    expect(cmd.rotate).toBe(0);
    expect(cmd.throttleDelta).toBe(0);
    expect(cmd.fire).toBe(false);
  });

  it('left-facing hard AI recovers from a slow nose-up stall by lowering the nose', () => {
    const ai = settled(42);
    const enemy = makePlane(1400, 500, -2.2, { g: G_STALL * 0.98, facing: -1 });
    const target = makePlane(300, 100, 0);
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 1.0, true);

    expect(cmd.rotate).toBe(-1);
    expect(cmd.throttleDelta).toBe(0);
    expect(cmd.fire).toBe(false);
  });

  it('hard AI holds throttle when already behind the player instead of overshooting', () => {
    const ai = settled(77);
    const enemy = makePlane(520, 450, 0, { g: 670, throttleLevel: 1.0, facing: 1 });
    const target = makePlane(760, 450, 0, { g: 620, throttleLevel: 0.7, facing: 1 });
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 3.0, true);

    expect(cmd.rotate).toBe(0);
    expect(cmd.throttleDelta).toBe(-1);
    expect(cmd.fire).toBe(true);
  });
});
