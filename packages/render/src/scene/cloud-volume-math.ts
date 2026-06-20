export interface CloudContactInput {
  planeX: number;
  planeY: number;
  planeVx: number;
  planeVy: number;
  bankX: number;
  bankY: number;
  bankWidth: number;
  bankHeight: number;
  front: boolean;
}

export interface CloudContact {
  strength: number;
  propWash: number;
  speed: number;
  dirX: number;
  dirY: number;
  sideX: number;
  sideY: number;
}

export interface CloudReadabilityAlphaInput {
  baseAlpha: number;
  contactStrength: number;
  front: boolean;
  propPulse: number;
  ambientPulse: number;
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function smooth01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function resolveCloudContact(input: CloudContactInput): CloudContact {
  const speed = Math.hypot(input.planeVx, input.planeVy);
  const dirX = speed > 0.001 ? input.planeVx / speed : 1;
  const dirY = speed > 0.001 ? input.planeVy / speed : 0;
  const sideX = -dirY;
  const sideY = dirX;

  const dx = input.planeX - input.bankX;
  const dy = input.planeY - input.bankY;
  const rx = input.bankWidth * (input.front ? 0.44 : 0.48);
  const ry = input.bankHeight * (input.front ? 0.42 : 0.46);
  const distance = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  const strength = smooth01(1 - distance);
  const speedFactor = clamp01((speed - 80) / 520);
  const propWash = strength * speedFactor;

  return {
    strength,
    propWash,
    speed,
    dirX,
    dirY,
    sideX,
    sideY,
  };
}

export function resolveCloudReadabilityAlpha(input: CloudReadabilityAlphaInput) {
  const contact = clamp01(input.contactStrength);
  const propLift = input.front ? input.propPulse * 0.08 : input.propPulse * 0.04;
  // Thin out harder when the plane is inside — you punch a clearer hole through it.
  const readabilityPocket = input.front ? contact * 0.55 : contact * 0.12;
  const floor = input.front ? 0.16 : 0.14;

  return Math.max(
    floor,
    Math.min(0.76, input.baseAlpha + propLift + input.ambientPulse - readabilityPocket),
  );
}
