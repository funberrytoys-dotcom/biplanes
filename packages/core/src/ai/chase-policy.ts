import type { PlayerCommand } from '@biplanes/shared';
import { G_STALL, G_MAX_LEVEL, BULLET_SPEED, WORLD_HEIGHT } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Pilot } from '../entities/pilot.js';
import type { AiParams } from './difficulty.js';
import { DIFFICULTIES } from './difficulty.js';

/**
 * Per-enemy AI state kept across ticks.
 *
 * Tracks reaction-buffered target snapshots (for delayed reaction), the current
 * evasion maneuver, deterministic-per-enemy wobble seed, time-since-liftoff for
 * post-takeoff stabilisation, and the current rookie-mistake action (EASY only).
 */
export interface AiState {
  reactionBuffer: { pos: { x: number; y: number }; vel: { x: number; y: number }; t: number }[];
  evasionTimer: number;
  evasionDir: -1 | 0 | 1;
  wobbleSeed: number;
  /** seconds spent in the 'flying' state; resets when the AI is not flying */
  timeFlyingSec: number;
  /** seconds remaining on the current rookie mistake (if any) */
  rookieMistakeTimer: number;
  rookieMistakeAction: 'climb' | 'dive' | 'throttle-off' | 'wrong-turn' | 'none';
  /** burst-fire cadence: time left in the current on/off phase, and which phase */
  burstTimer: number;
  burstFiring: boolean;
}

export function createAiState(seed: number): AiState {
  return {
    reactionBuffer: [],
    evasionTimer: 0,
    evasionDir: 0,
    wobbleSeed: seed,
    timeFlyingSec: 0,
    rookieMistakeTimer: 0,
    rookieMistakeAction: 'none',
    burstTimer: 0,
    burstFiring: true,
  };
}

// Mulberry32-style noise so AI wobble is deterministic per-enemy
function noise(seed: number, t: number): number {
  let x = (seed + Math.floor(t * 1000)) >>> 0;
  x = (x + 0x6d2b79f5) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

// Deterministic [0,1) draw per (enemy, tick, salt). Replaces Math.random() so
// AI evasion and rookie mistakes are reproducible — required for replay and
// honest difficulty balancing. `salt` separates independent draws within a tick.
function det01(seed: number, t: number, salt: number): number {
  return (noise((seed + Math.imul(salt, 0x9e3779b1)) >>> 0, t) + 1) / 2;
}

/** Wrap a heading delta into (-π, π]. */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function facingHeading(facing: 1 | -1, pitch: number = 0): number {
  if (facing === 1) return pitch;
  const heading = pitch >= 0 ? Math.PI - pitch : -Math.PI - pitch;
  return normalizeAngle(heading);
}

function forwardVector(heading: number): { x: number; y: number } {
  return { x: Math.cos(heading), y: Math.sin(heading) };
}

function isInTailSector(self: Plane, target: Plane): boolean {
  const forward = forwardVector(target.kinematic.heading);
  const rel = {
    x: self.kinematic.position.x - target.kinematic.position.x,
    y: self.kinematic.position.y - target.kinematic.position.y,
  };
  const behind = -(rel.x * forward.x + rel.y * forward.y);
  if (behind < 140 || behind > 420) return false;

  const lateral = rel.x * -forward.y + rel.y * forward.x;
  const maxLateral = Math.tan(35 * Math.PI / 180) * behind;
  if (Math.abs(lateral) > maxLateral) return false;

  const headingDiff = Math.abs(normalizeAngle(self.kinematic.heading - target.kinematic.heading));
  return headingDiff < 50 * Math.PI / 180;
}

function isHeadOnThreat(self: Plane, target: Plane): boolean {
  const dx = target.kinematic.position.x - self.kinematic.position.x;
  const dy = target.kinematic.position.y - self.kinematic.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 260) return false;

  const toTarget = Math.atan2(dy, dx);
  const selfNoseOn = Math.abs(normalizeAngle(toTarget - self.kinematic.heading)) < Math.PI / 5;
  const targetNoseOn = Math.abs(normalizeAngle(toTarget + Math.PI - target.kinematic.heading)) < Math.PI / 4;
  return selfNoseOn && targetNoseOn;
}

