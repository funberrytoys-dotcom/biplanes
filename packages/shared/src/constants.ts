// === Plane physics (60Hz tick, 1920-px world, calibrated from BT Biplanes) ===
// v0.6 — slowed down ~45% for "feels less twitchy" per owner feedback
export const G_MAX_LEVEL = 680;       // px/sec, scalar speed cap in level flight
export const G_MAX_DIVE = 950;        // px/sec, cap when diving
export const G_STALL = 620;           // px/sec, below this -> stall sink kicks in
export const THRUST_ACCEL_MAX = 1400; // px/sec², at horizontal
export const PITCH_BLEED_MAX = 700;   // px/sec², speed bleed when nose fully vertical
export const STALL_SINK_MAX = 680;    // px/sec, downward push when g=0
export const DRAG_COEFFICIENT = 0.05; // fractional speed loss per second (scale-invariant)
export const PLANE_TURN_RATE = 2.2;   // radians/sec when rotate input held (was 3.5)
export const BOOST_SPEED_MULTIPLIER = 1.3;
export const BOOST_OVERHEAT_SEC = 4.0;
export const BOOST_COOL_SEC = 8.0;
export const NO_THROTTLE_STALL_SEC = 3.0;
export const THROTTLE_CHANGE_RATE = 1.5; // throttle units/sec (full sweep 0→1 in ~0.67s)

// === Existing tunables — KEEP unless physics-related ===
export const PLANE_INITIAL_HP = 100;
export const ENEMY_INITIAL_HP_LIGHT = 30;
export const ENEMY_INITIAL_HP_HEAVY = 90;
export const BULLET_SPEED = 1000;            // px/sec (~1.5× max plane level speed)
export const BULLET_LIFETIME = 1.2;
// Ballistics: a gentle lead/arc — noticeable but not punishing. (Halved from the
// first pass, which made hits too hard.)
export const BULLET_DRAG = 0.15;             // fractional speed loss per second
export const BULLET_GRAVITY = 110;           // px/sec² downward pull on bullets

// Magazine / reload
export const MAG_SIZE = 100;                 // shots per magazine
export const RELOAD_SEC = 10;                // seconds to reload an empty magazine
export const MACHINE_GUN_COOLDOWN = 0.12;
export const MACHINE_GUN_DAMAGE = 10;
// Airspeed (px/sec) bled from the player on every shot — you physically feel the
// gun braking the plane. Easily countered by throttle, so it reads as "weight",
// not a stall trap. (Mirrors the Godot reference's per-shot speed cost.)
export const FIRE_RECOIL_SPEED_LOSS = 3.5;
// Per-shot dispersion (rad): each bullet leaves the barrel at a slightly random
// angle, so the stream scatters (mostly vertically in level flight) instead of a
// laser-straight line — like the Godot build's spray.
export const BULLET_SPREAD_RAD = 0.035;
export const XP_PER_KILL_LIGHT = 5;
export const XP_PER_KILL_HEAVY = 12;
export const PLAYER_SCORE_TO_WIN = 15;
export const ENEMY_SCORE_TO_LOSE = 5;
export const XP_PICKUP_MAGNET_RANGE = 120;
export const XP_PICKUP_ABSORB_RANGE = 30;
export const LEVEL_UP_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const GROUND_Y = WORLD_HEIGHT - 90;   // 90 px reserved for ground+buildings strip
export const CEILING_Y = 0;
export const RUNWAY_X = 200;                  // takeoff spawn x
export const RUNWAY_Y = GROUND_Y;
export const RESPAWN_DELAY_SEC = 3.0;
export const TAKEOFF_LIFTOFF_SPEED = 500;     // px/sec required to leave runway (above G_STALL → no immediate stall-sink crash)
export const TAKEOFF_LIFTOFF_PITCH = 0.2;     // radians of nose-up required to leave runway
export const TAKEOFF_ROLL_ACCEL = 500;        // px/sec² ground roll acceleration (~1.0s to liftoff speed)
export const CRASH_VY_THRESHOLD = 60;         // px/sec downward velocity needed to crash

// === Damage progression (smoke / fire / explosion) ===
export const SMOKE_THRESHOLD = 0.5;            // fraction of maxHp at/below which smoke trail starts
export const FIRE_THRESHOLD = 0.25;            // fraction of maxHp at/below which fire starts
export const FIRE_BURN_RATE = 4;               // HP/sec extra decay while on fire

