export type MissionOneFrameGate = 'tick' | 'pause' | 'open-upgrade';

export interface MissionOneFrameGateInput {
  choicesShowing: boolean;
  pendingLevelUp: boolean;
}

export function resolveMissionOneFrameGate(input: MissionOneFrameGateInput): MissionOneFrameGate {
  if (input.choicesShowing) return 'pause';
  if (input.pendingLevelUp) return 'open-upgrade';
  return 'tick';
}