function collisionAvoidanceHeading(
  self: Plane,
  target: Plane,
): { heading: number; throttle: number } | null {
  const dx = target.kinematic.position.x - self.kinematic.position.x;
  const dy = target.kinematic.position.y - self.kinematic.position.y;
  const dvx = target.kinematic.velocity.x - self.kinematic.velocity.x;
  const dvy = target.kinematic.velocity.y - self.kinematic.velocity.y;
  const relSpeedSq = dvx * dvx + dvy * dvy;
  if (relSpeedSq < 1) return null;

  const tClosest = Math.max(0, Math.min(0.65, -(dx * dvx + dy * dvy) / relSpeedSq));
  const closestX = dx + dvx * tClosest;
  const closestY = dy + dvy * tClosest;
  const closestDist = Math.hypot(closestX, closestY);
  const currentDist = Math.hypot(dx, dy);
  const headOn = isHeadOnThreat(self, target);
  if (!headOn && (tClosest <= 0.05 || closestDist > 150 || currentDist > 520)) return null;

  const roomAbove = self.kinematic.position.y;
  // Break UP to dodge — climbing away from the ground is always safer than diving
  // toward it. Only break downward if we're genuinely pinned near the ceiling.
  const breakUp = roomAbove > 220;
  return {
    heading: facingHeading(self.kinematic.facing, breakUp ? -0.72 : 0.72),
    throttle: headOn ? 0.25 : 0.45,
  };
}

/**
 * Three-layer AI command:
 *   1) SURVIVAL  — stall recovery, ground/ceiling avoidance, post-takeoff level out
 *   2) POSITION  — pick a desired aim point (above/below target) and throttle setting
 *   3) AIM/FIRE  — lead the target, fire only when inside cone+range
 *
 * Layer 1 overrides 2 and 3 when triggered (no firing while pulling out of a stall).
 *
 * @param wasFlying  true if the plane was already in the 'flying' state coming
 *                   into this tick. Used to manage `timeFlyingSec` so that a
 *                   freshly-airborne AI doesn't immediately try to chase.
 */
