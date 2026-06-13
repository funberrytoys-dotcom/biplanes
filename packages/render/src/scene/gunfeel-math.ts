export interface GunfeelShotInput {
  ownerFaction: 'player' | 'enemy';
  headingRad: number;
  isHeavy?: boolean;
}

export interface GunfeelShot {
  flashScale: number;
  flashDuration: number;
  tracerScale: number;
  tracerDuration: number;
  cameraShake: number;
  cameraPunch: number;
  zoomPunch: number;
  recoil: { x: number; y: number };
  casingCount: number;
  sparkCount: number;
}

export interface GunfeelImpactInput {
  incomingHeadingRad: number;
  isHeavy?: boolean;
  killed?: boolean;
}

export interface ImpactCameraInput {
  targetFaction: 'player' | 'enemy';
  killed: boolean;
}

export interface GunfeelImpact {
  sparkCount: number;
  flashRadius: number;
  cameraShake: number;
  cameraPunch: number;
  zoomPunch: number;
  hitPauseFrames: number;
  sparkDirection: { x: number; y: number };
}

export function resolveGunfeelShot(input: GunfeelShotInput): GunfeelShot {
  const isPlayer = input.ownerFaction === 'player';
  const heavy = input.isHeavy === true;
  const power = heavy ? 1.85 : 1;
  const playerBias = isPlayer ? 1 : 0.42;
  const recoilAmount = (heavy ? 8.6 : 4.8) * playerBias;
  const cos = Math.cos(input.headingRad);
  const sin = Math.sin(input.headingRad);

  return {
    flashScale: (isPlayer ? 1.45 : 1.05) * power,
    flashDuration: heavy ? 0.16 : 0.12,
    tracerScale: (isPlayer ? 1.45 : 1.08) * (heavy ? 1.45 : 1),
    tracerDuration: heavy ? 0.2 : 0.15,
    cameraShake: (heavy ? 5.4 : 2.8) * playerBias,
    cameraPunch: (heavy ? 10 : 5.5) * playerBias,
    zoomPunch: heavy ? 1.032 : 1.017,
    recoil: {
      x: -cos * recoilAmount,
      y: -sin * recoilAmount,
    },
    casingCount: heavy ? 2 : 1,
    sparkCount: heavy ? 6 : 2,
  };
}

export function resolveGunfeelImpact(input: GunfeelImpactInput): GunfeelImpact {
  const heavy = input.isHeavy === true;
  const killed = input.killed === true;
  const heavyK = heavy ? 1.55 : 1;
  const killK = killed ? 1.6 : 1;
  const cos = Math.cos(input.incomingHeadingRad);
  const sin = Math.sin(input.incomingHeadingRad);

  return {
    sparkCount: Math.round(12 * heavyK * killK),
    flashRadius: 11 * heavyK * (killed ? 1.25 : 1),
    cameraShake: 4.5 * heavyK * killK,
    cameraPunch: 4.2 * heavyK * (killed ? 1.35 : 1),
    zoomPunch: killed ? 1.045 : heavy ? 1.026 : 1.016,
    hitPauseFrames: killed ? 6 : heavy ? 4 : 3,
    sparkDirection: {
      x: cos,
      y: sin,
    },
  };
}

export function shouldApplyImpactCamera(input: ImpactCameraInput): boolean {
  return input.targetFaction === 'player' || input.killed;
}
