export type Difficulty = 'easy' | 'medium' | 'hard';
export type AiRole = 'chase-player' | 'attack-caravan' | 'rookie' | 'hunter' | 'ace' | 'boss';

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
  /** how hard the AI jinks when it decides to evade (radians of heading bias) */
  evasionStrengthRad: number;
  /** duration of one evasion jink, seconds */
  evasionDurationSec: number;

  // === BURST FIRE DISCIPLINE ===
  /** when true, the AI fires in disciplined on/off bursts instead of a continuous stream */
  burstFire: boolean;
  /** length of a firing burst, seconds */
  burstOnSec: number;
  /** pause between bursts, seconds */
  burstOffSec: number;

  // === TAIL-CHASE / PURSUIT TUNING ===
  /** how far behind the target the AI sets up its attack run (px). Smaller = closer, more pressure */
  tailStandoffPx: number;
  /** real distance (px) below which the AI eases throttle to avoid overshooting the target */
  overshootDistancePx: number;
  /** throttle held while pressing a clean tail shot (target aligned & in range) */
  pressAttackThrottle: number;

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
    stallAvoidEnabled: true,         // basic self-preservation so rookies don't just faceplant
    groundClearance: 240,            // sloppy, but pulls up before hitting the deck
    ceilingClearance: 60,
    postTakeoffStabilizationSec: 0.5, // barely stabilises before chasing
    positioningEnabled: false,        // dumb chase only
    preferredAltitudeOffset: 0,
    energyManagement: false,
    fireConeRad: Math.PI / 5,        // ±36° — rookie, but no longer a screen-wide spray
    // 260 was far too short for the 3× «Забег»/arena world — rookies (rounds 1-3) just
    // flew around and never closed to within range, so they "не атаковали". 560 lets them
    // actually engage while staying shorter than hunters (740). They're still weak: low
    // damage (0.55×), slow trigger (0.55×) and sloppy ±36° aim.
    fireRange: 560,
    leadFactor: 0,
    turnDeadzoneRad: 0.25,
    reactionDelaySec: 0.38,
    errorWobbleRad: 0.08,
    evasionChanceWhenHit: 0.3,
    evasionStrengthRad: 0.4,          // sloppy, half-hearted jink
    evasionDurationSec: 0.6,
    burstFire: false,                 // sprays continuously like a rookie
    burstOnSec: 0,
    burstOffSec: 0,
    tailStandoffPx: 200,              // presses a bit closer now (more aggressive)
    overshootDistancePx: 130,
    pressAttackThrottle: 1.0,
    manageThrottle: false,            // always full → climbs into stalls
    cruiseThrottle: 1.0,
    diveThrottle: 1.0,
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0.3,   // less goofy — comes after you more
    ejectChancePerSec: 0.3,           // rarely bails, dies in plane
    hpMultiplier: 0.7,                 // fragile — goes down quickly
    damageMultiplier: 0.55,            // weak bullets
    fireRateMultiplier: 0.55,          // slow trigger finger
  },
  medium: {
    stallAvoidEnabled: true,
    groundClearance: 320,
    ceilingClearance: 120,
    postTakeoffStabilizationSec: 0.8,
    positioningEnabled: true,
    preferredAltitudeOffset: -10,
    energyManagement: true,           // now sets up on your TAIL instead of charging head-on
    fireConeRad: Math.PI / 5.4,       // ±33° — shoots a touch more eagerly
    fireRange: 740,
    leadFactor: 0.72,
    turnDeadzoneRad: 0.08,
    reactionDelaySec: 0.07,            // quicker — keeps the nose on you
    errorWobbleRad: 0.018,
    evasionChanceWhenHit: 1.0,
    evasionStrengthRad: 0.6,
    evasionDurationSec: 0.5,
    burstFire: true,                   // disciplined bursts — dangerous but readable
    burstOnSec: 0.85,
    burstOffSec: 0.1,
    tailStandoffPx: 175,               // sets up CLOSE behind you — real tail pressure
    overshootDistancePx: 185,
    pressAttackThrottle: 1.0,
    manageThrottle: true,
    cruiseThrottle: 1.0,
    diveThrottle: 0.8,
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0,    // competent — sloppy mistakes (incl. diving at the dirt) are an EASY-tier flavor only
    ejectChancePerSec: 1.5,
    hpMultiplier: 1.5,                 // moderately tougher than player baseline
    damageMultiplier: 1.1,             // bullets bite a touch harder
    fireRateMultiplier: 1.3,           // shoots a bit faster
  },
  hard: {
    // Ace. Manages energy, predicts player, rarely crashes, bails when burning.
    stallAvoidEnabled: true,
    groundClearance: 350,             // pulls up with lots of margin
    ceilingClearance: 180,
    postTakeoffStabilizationSec: 0.7, // quick setup, then pressure
    positioningEnabled: true,
    preferredAltitudeOffset: -120,    // aggressively positions above player
    energyManagement: true,           // dives for speed before climbing
    fireConeRad: Math.PI / 7,         // ±26°
    fireRange: 880,
    leadFactor: 0.95,
    turnDeadzoneRad: 0.04,
    reactionDelaySec: 0.04,           // basically instant
    errorWobbleRad: 0.005,
    evasionChanceWhenHit: 2.0,        // pre-evades when in danger
    evasionStrengthRad: 0.9,          // hard, committed jink — hard to track
    evasionDurationSec: 0.45,         // short so it snaps back onto your tail
    burstFire: true,                  // ace-style controlled bursts
    burstOnSec: 0.8,
    burstOffSec: 0.1,
    tailStandoffPx: 205,              // aces sit right on your six
    overshootDistancePx: 230,
    pressAttackThrottle: 1.0,
    manageThrottle: true,
    cruiseThrottle: 1.0,
    diveThrottle: 0.68,               // controlled dives
    climbThrottle: 1.0,
    rookieMistakeChancePerSec: 0,
    ejectChancePerSec: 3.0,           // always bails when burning
    // Per spec §8: the smart positioning + lead is now the threat, so the raw
    // stat bonuses are eased back from before (HP 2.5→2.0, fireRate 1.8→1.5).
    hpMultiplier: 2.0,                 // tough but no longer a flying brick
    damageMultiplier: 1.8,             // bullets bite hard
    fireRateMultiplier: 1.75,          // later rounds must feel more dangerous than round one
  },
};