export function aiCommand(
  self: Plane,
  target: Plane,
  params: AiParams,
  aiState: AiState,
  prevSelfHp: number,
  dt: number,
  currentTime: number,
  wasFlying: boolean = true,
  worldHeight: number = WORLD_HEIGHT,
): { cmd: PlayerCommand; aiState: AiState } {
  const newState: AiState = { ...aiState };

  // ----- Track time spent flying (resets on respawn / taxi) -----
  if (!wasFlying) {
    newState.timeFlyingSec = 0;
  } else {
    newState.timeFlyingSec = aiState.timeFlyingSec + dt;
  }

  // ----- Reaction buffer: read target state from N ms ago -----
  newState.reactionBuffer = [
    ...aiState.reactionBuffer,
    {
      pos: { ...target.kinematic.position },
      vel: { ...target.kinematic.velocity },
      t: currentTime,
    },
  ].filter(e => currentTime - e.t <= 2.0);

  let bufferedPos = { ...target.kinematic.position };
  let bufferedVel = { ...target.kinematic.velocity };
  for (let i = newState.reactionBuffer.length - 1; i >= 0; i--) {
    const sample = newState.reactionBuffer[i]!;
    if (currentTime - sample.t >= params.reactionDelaySec) {
      bufferedPos = sample.pos;
      bufferedVel = sample.vel;
      break;
    }
  }

  // ============================================================
  // LAYER 1: SURVIVAL
  // ============================================================
  // Compute an override heading + throttle. If any clause fires, the AI ignores
  // combat positioning this tick. Order matters: ground > stall > ceiling.
  let overrideHeading: number | null = null;
  let overrideThrottle = params.cruiseThrottle;
  let inSurvival = false;

  const sinH = Math.sin(self.kinematic.heading);
  const y = self.kinematic.position.y;
  const g = self.kinematic.g;
  const groundY = worldHeight - 90;
  const avoidance = newState.timeFlyingSec >= params.postTakeoffStabilizationSec
    ? collisionAvoidanceHeading(self, target)
    : null;

  // 1a. Post-takeoff stabilisation — level out and build speed.
  if (newState.timeFlyingSec < params.postTakeoffStabilizationSec) {
    overrideHeading = facingHeading(self.kinematic.facing); // horizontal toward current side
    overrideThrottle = 1.0;
    inSurvival = true;
  } else if (avoidance) {
    overrideHeading = avoidance.heading;
    overrideThrottle = avoidance.throttle;
    inSurvival = true;
  }
  // 1b. Ground crash imminent — pull up. Always wins over stall avoid because
  // hitting the ground is more immediately fatal than a recoverable stall.
  // Trigger on raw proximity, OR earlier if we're moderately low AND already
  // diving (sinH > 0.45 ≈ >27° nose-down): a fast plane can't reverse a steep
  // dive within one ground-clearance, so start the pull-out while there's height.
  else if (
    y > groundY - params.groundClearance
    || (sinH > 0.45 && y > groundY - params.groundClearance * 2.4)
  ) {
    // Pull up, but if we're very slow AND nose-up, ease the climb angle to
    // avoid trading ground impact for stall fall.
    const slow = g < G_STALL * 1.05;
    overrideHeading = facingHeading(self.kinematic.facing, slow ? -0.3 : -0.85);
    overrideThrottle = 1.0;
    inSurvival = true;
  }
  // 1c. Stall risk — flatten and dive slightly to recover energy.
  // sinH < -0.3 means nose is meaningfully above the horizon (sin is positive
  // toward y-down, so negative sin = nose up in screen coords).
  else if (params.stallAvoidEnabled && g < G_STALL * 1.15 && sinH < -0.3) {
    overrideHeading = facingHeading(self.kinematic.facing, 0.1); // slight dive to feed speed
    overrideThrottle = 1.0;
    inSurvival = true;
  }
  // 1d. Ceiling avoidance — dive, throttle back so we don't over-accelerate.
  else if (y < params.ceilingClearance) {
    overrideHeading = facingHeading(self.kinematic.facing, 0.4);
    overrideThrottle = 0.7;
    inSurvival = true;
  }

  // ============================================================
  // LAYER 2 + 3: POSITIONING + AIMING (only if not in survival)
  // ============================================================
  // Choose an aim point and desired throttle.
  let targetHeading: number;
  let targetThrottle: number;

  if (inSurvival) {
    targetHeading = overrideHeading!;
    targetThrottle = overrideThrottle;
  } else {
    // --- Layer 2: Positioning ---
    // Compute aim point (with optional altitude offset).
    let aimX: number;
    let aimY: number;
    const inTailSector = params.energyManagement && isInTailSector(self, target);

    if (inTailSector) {
      aimX = bufferedPos.x;
      aimY = bufferedPos.y;
    } else if (params.positioningEnabled) {
      if (params.energyManagement) {
        const targetForward = forwardVector(target.kinematic.heading);
        aimX = bufferedPos.x - targetForward.x * params.tailStandoffPx;
        aimY = bufferedPos.y - targetForward.y * params.tailStandoffPx + params.preferredAltitudeOffset * 0.5;
      } else {
        // Position above (or below) target by preferredAltitudeOffset.
        aimX = bufferedPos.x;
        aimY = bufferedPos.y + params.preferredAltitudeOffset;
      }
    } else {
      aimX = bufferedPos.x;
      aimY = bufferedPos.y;
    }

    // Energy management: if target is above us AND we're slow AND we have
    // altitude to spare, dive first to gain speed instead of climbing directly.
    // The dive is roughly "as far below us as the target is above us".
    let throttleIntent: number;
    const dyToTarget = aimY - self.kinematic.position.y;
    const targetIsAbove = dyToTarget < -40;
    const ourSpeedRatio = g / G_MAX_LEVEL;

    if (inTailSector) {
      const realDist = Math.hypot(
        target.kinematic.position.x - self.kinematic.position.x,
        target.kinematic.position.y - self.kinematic.position.y,
      );
      const speedRatioToTarget = target.kinematic.g > 1 ? g / target.kinematic.g : 1;
      // Aligned + in firing range → press the attack at higher throttle to close
      // the gap and keep the gun on target, instead of idling at standoff.
      const realAng = Math.atan2(
        target.kinematic.position.y - self.kinematic.position.y,
        target.kinematic.position.x - self.kinematic.position.x,
      );
      const aligned = Math.abs(normalizeAngle(realAng - self.kinematic.heading)) < params.fireConeRad;
      if (realDist < params.overshootDistancePx || speedRatioToTarget > 1.08) {
        // Too close / closing too fast → ease off to avoid overshooting the tail.
        throttleIntent = 0.5;
      } else if (aligned && realDist < params.fireRange) {
        throttleIntent = params.pressAttackThrottle;
      } else {
        throttleIntent = 0.75;
      }
    } else if (params.energyManagement && targetIsAbove && ourSpeedRatio < 0.9) {
      // Dive to convert altitude (we have none) into speed; actually trade by
      // pointing slightly down to feed speed, then climb. We do this by
      // overriding the aim point downward briefly.
      aimY = self.kinematic.position.y + 80;
      throttleIntent = params.diveThrottle;
    } else if (dyToTarget < -20) {
      // Target above us → climbing
      throttleIntent = params.climbThrottle;
    } else if (dyToTarget > 60) {
      // Target below us → diving on them; control speed
      throttleIntent = params.diveThrottle;
    } else {
      throttleIntent = params.cruiseThrottle;
    }
    targetThrottle = throttleIntent;
    if (isHeadOnThreat(self, target)) {
      targetThrottle = Math.min(targetThrottle, 0.35);
    }

    // Never aim below the ground-avoidance line: if the target skims the deck the
    // AI gives up the low shot and levels off, instead of diving in after it and
    // pancaking. (groundY/groundClearance match the Layer-1 pull-up trigger.)
    const aimFloorY = groundY - params.groundClearance;
    if (aimY > aimFloorY) aimY = aimFloorY;

    // --- Layer 3: Aiming with lead ---
    const dx0 = aimX - self.kinematic.position.x;
    const dy0 = aimY - self.kinematic.position.y;
    const distance = Math.hypot(dx0, dy0);
    const bulletTravelTime = distance / BULLET_SPEED;
    const leadTime = bulletTravelTime * params.leadFactor;
    const finalAimX = aimX + bufferedVel.x * leadTime;
    const finalAimY = aimY + bufferedVel.y * leadTime;

    targetHeading = Math.atan2(
      finalAimY - self.kinematic.position.y,
      finalAimX - self.kinematic.position.x,
    );
  }

  // ============================================================
  // EVASION (folded into heading bias when the AI just got hit)
  // ============================================================
  const wasHit = self.hp < prevSelfHp;
  if (
    !inSurvival
    && wasHit
    && det01(newState.wobbleSeed, currentTime, 1) < params.evasionChanceWhenHit * dt
    && newState.evasionTimer <= 0
  ) {
    newState.evasionTimer = params.evasionDurationSec;
    newState.evasionDir = det01(newState.wobbleSeed, currentTime, 2) < 0.5 ? -1 : 1;
  }
  if (newState.evasionTimer > 0) {
    newState.evasionTimer -= dt;
    if (!inSurvival) {
      // bias heading perpendicular to current motion
      targetHeading += newState.evasionDir * params.evasionStrengthRad;
    }
  }

  // ============================================================
  // ROOKIE MISTAKES (easy only)
  // ============================================================
  if (params.rookieMistakeChancePerSec > 0 && !inSurvival) {
    if (newState.rookieMistakeTimer > 0) {
      newState.rookieMistakeTimer -= dt;
    } else if (det01(newState.wobbleSeed, currentTime, 3) < params.rookieMistakeChancePerSec * dt) {
      const r = det01(newState.wobbleSeed, currentTime, 4);
      if (r < 0.35) {
        newState.rookieMistakeAction = 'climb';
      } else if (r < 0.6) {
        newState.rookieMistakeAction = 'dive';
      } else if (r < 0.85) {
        newState.rookieMistakeAction = 'wrong-turn';
      } else {
        newState.rookieMistakeAction = 'throttle-off';
      }
      newState.rookieMistakeTimer = 0.6 + det01(newState.wobbleSeed, currentTime, 5) * 0.8;
    } else {
      newState.rookieMistakeAction = 'none';
    }

    // Don't let a rookie's silly mistake drive it into the dirt: when low, suppress
    // the downward/disorienting ones (dive, wrong-turn). Climbing away is safe.
    const lowForMistakes = self.kinematic.position.y > groundY - params.groundClearance * 1.6;
    if (newState.rookieMistakeTimer > 0) {
      if (newState.rookieMistakeAction === 'climb') targetHeading = -1.2;
      else if (newState.rookieMistakeAction === 'dive' && !lowForMistakes) targetHeading = 0.4;
      else if (newState.rookieMistakeAction === 'wrong-turn' && !lowForMistakes) {
        targetHeading = self.kinematic.heading + 1.2;
      } else if (newState.rookieMistakeAction === 'throttle-off') {
        // handled below where we resolve throttle
      }
    }
  }

  // ============================================================
  // ANTI-DIVE FLOOR (tier-agnostic ground safety)
  // ============================================================
  // The real killer isn't aim — it's that a fast plane can't pull out of a steep
  // dive in time (and a rookie's throttle is stuck full, so it can't even slow to
  // tighten the turn). So in the lower arena we cap how far below the horizon any
  // combat heading may point: planes can still descend to engage, just not plunge.
  {
    // Altitude-aware anti-dive: the plane can't pull out of a steep dive faster
    // than its turn rate, so the dive angle it's ALLOWED to command must shrink as
    // the ground gets closer. With lots of height, steep dives are fine; near the
    // deck, only a shallow descent. This stops a committed plunge from ever building
    // up (the real cause of enemies flying themselves into the ground). It only
    // caps DOWNWARD pitch, so it never fights a ground-avoid pull-up (which is up).
    const gap = groundY - self.kinematic.position.y;
    const maxDescend = Math.max(0.12, Math.min(0.6, gap / 750));
    if (Math.sin(targetHeading) > Math.sin(maxDescend)) {
      targetHeading = Math.cos(targetHeading) >= 0 ? maxDescend : Math.PI - maxDescend;
    }
  }

  // ============================================================
  // TRANSLATE → COMMAND
  // ============================================================
  // Heading diff w/ wobble + deadzone
  let diff = normalizeAngle(targetHeading - self.kinematic.heading);
  diff += noise(newState.wobbleSeed, currentTime) * params.errorWobbleRad;

  let rotate = 0; // AI steers at full ±1 deflection (heading-relative); analog is player-only
  if (diff > params.turnDeadzoneRad) rotate = 1;
  else if (diff < -params.turnDeadzoneRad) rotate = -1;

  // Throttle
  let throttleDelta: -1 | 0 | 1 = 0;
  if (params.manageThrottle) {
    let effectiveTargetThrottle = targetThrottle;
    if (newState.rookieMistakeTimer > 0 && newState.rookieMistakeAction === 'throttle-off') {
      effectiveTargetThrottle = 0;
    }
    const currentThrottle = self.kinematic.throttleLevel;
    if (currentThrottle < effectiveTargetThrottle - 0.05) throttleDelta = 1;
    else if (currentThrottle > effectiveTargetThrottle + 0.05) throttleDelta = -1;
  }

  // ============================================================
  // BURST-FIRE CADENCE
  // ============================================================
  // Advance the on/off burst phase clock so smart AIs fire in disciplined bursts
  // (dangerous but readable) rather than a continuous stream. The timer only
  // matters when burstFire is on; rookies (burstFire=false) fire whenever aligned.
  let burstAllowsFire = true;
  if (params.burstFire) {
    if (aiState.burstTimer <= 0 && aiState.burstFiring) {
      // Fresh clock (default state): begin in the firing phase, don't flip.
      newState.burstFiring = true;
      newState.burstTimer = params.burstOnSec;
    } else {
      newState.burstTimer = aiState.burstTimer - dt;
      if (newState.burstTimer <= 0) {
        // flip phase
        newState.burstFiring = !aiState.burstFiring;
        newState.burstTimer = newState.burstFiring ? params.burstOnSec : params.burstOffSec;
      }
    }
    burstAllowsFire = newState.burstFiring;
  }

  // Fire: only if NOT in survival override AND target is in cone+range AND the
  // burst phase currently allows it. We deliberately DO NOT suppress firing for
  // the whole evasion window any more — the cone check below already drops shots
  // when a jink pulls the nose off target, but if the nose still tracks the
  // player the AI keeps shooting, so pressing it no longer makes it go passive.
  // Use real (unbuffered, unled) target geometry for the fire decision so the
  // AI doesn't fire wildly into space when the lead+wobble compose poorly.
  let fire = false;
  if (!inSurvival && burstAllowsFire) {
    const realDx = target.kinematic.position.x - self.kinematic.position.x;
    const realDy = target.kinematic.position.y - self.kinematic.position.y;
    const realDist = Math.hypot(realDx, realDy);
    const realAngle = Math.atan2(realDy, realDx);
    const realDiff = normalizeAngle(realAngle - self.kinematic.heading);
    const inCone = Math.abs(realDiff) < params.fireConeRad;
    const inRange = realDist < params.fireRange;
    fire = inCone && inRange;
  }

  return {
    cmd: { rotate, throttleDelta, fire, bomb: false, eject: false, jump: false },
    aiState: newState,
  };
}