// === Pilot / parachute / hangar ===
export const PARACHUTE_FALL_SPEED = 80;        // px/sec downward
export const PARACHUTE_DRIFT_SPEED = 40;       // px/sec horizontal when steering
export const PILOT_WALK_SPEED = 100;           // px/sec walking on ground
export const PILOT_HANGAR_ARRIVAL_DIST = 50;   // distance to own-faction hangar that counts as "safe"
export const PILOT_DEATH_DURATION = 2.0;       // sec on ground before pilot is cleaned up
export const PLANE_RESPAWN_AFTER_PILOT_DEATH = 5.0; // total sec since eject for plane respawn after pilot death

// Pilot jump (Space when controlling pilot on ground)
export const PILOT_JUMP_VELOCITY = 380;        // initial upward velocity (px/sec), negative-y = up
export const PILOT_GRAVITY = 900;              // px/sec² downward while airborne
export const PILOT_JUMP_COOLDOWN = 0.45;       // sec between jumps

// Two hangars: player on the left at RUNWAY_X, enemy mirrored on the right.
export const PLAYER_HANGAR_X = RUNWAY_X;            // 200
export const ENEMY_HANGAR_X = WORLD_WIDTH - RUNWAY_X; // 1720
export const HANGAR_ARRIVAL_DIST = PILOT_HANGAR_ARRIVAL_DIST;

// === Bombs and Rockets ===
export const BOMB_GRAVITY = 500;              // px/sec² downward acceleration
export const BOMB_EXPLOSION_RADIUS = 120;     // px radius of AoE damage
export const BOMB_DAMAGE = 80;                // max damage at center of explosion
export const BOMB_COOLDOWN = 1.5;             // sec between bomb drops
export const BOMB_LIFETIME = 5.0;             // backup lifetime in seconds

export const ROCKET_SPEED = 500;              // px/sec speed
export const ROCKET_TURN_RATE = 2.0;          // radians/sec steering speed toward target
export const ROCKET_EXPLOSION_RADIUS = 80;    // px radius of homing rocket explosion
export const ROCKET_DAMAGE = 50;              // max damage at center
export const ROCKET_COOLDOWN = 3.0;           // auto-fire interval in seconds
export const ROCKET_LIFETIME = 4.0;           // rocket lifetime

// Enemy homing rockets (some enemies launch these at the player). Slower cadence +
// lighter than the player's so they're a telegraphed threat you dodge, not a death sentence.
export const ENEMY_ROCKET_COOLDOWN = 4.2;     // sec between an enemy's rocket launches
export const ENEMY_ROCKET_DAMAGE = 22;        // splash damage at center
export const ENEMY_ROCKET_RANGE = 1150;       // px — won't fire from farther than this

// === Wing rockets — the manual special weapon (visible, straight, hard-hitting) ===
// Two rockets ride under each wing. The special button fires one at a time; they
// fly STRAIGHT (no homing, no gravity) and hit much harder than bullets. They
// refill each arena round. "Ракетный блок" adds +2 to the rack.
export const WING_ROCKET_CAPACITY = 4;            // rockets mounted under the wings
export const WING_ROCKET_CAPACITY_BONUS = 2;      // extra from the rocket-pod upgrade
export const WING_ROCKET_DAMAGE = 70;             // direct-hit damage (vs ~10 per bullet)
export const WING_ROCKET_SPEED = 860;             // px/sec, flat trajectory
export const WING_ROCKET_LIFETIME = 1.6;          // sec before self-detonate
export const WING_ROCKET_COOLDOWN = 0.32;         // sec between launches
export const WING_ROCKET_BLAST_RADIUS = 78;       // splash radius on impact

// === Special weapon: manual rocket salvo ("Залп") — baseline, air-to-air ===
// Replaces the old gravity bomb. Fired on command.special with a cooldown.
export const SALVO_COOLDOWN = 2.6;            // sec between salvos
export const SALVO_BASE_COUNT = 3;            // rockets per salvo at baseline
export const SALVO_SPREAD = 0.34;             // total fan spread in radians
export const SALVO_ROCKET_SPEED = 620;        // launch speed (a touch faster than auto rockets)
export const SALVO_ROCKET_LIFETIME = 3.2;     // lifetime per salvo rocket

