import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARENA_BACKGROUND_URLS, ARENA_LOCATION_THEMES } from './arena-locations.js';

describe('arena locations', () => {
  it('covers the full fifteen-win arena run', () => {
    expect(ARENA_LOCATION_THEMES).toHaveLength(15);
  });

  it('opens the arena with a high-contrast sunset backdrop for mobile readability', () => {
    expect(ARENA_LOCATION_THEMES[0]?.background).toBe(ARENA_BACKGROUND_URLS.roseSunset);
  });

  it('includes the requested time-of-day and weather moods', () => {
    const names = new Set(ARENA_LOCATION_THEMES.map(location => location.name));
    expect(names).toContain('ЯСНОЕ УТРО');
    expect(names).toContain('РОЗОВЫЙ ЗАКАТ');
    expect(names).toContain('ЗВЕЗДНАЯ НОЧЬ');
    expect(names).toContain('ГРОЗОВОЙ ФРОНТ');
    expect(names).toContain('ГРОЗОВЫЕ БАШНИ');
    expect(names).toContain('СНЕЖНЫЙ ШКВАЛ');
    expect(names).toContain('ФИНАЛЬНАЯ ГРОЗА');
  });

  it('adds rain, fog and blizzard as distinct weather hazards', () => {
    const weathers = new Set(ARENA_LOCATION_THEMES.map(location => location.weather));
    expect(weathers).toContain('rain');
    expect(weathers).toContain('fog');
    expect(weathers).toContain('blizzard');
  });

  it('uses every generated backdrop family at least once', () => {
    const used = new Set(ARENA_LOCATION_THEMES.map(location => location.background));
    for (const url of Object.values(ARENA_BACKGROUND_URLS)) {
      expect(used).toContain(url);
    }
  });

  it('gives every arena stage its own backdrop', () => {
    const used = new Set(ARENA_LOCATION_THEMES.map(location => location.background));
    expect(used.size).toBe(ARENA_LOCATION_THEMES.length);
  });

  it('points every backdrop to a generated file in the web assets', () => {
    for (const url of Object.values(ARENA_BACKGROUND_URLS)) {
      const assetPath = url.split('?')[0]!.replace(/^\//, '');
      const candidates = [
        resolve(process.cwd(), '../../apps/web/public', assetPath),
        resolve(process.cwd(), 'apps/web/public', assetPath),
      ];
      expect(candidates.some(filePath => existsSync(filePath)), url).toBe(true);
    }
  });
});
