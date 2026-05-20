export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;

export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 2000;
export const GROUND_Y = WORLD_HEIGHT - 50;

export const PLANE_THRUST = 280;      // pixels/sec acceleration
export const PLANE_GRAVITY = 380;      // pixels/sec^2 downward
export const PLANE_TURN_RATE = 2.6;    // radians/sec at full input
export const PLANE_MAX_SPEED = 600;
export const PLANE_MIN_LIFT_SPEED = 80; // below this speed, lift collapses
export const PLANE_STALL_ANGLE = 1.2;   // radians; nose-up angle relative to velocity at which stall starts

export const PLANE_INITIAL_HP = 100;
export const ENEMY_INITIAL_HP_LIGHT = 30;
export const ENEMY_INITIAL_HP_HEAVY = 90;

export const BULLET_SPEED = 900;
export const BULLET_LIFETIME = 1.2;
export const MACHINE_GUN_COOLDOWN = 0.12;
export const MACHINE_GUN_DAMAGE = 10;

export const XP_PER_KILL_LIGHT = 5;
export const XP_PER_KILL_HEAVY = 12;
export const XP_PICKUP_MAGNET_RANGE = 120;
export const XP_PICKUP_ABSORB_RANGE = 30;

export const LEVEL_UP_THRESHOLDS = [
  10, 25, 50, 90, 150, 230, 330, 450,
];
