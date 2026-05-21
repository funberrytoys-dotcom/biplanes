// === Plane physics (60Hz tick, 4000-px world, calibrated from BT Biplanes) ===
export const G_MAX_LEVEL = 1220;      // px/sec, scalar speed cap in level flight
export const G_MAX_DIVE = 1710;       // px/sec, cap when diving
export const G_STALL = 1120;          // px/sec, below this -> stall sink kicks in
export const THRUST_ACCEL_MAX = 2500; // px/sec², at horizontal (h=90° BT or 0° standard)
export const PITCH_BLEED_MAX = 1250;  // px/sec², speed bleed when nose fully vertical
export const STALL_SINK_MAX = 1220;   // px/sec, downward push when g=0
export const DRAG_COEFFICIENT = 0.05; // fractional speed loss per second
export const PLANE_TURN_RATE = 3.5;   // radians/sec when rotate input held (was discrete 16 steps in 100ms)

// === Existing tunables — KEEP unless physics-related ===
export const PLANE_INITIAL_HP = 100;
export const ENEMY_INITIAL_HP_LIGHT = 30;
export const ENEMY_INITIAL_HP_HEAVY = 90;
export const BULLET_SPEED = 1500;            // bumped to match new plane speeds
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
export const TAKEOFF_LIFTOFF_SPEED = 900;     // px/sec required to leave runway (above G_STALL → no immediate stall-sink crash)
export const TAKEOFF_LIFTOFF_PITCH = 0.2;     // radians of nose-up required to leave runway
export const TAKEOFF_ROLL_ACCEL = 900;        // px/sec² ground roll acceleration (~1.0s to liftoff speed)
export const CRASH_VY_THRESHOLD = 100;        // px/sec downward velocity needed to crash

