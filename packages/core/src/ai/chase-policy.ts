import type { PlayerCommand } from '@biplanes/shared';
import { GROUND_Y } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { AiParams } from './difficulty.js';
import { DIFFICULTIES } from './difficulty.js';

export interface AiState {
  reactionBuffer: { pos: { x: number; y: number }; vel: { x: number; y: number }; t: number }[];
  evasionTimer: number;    // seconds until evasion maneuver ends
  evasionDir: -1 | 0 | 1;  // direction of current evasion
  wobbleSeed: number;      // for deterministic noise per enemy
}

export function createAiState(seed: number): AiState {
  return { reactionBuffer: [], evasionTimer: 0, evasionDir: 0, wobbleSeed: seed };
}

// Mulberry32-style noise so AI wobble is deterministic per-enemy
function noise(seed: number, t: number): number {
  let x = (seed + Math.floor(t * 1000)) >>> 0;
  x = (x + 0x6d2b79f5) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

export function aiCommand(
  self: Plane,
  target: Plane,
  params: AiParams,
  aiState: AiState,
  prevTargetHp: number,
  dt: number,
  currentTime: number,
): { cmd: PlayerCommand; aiState: AiState } {
  const newState: AiState = { ...aiState };

  // 1. Record current target state into reaction buffer; we'll read from N ms ago.
  newState.reactionBuffer = [
    ...aiState.reactionBuffer,
    {
      pos: { ...target.kinematic.position },
      vel: { ...target.kinematic.velocity },
      t: currentTime,
    },
  ].filter(e => currentTime - e.t <= 2.0);  // keep up to 2s of history

  // 2. Find the buffered sample reactionDelaySec ago.
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

  // 3. Lead the target by predicting where it'll be in `leadTime` seconds.
  const distance = Math.hypot(
    bufferedPos.x - self.kinematic.position.x,
    bufferedPos.y - self.kinematic.position.y,
  );
  const BULLET_TRAVEL_TIME = distance / 1000;  // approx using BULLET_SPEED 1000
  const leadTime = BULLET_TRAVEL_TIME * params.leadFactor;
  const aimX = bufferedPos.x + bufferedVel.x * leadTime;
  const aimY = bufferedPos.y + bufferedVel.y * leadTime;

  // 4. Compute desired heading to aim point.
  let dx = aimX - self.kinematic.position.x;
  let dy = aimY - self.kinematic.position.y;

  // 5. OVERRIDE: ground avoidance. If we're below groundAvoidY, force pull-up.
  if (self.kinematic.position.y > params.groundAvoidY) {
    // Drag aim upward proportional to how dangerous it is
    const danger = (self.kinematic.position.y - params.groundAvoidY) / Math.max(1, GROUND_Y - params.groundAvoidY);
    dy -= 1000 * danger;
  }

  // 6. OVERRIDE: ceiling avoidance. If above ceilingAvoidY, force pull-down.
  if (self.kinematic.position.y < params.ceilingAvoidY) {
    const danger = (params.ceilingAvoidY - self.kinematic.position.y) / Math.max(1, params.ceilingAvoidY);
    dy += 1000 * danger;
  }

  // 7. OVERRIDE: collision avoidance. If head-on close to target, swerve.
  const closingFromAhead =
    distance < params.collisionAvoidDist &&
    Math.sign(target.kinematic.velocity.x) !== Math.sign(self.kinematic.velocity.x);
  if (closingFromAhead) {
    // Swerve up or down — pick whichever is more out of the way
    dy += dy < 0 ? -500 : 500;
  }

  // 8. EVASION: if HP dropped this tick AND chance triggered, start an evasion timer.
  const wasHit = self.hp < prevTargetHp;
  if (wasHit && Math.random() < params.evasionChanceWhenHit * dt && newState.evasionTimer <= 0) {
    newState.evasionTimer = 0.6;
    newState.evasionDir = Math.random() < 0.5 ? -1 : 1;
  }
  if (newState.evasionTimer > 0) {
    newState.evasionTimer -= dt;
    // Add a strong rotation bias for evasion
    dy += newState.evasionDir * 600;
    dx += newState.evasionDir * 300;
  }

  // 9. Compute angle to aim point AFTER overrides
  const angleToAim = Math.atan2(dy, dx);

  // 10. Compute heading diff, normalize
  let diff = angleToAim - self.kinematic.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  // 11. Add wobble noise (Easy = high, Hard = low)
  diff += noise(newState.wobbleSeed, currentTime) * params.errorWobbleRad;

  // 12. Rotation command with deadzone
  let rotate: -1 | 0 | 1 = 0;
  if (diff > params.turnDeadzoneRad) rotate = 1;
  else if (diff < -params.turnDeadzoneRad) rotate = -1;

  // 13. Fire if in cone AND in range (use UNADJUSTED aim — don't fire during evasion/avoidance)
  const realDx = target.kinematic.position.x - self.kinematic.position.x;
  const realDy = target.kinematic.position.y - self.kinematic.position.y;
  const realDist = Math.hypot(realDx, realDy);
  const realAngle = Math.atan2(realDy, realDx);
  let realDiff = realAngle - self.kinematic.heading;
  while (realDiff > Math.PI) realDiff -= 2 * Math.PI;
  while (realDiff < -Math.PI) realDiff += 2 * Math.PI;
  const inCone = Math.abs(realDiff) < params.fireConeRad;
  const inRange = realDist < params.fireRange;
  const fire = inCone && inRange && newState.evasionTimer <= 0;

  return {
    cmd: { rotate, fire, bomb: false, throttleDelta: 0, eject: false },
    aiState: newState,
  };
}

// Legacy export — uses Medium difficulty with no internal state for callers that don't track it.
export function chasePolicy(self: Plane, target: Plane): PlayerCommand {
  const dummyState = createAiState(self.id);
  return aiCommand(self, target, DIFFICULTIES.medium, dummyState, self.hp, 1 / 60, 0).cmd;
}