export function aiParamsForRole(difficulty: Difficulty, role: AiRole = 'chase-player'): AiParams {
  const base = DIFFICULTIES[difficulty];
  switch (role) {
    case 'rookie':
      return {
        ...DIFFICULTIES.easy,
        hpMultiplier: Math.min(base.hpMultiplier, DIFFICULTIES.easy.hpMultiplier),
      };
    case 'hunter':
      return {
        ...base,
        positioningEnabled: true,
        energyManagement: true, // hunters now work for your tail too (was a straight chaser)
        reactionDelaySec: Math.min(base.reactionDelaySec, DIFFICULTIES.medium.reactionDelaySec),
      };
    case 'ace':
      return {
        ...base,
        positioningEnabled: true,
        energyManagement: true,
        reactionDelaySec: Math.min(base.reactionDelaySec, 0.055),
        errorWobbleRad: Math.min(base.errorWobbleRad, 0.012),
        fireRange: Math.max(base.fireRange, 820),
        leadFactor: Math.max(base.leadFactor, 0.9),
        hpMultiplier: Math.min(base.hpMultiplier * 1.04, DIFFICULTIES.hard.hpMultiplier),
      };
    case 'boss':
      return {
        ...DIFFICULTIES.hard,
        fireRange: Math.max(DIFFICULTIES.hard.fireRange, 980),
        burstOnSec: 0.82,
        burstOffSec: 0.12,
        hpMultiplier: DIFFICULTIES.hard.hpMultiplier,
      };
    case 'attack-caravan':
    case 'chase-player':
    default:
      return base;
  }
}
