import type { EntityId, Vec2 } from '@biplanes/shared';
import { XP_PICKUP_MAGNET_RANGE, WORLD_WIDTH } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Bullet } from '../entities/bullet.js';
import type { Pilot } from '../entities/pilot.js';
import type { Bomb } from '../entities/bomb.js';
import type { Rocket } from '../entities/rocket.js';
import type { Difficulty } from '../ai/difficulty.js';
import type { AiState } from '../ai/chase-policy.js';
import type { PlaneCollisionEvent } from '../systems/plane-collision.js';
import type { Pickup, PickupKind, SupplyBalloon } from '../entities/pickup.js';

/** Decorative score-blimp that drifts slowly across the sky. */
export interface Blimp {
  position: Vec2;
  velocity: Vec2;
}

export interface CaravanState {
  active: boolean;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  incomingDamageMultiplier?: number;
}

export interface WorldState {
  timeSec: number;          // wall clock since run started
  tickCount: number;
  worldWidth?: number;
  worldHeight?: number;
  /** Which faction the player is flying — 'jackals' switches to the heavy-brawler gun
   *  (slow fat slugs, smaller mag, harder recoil, stronger rockets). Default С.О.В. */
  playerFaction?: 'sov' | 'jackals';
  disableAutoEnemySpawn?: boolean;
  // Campaign: no lethal ground. The bottom of the map turns the plane back like
  // the ceiling instead of crashing it.
  softFloor?: boolean;
  caravan?: CaravanState;
  // Weather gust vector (px/sec) pushed onto flying planes. Set by the host from
  // the current arena weather. Zero = calm.
  wind?: Vec2;
  nextEntityId: EntityId;
  rngSeed: number;
  rngState: number;         // current PRNG state (for replay)

  player: Plane;
  enemies: Plane[];
  // «Ведомый» — AI-flown ally planes that fly the player's wing, pick their own
  // targets, and are MORTAL (no in-round respawn). The host clears them between
  // rounds; `wingmanCount` is how many to (re)launch each round. NOT companion
  // drones — see [[feedback-wingmen-are-ai-planes]].
  allies: Plane[];
  bullets: Bullet[];
  bombs: Bomb[];
  rockets: Rocket[];

  // === Supply balloons & collectible pickups ===
  balloons: SupplyBalloon[];
  pickups: Pickup[];
  rapidFireSec: number;     // >0 while a 'boost' pickup's rapid-fire is active
  // Transient per-tick events (replaced each tick) for render VFX + audio.
  balloonPopEvents: Vec2[];
  pickupCollectEvents: { position: Vec2; kind: PickupKind }[];

  // Ejected pilots — one per faction at most. Empty when no one ejected.
  pilots: Pilot[];
  // Time elapsed (sec) since the PLAYER pilot was spawned; used to compute the
  // PLANE_RESPAWN_AFTER_PILOT_DEATH timer for the player plane.
  pilotEjectTimeSec: number;

  // Scores — kills credited per faction (i.e. enemy pilots killed by player → playerScore++).
  playerScore: number;
  enemyScore: number;

  // Decorative score blimp drifting slowly across the upper sky.
  blimp: Blimp;

  xpCollected: number;
  level: number;
  pendingLevelUp: boolean;  // true between earning level-up and choosing upgrade
  /** Arena/run hosts award picks between waves; level-up must not pause combat mid-wave. */
  suppressCoreLevelUps?: boolean;
  /** Host-managed modes (e.g. 15-wave run) decide victory outside the core score cap. */
  suppressScoreGameOver?: boolean;

