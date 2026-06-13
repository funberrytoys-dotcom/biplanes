import { describe, expect, it } from 'vitest';
import { arenaWeatherConfig } from './arena-weather-math.js';

describe('arenaWeatherConfig', () => {
  it('keeps clear weather clean and readable', () => {
    const clear = arenaWeatherConfig('clear');

    expect(clear.overlayAlpha).toBe(0);
    expect(clear.rainCount).toBe(0);
    expect(clear.snowCount).toBe(0);
    expect(clear.lightning).toBe(false);
  });

  it('makes thunder heavier than ordinary storm', () => {
    const storm = arenaWeatherConfig('storm');
    const thunder = arenaWeatherConfig('thunder');

    expect(thunder.rainCount).toBeGreaterThan(storm.rainCount);
    expect(thunder.overlayAlpha).toBeGreaterThan(storm.overlayAlpha);
    expect(thunder.lightning).toBe(true);
  });

  it('uses snow particles without rain for snow locations', () => {
    const snow = arenaWeatherConfig('snow');

    expect(snow.snowCount).toBeGreaterThan(0);
    expect(snow.rainCount).toBe(0);
  });

  it('separates rain, fog and blizzard moods', () => {
    const rain = arenaWeatherConfig('rain');
    const fog = arenaWeatherConfig('fog');
    const blizzard = arenaWeatherConfig('blizzard');

    expect(rain.rainCount).toBeGreaterThan(0);
    expect(fog.hazeAlpha).toBeGreaterThan(rain.hazeAlpha);
    expect(blizzard.snowCount).toBeGreaterThan(arenaWeatherConfig('snow').snowCount);
    expect(blizzard.wind).toBeGreaterThan(arenaWeatherConfig('snow').wind);
  });

  it('caps heavy weather particle density for mobile readability', () => {
    const presets = ['rain', 'storm', 'thunder', 'snow', 'blizzard'] as const;

    for (const preset of presets) {
      const config = arenaWeatherConfig(preset);
      expect(config.rainCount + config.snowCount + config.streakCount).toBeLessThanOrEqual(190);
      expect(config.overlayAlpha).toBeLessThanOrEqual(0.34);
    }
  });
});
