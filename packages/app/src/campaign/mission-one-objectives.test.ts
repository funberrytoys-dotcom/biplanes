import { describe, expect, it } from 'vitest';
import { getMissionOneObjectiveText } from './mission-one-objectives.js';

describe('mission one objective text', () => {
  it('gives the player a clear action for each mission phase', () => {
    expect(getMissionOneObjectiveText('launch')).toBe('ВЗЛЕТИ С АВИАНОСЦА');
    expect(getMissionOneObjectiveText('reveal')).toBe('ДОГОНИ КАРАВАН');
    expect(getMissionOneObjectiveText('escort')).toBe('ЗАЩИЩАЙ КАРАВАН');
    expect(getMissionOneObjectiveText('ambush')).toBe('ПЕРЕХВАТИ ОХОТНИКОВ');
    expect(getMissionOneObjectiveText('boss')).toBe('ПРОГОНИ ШРАМА');
    expect(getMissionOneObjectiveText('victory')).toBe('КАРАВАН СПАСЕН');
    expect(getMissionOneObjectiveText('failure')).toBe('МИССИЯ ПРОВАЛЕНА');
  });
});
