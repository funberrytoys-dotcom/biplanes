export type EntityId = number;

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerCommand {
  rotate: -1 | 0 | 1;       // -1 = CCW, 0 = none, 1 = CW
  fire: boolean;
  bomb: boolean;
  special?: boolean;         // air special weapon (rocket salvo) — dedicated button / key
  boost?: boolean;
  throttleDelta: -1 | 0 | 1; // -1 = decrease throttle, 0 = hold, +1 = increase
  throttleTarget?: number | null; // 0..1 absolute throttle set by a slider/lever; null = use throttleDelta
  eject: boolean;            // E key — player only, leave plane via parachute
  jump: boolean;             // Space — when controlling pilot on ground, do a short hop
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