// === Field repair (repurposed XP-magnet upgrade) ===
export const HP_REGEN_PER_SEC = 3.5;          // HP/sec passive regen when 'field_repair' active

export const DRONE_COOLDOWN = 0.5;            // interval between drone shots
export const DRONE_DAMAGE = 5;                // damage per drone bullet
export const DRONE_RANGE = 400;               // range of drone shooting

export const HEAVY_CANNON_DAMAGE = 40;
export const HEAVY_CANNON_COOLDOWN = 0.6;
export const HEAVY_CANNON_PIERCE = 2;

// === Visual feel / VFX (Phase 0 of graphics+VFX spec) ===
// Hit-pause: number of render frames to freeze when bullet hits / kill / explode.
export const HIT_PAUSE_FRAMES_HIT = 4;
export const HIT_PAUSE_FRAMES_KILL = 8;
export const HIT_PAUSE_FRAMES_EXPLODE = 12;
export const HIT_PAUSE_FRAMES_RAM = 8;
export const HIT_PAUSE_FRAMES_RAM_KILL = 14;

// Slow-mo applied on player death (render-only).
export const SLOW_MO_SCALE = 0.35;
export const SLOW_MO_DURATION_SEC = 0.5;
export const SLOW_MO_RECOVERY_SEC = 0.2;

// Low-HP vignette threshold (fraction of maxHp).
export const LOW_HP_VIGNETTE_THRESHOLD = 0.25;

// Death-spin (Phase 4).
export const DYING_DURATION_SEC = 1.8;
export const DYING_SPIN_RATE = 5.0;            // rad/sec heading rotation
export const DYING_GRAVITY_MULTIPLIER = 1.8;

// === Supply balloons & pickups (collectible bonuses) ===
// A balloon carries a chest; shoot it to pop → it drops floating pickups the
// player grabs by flying near them. All in-tick randomness uses the seeded RNG.
export const SUPPLY_BALLOON_HP = 2;                // bullet hits to pop a balloon
export const SUPPLY_BALLOON_RADIUS = 36;           // px hit radius (balloon + chest)
export const SUPPLY_BALLOON_DRIFT = 24;            // px/sec base horizontal drift
export const SUPPLY_BALLOON_BOB_AMPLITUDE = 16;    // px vertical bob
export const SUPPLY_BALLOON_BOB_SPEED = 1.0;       // rad/sec bob
export const SUPPLY_DROP_MIN = 1;                  // pickups dropped per pop (min)
export const SUPPLY_DROP_MAX = 3;                  // pickups dropped per pop (max)
export const PICKUP_RADIUS = 42;                   // px collect radius (fly near to grab)
export const PICKUP_FALL_SPEED = 64;               // px/sec terminal descent of a dropped item
export const PICKUP_GRAVITY = 150;                 // px/sec² until terminal speed
export const PICKUP_LIFETIME = 11;                 // sec before an uncollected item fades
export const PICKUP_BOB_AMPLITUDE = 6;             // px sway while drifting down
export const PICKUP_BOB_SPEED = 3.2;               // rad/sec sway
export const PICKUP_AMMO_REFILL = MAG_SIZE;        // ammo pickup = a full magazine
export const PICKUP_REPAIR_FRACTION = 0.35;        // repair pickup = +35% of max HP
export const RAPIDFIRE_DURATION_SEC = 6;           // 'boost' pickup: rapid-fire window (sec)
export const RAPIDFIRE_MULTIPLIER = 2.2;           // fire-rate multiplier during rapid fire

// Plane-vs-plane collision (Phase 5). Reworked per balance council: a collision is a
// meaningful HIT but NEVER an instakill in one-life mode.
export const PLANE_COLLISION_RADIUS = 24;
export const COLLISION_DAMAGE_K = 0.06;        // per-plane dmg = closingSpeed(px/s) × K, then capped
export const COLLISION_MAX_HP_FRACTION = 0.22; // a single collision can take at most 22% of a plane's maxHp
export const COLLISION_MIN_DAMAGE = 14;        // floor so a graze still stings
export const COLLISION_COOLDOWN_TICKS = 30;    // 0.5s at 60 Hz — same pair can't re-hit within this
export const COLLISION_BOUNCE_VELOCITY_RETAIN = 0.6;
export const COLLISION_BOUNCE_HEADING_JITTER = 0.4;   // rad