// Legacy export — kept for the chase-policy.test.ts callers and any external
// importer that wants a simple "turn toward target and fire" behaviour without
// positioning offsets or throttle management. Uses Medium tuning for cone /
// range / lead but disables positioning so it aims straight at the target.
const LEGACY_CHASE_PARAMS: AiParams = {
  ...DIFFICULTIES.medium,
  positioningEnabled: false,
  preferredAltitudeOffset: 0,
  energyManagement: false,
  manageThrottle: false,
  rookieMistakeChancePerSec: 0,
  postTakeoffStabilizationSec: 0,
  errorWobbleRad: 0,
};
export function chasePolicy(self: Plane, target: Plane): PlayerCommand {
  const dummyState = createAiState(self.id);
  // wasFlying=true to bypass post-takeoff stabilisation in unit tests.
  return aiCommand(self, target, LEGACY_CHASE_PARAMS, dummyState, self.hp, 1 / 60, 0, true).cmd;
}

/**
 * AI command when the target is an ejected pilot rather than a plane.
 *
 * Strafing attack: the pilot sits on the ground (y ≈ GROUND_Y), so the default
 * `preferredAltitudeOffset` of -50 would make the AI try to fly LOWER than its
 * own `groundClearance` pull-up threshold — it would constantly trigger ground
 * avoidance and never get into firing position. We force the AI to orbit well
 * ABOVE its ground-clearance line and aim down from there.
 *
 * We also widen the fire cone and disable energy management (the AI shouldn't
 * dive away because "target is below" — it's a strafing run on a ground target).
 */
