export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AiParams {
  // Aim & combat
  fireConeRad: number;         // half-angle of acceptable firing arc (radians)
  fireRange: number;           // max distance to fire
  leadFactor: number;          // 0 = no lead, 1 = perfect lead based on target velocity
  turnDeadzoneRad: number;     // how close to perfect heading before AI stops correcting
  // Reaction
  reactionDelaySec: number;    // command lag — AI sees stale player state by N seconds
  // Survival
  groundAvoidY: number;        // y threshold below which AI prioritizes pulling up
  ceilingAvoidY: number;       // y threshold above which AI eases off climb
  collisionAvoidDist: number;  // if within this distance to player head-on, AI swerves
  // Personality
  evasionChanceWhenHit: number;// 0..1 probability of starting an evasion maneuver per second when damaged
  errorWobbleRad: number;      // random rotation noise per tick (Easy = high, Hard = low)
}

export const DIFFICULTIES: Record<Difficulty, AiParams> = {
  easy: {
    fireConeRad: Math.PI / 4,       // ±45° — sloppy aim
    fireRange: 350,                 // shorter range — won't snipe from far
    leadFactor: 0.0,                // no leading — shoots at current position
    turnDeadzoneRad: 0.2,           // wide deadzone — corrects slowly
    reactionDelaySec: 0.4,          // 400ms reaction lag
    groundAvoidY: 600,              // out of 990 — starts pulling up only when very low
    ceilingAvoidY: 200,             // starts caring at y=200
    collisionAvoidDist: 80,         // only swerves when very close
    evasionChanceWhenHit: 0.5,      // 50%/sec chance to evade — sometimes
    errorWobbleRad: 0.06,           // visible wobble
  },
  medium: {
    fireConeRad: Math.PI / 6,       // ±30°
    fireRange: 550,
    leadFactor: 0.4,                // partial lead
    turnDeadzoneRad: 0.1,
    reactionDelaySec: 0.15,         // 150ms
    groundAvoidY: 750,
    ceilingAvoidY: 150,
    collisionAvoidDist: 140,
    evasionChanceWhenHit: 1.0,      // always evades when shot
    errorWobbleRad: 0.025,
  },
  hard: {
    fireConeRad: Math.PI / 9,       // ±20° — tight aim
    fireRange: 750,                 // longer reach
    leadFactor: 0.85,               // strong lead
    turnDeadzoneRad: 0.05,
    reactionDelaySec: 0.03,         // near-instant
    groundAvoidY: 850,              // climbs out of trouble early
    ceilingAvoidY: 100,             // hugs the ceiling without scraping
    collisionAvoidDist: 200,        // swerves with margin
    evasionChanceWhenHit: 1.5,      // always evades, sometimes pre-evades
    errorWobbleRad: 0.01,           // almost no noise
  },
};
