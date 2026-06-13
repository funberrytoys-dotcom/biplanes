import { G_MAX_LEVEL } from '@biplanes/shared';

export type AudioWarning = 'stall' | 'engine' | 'overheat' | null;

export interface FlightAudioInput {
  gameRunning: boolean;
  choicesShowing: boolean;
  playerAlive: boolean;
  playerState: string;
  speed: number;
  verticalVelocity: number;
  throttleLevel: number;
  boostActive: boolean;
  boostHeat: number;
  noThrottleSec: number;
  stalling: boolean;
}

export interface FlightAudioMix {
  engineGain: number;
  engineRate: number;
  boostGain: number;
  diveGain: number;
  warning: AudioWarning;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function resolveFlightAudioMix(input: FlightAudioInput): FlightAudioMix {
  const activePlane = input.gameRunning
    && !input.choicesShowing
    && input.playerAlive
    && (input.playerState === 'flying' || input.playerState === 'taxi');

  if (!activePlane) {
    return {
      engineGain: 0,
      engineRate: 0.8,
      boostGain: 0,
      diveGain: 0,
      warning: null,
    };
  }

  const throttle = clamp01(input.throttleLevel);
  const speedK = clamp01(input.speed / G_MAX_LEVEL);
  const diveK = clamp01((input.verticalVelocity - 260) / 520);
  const taxiLift = input.playerState === 'taxi' ? 0.06 : 0;
  const strain = input.boostHeat > 0.7 ? (input.boostHeat - 0.7) / 0.3 : 0;
  const engineGain = 0.08 + taxiLift * 0.55 + throttle * 0.12 + speedK * 0.08 + strain * 0.03;
  const engineRate = 0.78 + throttle * 0.12 + speedK * 0.1 + strain * 0.03;
  const boostGain = input.boostActive ? 0.28 + strain * 0.08 : 0;
  const diveGain = diveK * 0.48;
  let warning: AudioWarning = null;

  if (input.stalling) {
    warning = 'stall';
  } else if (input.boostActive && input.boostHeat >= 0.72) {
    warning = 'overheat';
  } else if (input.noThrottleSec >= 2) {
    warning = 'engine';
  }

  return {
    engineGain,
    engineRate,
    boostGain,
    diveGain,
    warning,
  };
}