export function aiCommandPilotTarget(
  self: Plane,
  pilot: Pilot,
  params: AiParams,
  aiState: AiState,
  prevSelfHp: number,
  dt: number,
  currentTime: number,
  wasFlying: boolean = true,
): { cmd: PlayerCommand; aiState: AiState } {
  const virtual: Plane = {
    id: -1,
    faction: pilot.faction,
    kinematic: {
      position: { ...pilot.position },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: false,
      g: 0,
      facing: pilot.facing,
      throttle: false,
      throttleLevel: 0,
    },
    hp: 1,
    maxHp: 1,
    weaponCooldown: 0,
    alive: pilot.state === 'parachute' || pilot.state === 'walking',
    state: 'flying',
    respawnTimer: 0,
  };

  // Strafing-attack overrides: orbit above own pull-up line, widen cone, fire eagerly.
  const strafingParams: AiParams = {
    ...params,
    positioningEnabled: true,
    preferredAltitudeOffset: -(params.groundClearance + 80),
    energyManagement: false,
    fireConeRad: Math.max(params.fireConeRad, Math.PI / 4), // at least ±45° for steep-angle shots
    fireRange: Math.max(params.fireRange, 700),
  };

  const result = aiCommand(self, virtual, strafingParams, aiState, prevSelfHp, dt, currentTime, wasFlying);

  const dx = pilot.position.x - self.kinematic.position.x;
  const dy = pilot.position.y - self.kinematic.position.y;
  const dist = Math.hypot(dx, dy);
  const angleToPilot = Math.atan2(dy, dx);
  const noseDiff = Math.abs(normalizeAngle(angleToPilot - self.kinematic.heading));
  const pilotInStrafeCone = dist < Math.max(strafingParams.fireRange, 1150)
    && noseDiff < Math.max(strafingParams.fireConeRad, Math.PI / 2.4);

  return {
    cmd: {
      ...result.cmd,
      fire: result.cmd.fire || pilotInStrafeCone,
    },
    aiState: result.aiState,
  };
}
