import { describe, expect, it } from 'vitest';
import { resolveFirstSortieGuidance, shouldShowFirstUpgradeBriefing } from './first-sortie-guidance.js';

function guidanceInput(overrides: Partial<Parameters<typeof resolveFirstSortieGuidance>[0]> = {}) {
  return {
    phase: 'escort' as const,
    timeSec: 40,
    playerStalling: false,
    recoveredFromStall: false,
    firedOnce: false,
    playerScore: 0,
    pendingLevelUp: false,
    choicesShowing: false,
    boostActive: false,
    boostHeat: 0,
    noThrottleSec: 0,
    ...overrides,
  };
}

describe('first sortie guidance', () => {
  it('teaches flight before combat pressure takes over', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      phase: 'launch',
      timeSec: 1,
    }))).toBe('ДАЙ ГАЗ И ОТОРВИСЬ ОТ ПАЛУБЫ');

    expect(resolveFirstSortieGuidance(guidanceInput({
      phase: 'reveal',
      timeSec: 15,
    }))).toBe('НАБЕРИ СКОРОСТЬ И ДОГОНИ КАРАВАН');
  });

  it('teaches boost before the first dogfight settles into escort', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      phase: 'reveal',
      timeSec: 18,
      boostHeat: 0.1,
    }))).toBe('ЗАЖМИ ФОРСАЖ, ЧТОБЫ ДОГНАТЬ КАРАВАН');
  });

  it('warns that boost heat must be released before engine failure', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      boostActive: true,
      boostHeat: 0.78,
    }))).toBe('ОТПУСТИ ФОРСАЖ - МОТОР ГРЕЕТСЯ');
  });

  it('warns that long zero throttle will drop the plane into a spin', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      noThrottleSec: 2.2,
    }))).toBe('ДАЙ ГАЗ - МОТОР ГЛОХНЕТ');
  });

  it('prioritizes stall recovery over ordinary mission objectives', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      playerStalling: true,
      firedOnce: true,
      playerScore: 1,
    }))).toBe('СРЫВ - ПИКИРУЙ И ВЕРНИ СКОРОСТЬ');
  });

  it('asks for the first shot before the first kill', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      recoveredFromStall: true,
    }))).toBe('ВЫРОВНЯЙ НОС И ОТКРОЙ ОГОНЬ');
  });

  it('makes the first upgrade pause intentional', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      recoveredFromStall: true,
      firedOnce: true,
      playerScore: 1,
      pendingLevelUp: true,
    }))).toBe('ВЫБЕРИ ПЕРВЫЙ АПГРЕЙД');
  });

  it('falls back to mission goals after onboarding beats', () => {
    expect(resolveFirstSortieGuidance(guidanceInput({
      phase: 'ambush',
      timeSec: 130,
      recoveredFromStall: true,
      firedOnce: true,
      playerScore: 4,
    }))).toBe('ПЕРЕХВАТИ ОХОТНИКОВ');

    expect(resolveFirstSortieGuidance(guidanceInput({
      phase: 'boss',
      timeSec: 190,
      recoveredFromStall: true,
      firedOnce: true,
      playerScore: 5,
    }))).toBe('ПРОГОНИ ШРАМА ОТ МАЯКА');
  });

  it('announces the first story upgrade once before the choice opens', () => {
    expect(shouldShowFirstUpgradeBriefing({
      runMode: 'story',
      pendingLevelUp: true,
      choicesShowing: false,
      alreadyShown: false,
    })).toBe(true);

    expect(shouldShowFirstUpgradeBriefing({
      runMode: 'story',
      pendingLevelUp: true,
      choicesShowing: true,
      alreadyShown: false,
    })).toBe(false);

    expect(shouldShowFirstUpgradeBriefing({
      runMode: 'arena',
      pendingLevelUp: true,
      choicesShowing: false,
      alreadyShown: false,
    })).toBe(false);
  });
});
