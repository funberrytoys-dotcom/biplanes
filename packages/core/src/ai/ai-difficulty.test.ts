import { describe, it, expect } from 'vitest';
import { aiCommand, createAiState } from './chase-policy.js';
import type { AiState } from './chase-policy.js';
import { DIFFICULTIES, aiParamsForRole } from './difficulty.js';
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

  it('hard AI pulls up earlier than Easy (350px clearance vs 240px)', () => {
    // At y = GROUND_Y - 300 Easy is still fine (target dead ahead, above its 240px
    // threshold) but Hard (350px clearance) is already in pull-up mode. Easy now has
    // a real ground floor too (it no longer faceplants), just a tighter margin.
    const ai1 = settled(123);
    const ai2 = settled(123);
    const enemyY = GROUND_Y - 300;
    const enemy = makePlane(500, enemyY, 0);
    const target = makePlane(700, enemyY, 0);

    const easyCmd = aiCommand(enemy, target, DIFFICULTIES.easy, ai1, 30, 1 / 60, 1.0, true).cmd;
    const hardCmd = aiCommand(enemy, target, DIFFICULTIES.hard, ai2, 30, 1 / 60, 1.0, true).cmd;

    // Easy doesn't pull up yet (above its 240px threshold)
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

  it('easy AI now engages basic stall avoidance (no longer climbs into death)', () => {
    // Easy used to have stallAvoidEnabled=false and would climb itself into a stall
    // and fall — a big source of "the enemy just killed itself". Rookies now have a
    // basic self-preservation floor: slow + nose-up → flatten/dive to recover
    // (rotate=+1), same direction as Hard. Their sloppiness now lives in aim,
    // reaction time and altitude-safe mistakes — not suicide.
    const ai = settled(42);
    const enemy = makePlane(800, 400, -1.2, { g: G_STALL * 1.0 });
    const target = makePlane(800, 100, 0); // target far above — combat would beg us to climb harder
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.easy, ai, 30, 1 / 60, 1.0, true);
    expect(cmd.rotate).toBe(1);
    expect(cmd.fire).toBe(false); // not firing while recovering
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

  it('medium AI cuts throttle when too close head-on to avoid ramming', () => {
    const ai = settled(91);
    const enemy = makePlane(500, 500, 0, { g: 700, throttleLevel: 1.0, facing: 1 });
    const target = makePlane(690, 500, Math.PI, { g: 650, throttleLevel: 1.0, facing: -1 });
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.medium, ai, 30, 1 / 60, 3.0, true);

    expect(cmd.throttleDelta).toBe(-1);
    expect(cmd.fire).toBe(true);
  });

  // ============================================================
  // New tests: burst fire, pursuit pressure, evasion strength
  // ============================================================

  it('hard AI fires in disciplined bursts (on-phase fires, off-phase holds)', () => {
    // Target dead ahead, in cone and range. Walk the burst clock forward a full
    // on+off cycle and confirm the AI both fires AND pauses (not a constant stream).
    const dt = 1 / 60;
    let ai = settled(31);
    const enemy = makePlane(500, 500, 0, { g: 660 });
    const target = makePlane(900, 500, 0, { g: 600 }); // 400 ahead, inside hard 800
    let sawFire = false;
    let sawHold = false;
    let t = 1.0;
    for (let i = 0; i < 90; i++) {
      const res = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, dt, t, true);
      ai = res.aiState;
      if (res.cmd.fire) sawFire = true;
      else sawHold = true;
      t += dt;
    }
    expect(sawFire).toBe(true);  // it does shoot when aligned
    expect(sawHold).toBe(true);  // and it deliberately pauses between bursts
  });

  it('easy AI does NOT burst — fires continuously when aligned (rookie spray)', () => {
    const dt = 1 / 60;
    let ai = settled(31);
    const enemy = makePlane(500, 500, 0, { g: 660 });
    const target = makePlane(700, 500, 0, { g: 600 }); // 200 ahead, inside easy 300
    let fireTicks = 0;
    let t = 1.0;
    for (let i = 0; i < 30; i++) {
      const res = aiCommand(enemy, target, DIFFICULTIES.easy, ai, 30, dt, t, true);
      ai = res.aiState;
      if (res.cmd.fire) fireTicks++;
      t += dt;
    }
    // burstFire=false → no enforced off-phase; fires (almost) every aligned tick.
    expect(fireTicks).toBeGreaterThan(25);
  });

  it('hard keeps firing while being shot if the nose still tracks the target', () => {
    // Regression: previously any hit suppressed fire for the whole evasion window,
    // so pressuring a hard enemy made it go passive. Now it keeps shooting as long
    // as the player stays in its cone. Target dead ahead; AI took damage this tick.
    const ai = settled(5);
    const enemy = makePlane(500, 500, 0, { g: 660 });
    const target = makePlane(800, 500, 0, { g: 600 });
    // prevSelfHp (35) > current hp (30) → wasHit=true, evasion may trigger.
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 35, 1 / 60, 1.0, true);
    // Even though it was hit, the nose is still on the target → it fires.
    expect(cmd.fire).toBe(true);
  });

  it('hard presses the attack (higher throttle) when aligned at safe firing range in the tail', () => {
    // Enemy in tail sector, aligned, target at ~250px (>= overshoot 200, < range)
    // and the enemy is currently slow → it should throttle UP to close & keep guns on.
    const ai = settled(88);
    const enemy = makePlane(500, 450, 0, { g: 500, throttleLevel: 0.4, facing: 1 });
    const target = makePlane(840, 450, 0, { g: 600, throttleLevel: 0.7, facing: 1 });
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 30, 1 / 60, 3.0, true);
    // pressAttackThrottle (0.8) > current 0.4 → throttle up.
    expect(cmd.throttleDelta).toBe(1);
  });

  it('medium and hard press a close-but-bounded tail standoff', () => {
    // Aggression pass: standoff was tightened for tail pressure (collisions no longer
    // instakill, so a close six is fine). Still bounded so they don't sit ON the player.
    expect(DIFFICULTIES.hard.tailStandoffPx).toBeGreaterThanOrEqual(150);
    expect(DIFFICULTIES.medium.tailStandoffPx).toBeGreaterThanOrEqual(140);
    expect(DIFFICULTIES.hard.overshootDistancePx).toBeGreaterThanOrEqual(200);
    expect(DIFFICULTIES.hard.evasionStrengthRad).toBeGreaterThan(
      DIFFICULTIES.easy.evasionStrengthRad,
    );
    expect(DIFFICULTIES.hard.burstFire).toBe(true);
    expect(DIFFICULTIES.easy.burstFire).toBe(false);
    // Spec §8: hard's raw stat crutches were eased back vs the old brick.
    expect(DIFFICULTIES.hard.hpMultiplier).toBeLessThanOrEqual(2.0);
  });

  it('same seed → identical burst/evasion behaviour (determinism)', () => {
    const dt = 1 / 60;
    function run(seed: number): string {
      let ai = settled(seed);
      const enemy = makePlane(500, 500, 0, { g: 660 });
      const target = makePlane(820, 510, 0, { g: 600 });
      const log: string[] = [];
      let t = 1.0;
      for (let i = 0; i < 60; i++) {
        const res = aiCommand(enemy, target, DIFFICULTIES.hard, ai, 31, dt, t, true);
        ai = res.aiState;
        log.push(`${res.cmd.rotate}${res.cmd.fire ? 1 : 0}${res.cmd.throttleDelta}`);
        t += dt;
      }
      return log.join(',');
    }
    expect(run(404)).toBe(run(404));
  });

  it('arena roles make enemies smarter without only inflating health', () => {
    const rookie = aiParamsForRole('medium', 'rookie');
    const hunter = aiParamsForRole('medium', 'hunter');
    const ace = aiParamsForRole('medium', 'ace');
    const boss = aiParamsForRole('hard', 'boss');

    expect(rookie.positioningEnabled).toBe(false);
    expect(hunter.positioningEnabled).toBe(true);
    expect(ace.energyManagement).toBe(true);
    expect(ace.reactionDelaySec).toBeLessThan(hunter.reactionDelaySec);
    expect(ace.hpMultiplier).toBeLessThanOrEqual(hunter.hpMultiplier * 1.08);
    expect(boss.fireRange).toBeGreaterThan(ace.fireRange);
  });
});
