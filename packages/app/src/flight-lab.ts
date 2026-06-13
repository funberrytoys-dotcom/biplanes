import { G_MAX_LEVEL } from '@biplanes/shared';
import type { Plane, PlaneKinematic } from '@biplanes/core';

export type FlightLabCue =
  | 'GAS'
  | 'CLIMB UNTIL STALL'
  | 'STALL - DIVE'
  | 'RECOVERED - FIRE'
  | 'DRILL COMPLETE';

export interface FlightLabCueInput {
  planeState: Plane['state'];
  throttleLevel: number;
  speed: number;
  isStalling: boolean;
  recoveredFromStall: boolean;
  firedAfterRecovery: boolean;
}

export function resolveFlightLabSpawn(worldWidth: number, worldHeight: number): PlaneKinematic {
  const heading = 0;
  const speed = G_MAX_LEVEL * 0.72;
  return {
    position: { x: Math.round(worldWidth / 2), y: Math.round(worldHeight / 2 + 80) },
    velocity: { x: speed, y: 0 },
    heading,
    throttleOn: true,
    g: speed,
    facing: 1,
    throttle: true,
    throttleLevel: 0.65,
  };
}

export function resolveFlightLabCue(input: FlightLabCueInput): FlightLabCue {
  if (input.firedAfterRecovery) return 'DRILL COMPLETE';
  if (input.recoveredFromStall) return 'RECOVERED - FIRE';
  if (input.isStalling) return 'STALL - DIVE';
  if (input.throttleLevel < 0.35 || input.speed < G_MAX_LEVEL * 0.45) return 'GAS';
  return 'CLIMB UNTIL STALL';
}
