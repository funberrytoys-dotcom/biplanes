import type { MissionOnePhase } from './mission-one-controller.js';

export interface FirstSortieGuidanceInput {
  phase: MissionOnePhase;
  timeSec: number;
  playerStalling: boolean;
  recoveredFromStall: boolean;
  firedOnce: boolean;
  playerScore: number;
  pendingLevelUp: boolean;
  choicesShowing: boolean;
  boostActive: boolean;
  boostHeat: number;
  noThrottleSec: number;
}

export interface FirstUpgradeBriefingInput {
  runMode: string;
  pendingLevelUp: boolean;
  choicesShowing: boolean;
  alreadyShown: boolean;
}

const PHASE_GUIDANCE: Record<MissionOnePhase, string> = {
  briefing: 'ПОДГОТОВЬСЯ К ВЫЛЕТУ',
  launch: 'ДАЙ ГАЗ И ОТОРВИСЬ ОТ ПАЛУБЫ',
  reveal: 'НАБЕРИ СКОРОСТЬ И ДОГОНИ КАРАВАН',
  escort: 'ЗАЩИЩАЙ КАРАВАН',
  ambush: 'ПЕРЕХВАТИ ОХОТНИКОВ',
  boss: 'ПРОГОНИ ШРАМА ОТ МАЯКА',
  victory: 'КАРАВАН СПАСЕН',
  failure: 'МИССИЯ ПРОВАЛЕНА',
};

export function resolveFirstSortieGuidance(input: FirstSortieGuidanceInput): string {
  if (input.phase === 'victory' || input.phase === 'failure') {
    return PHASE_GUIDANCE[input.phase];
  }

  if (input.playerStalling) {
    return 'СРЫВ - ПИКИРУЙ И ВЕРНИ СКОРОСТЬ';
  }

  if (input.boostActive && input.boostHeat >= 0.72) {
    return 'ОТПУСТИ ФОРСАЖ - МОТОР ГРЕЕТСЯ';
  }

  if (input.noThrottleSec >= 2.0) {
    return 'ДАЙ ГАЗ - МОТОР ГЛОХНЕТ';
  }

  if (input.pendingLevelUp || input.choicesShowing) {
    return 'ВЫБЕРИ ПЕРВЫЙ АПГРЕЙД';
  }

  if (input.phase === 'launch' && input.timeSec < 8) {
    return PHASE_GUIDANCE.launch;
  }

  if (input.phase === 'reveal' && input.timeSec >= 16 && input.boostHeat < 0.45) {
    return 'ЗАЖМИ ФОРСАЖ, ЧТОБЫ ДОГНАТЬ КАРАВАН';
  }

  if (input.phase === 'reveal') {
    return PHASE_GUIDANCE.reveal;
  }

  if (input.recoveredFromStall && !input.firedOnce && input.playerScore === 0) {
    return 'ВЫРОВНЯЙ НОС И ОТКРОЙ ОГОНЬ';
  }

  return PHASE_GUIDANCE[input.phase];
}

export function shouldShowFirstUpgradeBriefing(input: FirstUpgradeBriefingInput): boolean {
  return input.runMode === 'story'
    && input.pendingLevelUp
    && !input.choicesShowing
    && !input.alreadyShown;
}