  appliedUpgradeIds: string[];      // chronological list of upgrade IDs picked
  damageMultiplier: number;         // 1.0 base, multiplies bullet damage
  fireRateMultiplier: number;       // 1.0 base, divides cooldown
  hpMultiplier: number;             // 1.0 base, multiplies max HP on apply
  boostHeatMultiplier: number;      // <1 means boost heats slower
  boostCoolingMultiplier: number;   // >1 means boost cools faster
  boostPowerMultiplier: number;     // >1 means boost pushes harder
  collisionDamageMultiplier: number;// <1 means rams are less lethal
  xpMagnetRange: number;            // base XP_PICKUP_MAGNET_RANGE (legacy, unused)
  hpRegenPerSec: number;            // passive HP regen/sec while flying (field_repair upgrade)
  hasDrone: boolean;                // legacy flag — true when droneCount > 0
  droneCount: number;               // number of С.О.В. companion drones (orbit + auto-fire)
  wingmanCount: number;             // number of Jackal «Ведомый» ally planes to keep launched per round
  hasHomingRockets: boolean;
  hasFlameTrail: boolean;
  hasHeavyCannon: boolean;
  multishotExtra: number;           // extra bullets per shot (0 = single)
  lifestealPerKill: number;         // HP restored per enemy killed
  salvoCooldownMultiplier: number;  // <1 = faster rocket salvo
  homingRocketTimer: number;
  droneTimer: number;

  explosionEvents: Vec2[];

  gameOver: boolean;



  // === AI difficulty ===
  difficulty: Difficulty;
  // NOTE: These maps are mutated in-place during tick() for prototype-grade
  // simplicity. AI state is not in the determinism-critical path (it's an
  // implementation detail of enemy behavior), so we trade strict immutability
  // for less allocation churn. If we ever want full determinism on AI, switch
  // to immutable Map.set() rebuild here.
  enemyAiStates: Map<number, AiState>;   // enemyId -> state
  allyAiStates: Map<number, AiState>;    // allyId -> state (Jackal «Ведомый» wingmen)
  prevEnemyHp: Map<number, number>;      // for hit detection

  // === Plane-vs-plane collision (Phase 5) ===
  // Per-pair cooldowns (tick counts) so a single brush doesn't retrigger every frame
  // while still inside the collision radius.
  planeCollisionCooldowns: Map<string, number>;
  // Events emitted DURING the current tick — replaced each tick (not accumulated).
  // Render reads these for VFX (sparks, shake, hit-pause, RAM notice).
  planeCollisionEvents: PlaneCollisionEvent[];
}

export function createWorldState(seed: number, player: Plane): WorldState {
  return {
    timeSec: 0,
    tickCount: 0,
    worldWidth: undefined,
    worldHeight: undefined,
    caravan: undefined,
    nextEntityId: player.id + 1,
    rngSeed: seed,
    rngState: seed,
    player,
    enemies: [],
    allies: [],
    bullets: [],
    bombs: [],
    rockets: [],
    balloons: [],
    pickups: [],
    rapidFireSec: 0,
    balloonPopEvents: [],
    pickupCollectEvents: [],
    pilots: [],
    pilotEjectTimeSec: 0,
    playerScore: 0,
    enemyScore: 0,
    blimp: {
      position: { x: WORLD_WIDTH / 2, y: 200 },
      velocity: { x: 30, y: 0 },
    },
    xpCollected: 0,
    level: 1,
    pendingLevelUp: false,
    appliedUpgradeIds: [],
    damageMultiplier: 1,
    fireRateMultiplier: 1,
    hpMultiplier: 1,
    boostHeatMultiplier: 1,
    boostCoolingMultiplier: 1,
    boostPowerMultiplier: 1,
    collisionDamageMultiplier: 1,
    xpMagnetRange: XP_PICKUP_MAGNET_RANGE,
    hpRegenPerSec: 0,
    hasDrone: false,
    droneCount: 0,
    wingmanCount: 0,
    hasHomingRockets: false,
    hasFlameTrail: false,
    hasHeavyCannon: false,
    multishotExtra: 0,
    lifestealPerKill: 0,
    salvoCooldownMultiplier: 1,
    homingRocketTimer: 0,
    droneTimer: 0,
    explosionEvents: [],
    gameOver: false,


    difficulty: 'medium',
    enemyAiStates: new Map(),
    allyAiStates: new Map(),
    prevEnemyHp: new Map(),
    planeCollisionCooldowns: new Map(),
    planeCollisionEvents: [],
  };
}
