export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * AI parameters split across the three behaviour layers used by `aiCommand`:
 *
 *   Layer 1 (Survival)   — stall avoidance, ground/ceiling pull-out, post-takeoff
 *                          stabilisation. Highest priority; overrides combat.
 *   Layer 2 (Positioning)— altitude offset relative to target, energy management
 *                          (dive-for-speed before climbs).
 *   Layer 3 (Aiming)     — fire cone, range, target leading, turn precision.
 *
 * Plus throttle management, reaction time and rookie-mistake personality knobs.
 */
export interface AiParams {
  // === LAYER 1: SURVIVAL ===
  /** whether the AI is even aware of stall risk */
  stallAvoidEnabled: boolean;
  /** px above GROUND_Y at which ground-avoid pull-up engages (larger = earlier) */
  groundClearance: number;
  /** px below the top of the world at which ceiling-avoid dive engages */
  ceilingClearance: number;
  /** seconds after liftoff during which the AI just levels out to build speed */
  postTakeoffStabilizationSec: number;

  // === LAYER 2: POSITIONING ===
  /** when false, the AI ignores positioning and just aims straight at the target */
  positioningEnabled: boolean;
  /** desired y-offset relative to the target (negative = above, since y-down) */
  preferredAltitudeOffset: number;
  /** when true, the AI dives to gain speed before committing to a climb */
  energyManagement: boolean;

  // === LAYER 3: AIMING ===
  fireConeRad: number;
  fireRange: number;
  /** 0..1 — fraction of "perfect" bullet-lead applied to target prediction */
  leadFactor: number;
  /** how close to the desired heading before the AI stops correcting (radians) */
  turnDeadzoneRad: number;

  // === Reaction & personality ===
  reactionDelaySec: number;
  errorWobbleRad: number;
  evasionChanceWhenHit: number;

  // === THROTTLE MANAGEMENT ===
  /** when false, the AI never touches throttleDelta (effectively always full) */
  manageThrottle: boolean;
  cruiseThrottle: number;
  diveThrottle: number;
  climbThrottle: number;

  // === ROOKIE MISTAKES (easy) ===
  /** probability per second of doing something silly (random heading/throttle flip) */
  rookieMistakeChancePerSec: number;

  // === EJECT BEHAVIOUR ===
  /** probability per second of bailing out when on fire (HP fraction <= FIRE_THRESHOLD) */
  ejectChancePerSec: number;

  // === COMBAT STATS (per-difficulty asymmetry) ===
  /** multiplier on enemy plane max HP (1.0 = base, >1 = tougher) */
  hpMultiplier: number;
  /** multiplier on enemy bullet damage */
  damageMultiplier: number;
  /** multiplier on enemy fire rate (1.0 = same as player, >1 = faster shots) */
  fireRateMultiplier: number;
}

export const DIFFICULTIES: Record<Difficulty, AiParams> = {
  easy: {
    // Green rookie. Doesn't manage energy, often climbs into stalls, sloppy aim,
    // occasionally does silly things (kills throttle, jerks the stick).
    stallAvoidEnabled: false,
    groundClearance: 80,             // pulls up far too late
    ceilingClearance: 60,
    postTakeoffStabilizationSec: 0.5, // barely stabilises before chasing
    positioningEnabled: false,        // dumb chase only
    preferredAltitudeOffset: 0,
    energyManagement: false,
    fireConeRad: Math.PI / 3.5,      // ±51° — really sloppy
    fireRange: 300,
    leadFactor: 0,
    turnDeadzoneRad: 0.25,
    reactionDelaySec: 0.5,
    errorWobbleRad: 0.08,
    evasionChanceWhenHit: 0.3,
    manageThrottle: false,            // always full → climbs into stalls
    cruiseThrottle: 1.0,
    diveThrottle: 1.0,
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0.5,   // a mistake every ~2 seconds
    ejectChancePerSec: 0.3,           // rarely bails, dies in plane
    hpMultiplier: 0.7,                 // fragile — goes down quickly
    damageMultiplier: 0.7,             // weak bullets
    fireRateMultiplier: 0.7,           // slow trigger finger
  },
  medium: {
    stallAvoidEnabled: true,
    groundClearance: 200,
    ceilingClearance: 120,
    postTakeoffStabilizationSec: 1.5,
    positioningEnabled: true,
    preferredAltitudeOffset: -50,
    energyManagement: false,          // simple chase, no energy fight
    fireConeRad: Math.PI / 6,         // ±30°
    fireRange: 550,
    leadFactor: 0.5,
    turnDeadzoneRad: 0.1,
    reactionDelaySec: 0.18,
    errorWobbleRad: 0.025,
    evasionChanceWhenHit: 1.0,
    manageThrottle: true,
    cruiseThrottle: 1.0,
    diveThrottle: 0.8,
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0.05,
    ejectChancePerSec: 1.5,
    hpMultiplier: 1.5,                 // moderately tougher than player baseline
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.2,           // shoots a bit faster
  },
  hard: {
    // Ace. Manages energy, predicts player, rarely crashes, bails when burning.
    stallAvoidEnabled: true,
    groundClearance: 350,             // pulls up with lots of margin
    ceilingClearance: 180,
    postTakeoffStabilizationSec: 2.0, // patient — sets up properly
    positioningEnabled: true,
    preferredAltitudeOffset: -120,    // aggressively positions above player
    energyManagement: true,           // dives for speed before climbing
    fireConeRad: Math.PI / 10,        // ±18°
    fireRange: 800,
    leadFactor: 0.95,
    turnDeadzoneRad: 0.04,
    reactionDelaySec: 0.04,           // basically instant
    errorWobbleRad: 0.005,
    evasionChanceWhenHit: 2.0,        // pre-evades when in danger
    manageThrottle: true,
    cruiseThrottle: 1.0,
    diveThrottle: 0.6,                // controlled dives
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0,
    ejectChancePerSec: 3.0,           // always bails when burning
    hpMultiplier: 2.5,                 // really tough — takes 75 dmg to down (vs player 100)
    damageMultiplier: 1.8,             // bullets bite hard
    fireRateMultiplier: 1.8,           // rapid-fire (~6 shots/sec vs player ~3)
  },
};
