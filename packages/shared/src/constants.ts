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
export const THROTTLE_CHANGE_RATE = 1.5; // throttle units/sec (full sweep 0→1 in ~0.67s)

// === Existing tunables — KEEP unless physics-related ===
export const PLANE_INITIAL_HP = 100;
export const ENEMY_INITIAL_HP_LIGHT = 30;
export const ENEMY_INITIAL_HP_HEAVY = 90;
export const BULLET_SPEED = 1000;            // px/sec (~1.5× max plane level speed)
export const BULLET_LIFETIME = 1.2;
export const MACHINE_GUN_COOLDOWN = 0.12;
export const MACHINE_GUN_DAMAGE = 10;
export const XP_PER_KILL_LIGHT = 5;
export const XP_PER_KILL_HEAVY = 12;
export const XP_PICKUP_MAGNET_RANGE = 120;
export const XP_PICKUP_ABSORB_RANGE = 30;
export const LEVEL_UP_THRESHOLDS = [10, 25, 50, 90, 150, 230, 330, 450];
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
export const PILOT_HANGAR_ARRIVAL_DIST = 50;   // distance to RUNWAY_X that counts as "safe"
export const PILOT_DEATH_DURATION = 2.0;       // sec on ground before pilot is cleaned up
export const PLANE_RESPAWN_AFTER_PILOT_DEATH = 5.0; // total sec since eject for plane respawn after pilot death

