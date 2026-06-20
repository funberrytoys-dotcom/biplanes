import { describe, expect, it } from 'vitest';
import { getStartMenuOptions } from './start-menu-options.js';

describe('start menu options', () => {
  it('opens the standalone game through the first combat sortie', () => {
    const options = getStartMenuOptions();

    expect(options[0]).toMatchObject({
      action: 'story',
      enabled: true,
      label: 'ПЕРВЫЙ ВЫЛЕТ',
    });
  });

  it('places ЗАБЕГ directly after АРЕНА and enabled', () => {
    const options = getStartMenuOptions();
    const arenaIndex = options.findIndex((o) => o.action === 'arena');
    const runIndex = options.findIndex((o) => o.action === 'run');
    expect(arenaIndex).toBeGreaterThanOrEqual(0);
    expect(runIndex).toBe(arenaIndex + 1);
    expect(options[runIndex]!).toMatchObject({ label: 'ЗАБЕГ', enabled: true });
  });

  it('keeps tuning labs behind the main sortie', () => {
    const options = getStartMenuOptions();
    const storyIndex = options.findIndex((option) => option.action === 'story');
    const flightLabIndex = options.findIndex((option) => option.action === 'flightLab');

    expect(storyIndex).toBeGreaterThanOrEqual(0);
    expect(flightLabIndex).toBeGreaterThan(storyIndex);
    expect(options[flightLabIndex]!.note).toContain('внутренний');
  });
});
