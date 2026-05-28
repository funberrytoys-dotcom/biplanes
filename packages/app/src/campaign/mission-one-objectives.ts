import type { MissionOnePhase } from './mission-one-controller.js';

const OBJECTIVE_TEXT: Record<MissionOnePhase, string> = {
  briefing: 'ПОДГОТОВЬСЯ К ВЫЛЕТУ',
  launch: 'ВЗЛЕТИ С АВИАНОСЦА',
  reveal: 'ДОГОНИ КАРАВАН',
  escort: 'ЗАЩИЩАЙ КАРАВАН',
  ambush: 'ПЕРЕХВАТИ ОХОТНИКОВ',
  boss: 'ПРОГОНИ ШРАМА',
  victory: 'КАРАВАН СПАСЕН',
  failure: 'МИССИЯ ПРОВАЛЕНА',
};

export function getMissionOneObjectiveText(phase: MissionOnePhase): string {
  return OBJECTIVE_TEXT[phase];
}
