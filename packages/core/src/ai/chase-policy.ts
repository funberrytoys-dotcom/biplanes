import type { PlayerCommand } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';

const FIRE_RANGE = 600;
const FIRE_CONE = Math.PI / 6; // ±30°
const TURN_DEADZONE = 0.08;    // radians

export function chasePolicy(self: Plane, target: Plane): PlayerCommand {
  const dx = target.kinematic.position.x - self.kinematic.position.x;
  const dy = target.kinematic.position.y - self.kinematic.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - self.kinematic.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  let rotate: -1 | 0 | 1 = 0;
  if (diff > TURN_DEADZONE) rotate = 1;
  else if (diff < -TURN_DEADZONE) rotate = -1;

  const inCone = Math.abs(diff) < FIRE_CONE;
  const inRange = distance < FIRE_RANGE;
  const fire = inCone && inRange;

  return { rotate, fire, bomb: false };
}
