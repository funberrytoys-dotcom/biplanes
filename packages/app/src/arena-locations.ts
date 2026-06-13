import type { ArenaWeatherPreset, SkyThemeId } from '@biplanes/render';
import { assetUrl } from './asset-url.js';

export const ARENA_BACKGROUND_URLS = {
  clearMorning: assetUrl('assets/biplanes/arena/backgrounds/arena_01_clear_morning.jpg?v=20260603-full-backdrops'),
  roseSunset: assetUrl('assets/biplanes/arena/backgrounds/arena_02_rose_sunset.jpg?v=20260603-full-backdrops'),
  starNight: assetUrl('assets/biplanes/arena/backgrounds/arena_03_star_night.jpg?v=20260603-full-backdrops'),
  burningHorizon: assetUrl('assets/biplanes/arena/backgrounds/arena_04_burning_horizon.jpg?v=20260603-full-backdrops'),
  snowSquall: assetUrl('assets/biplanes/arena/backgrounds/arena_05_snow_squall.jpg?v=20260603-full-backdrops'),
  finalStorm: assetUrl('assets/biplanes/arena/backgrounds/arena_06_final_storm.jpg?v=20260603-full-backdrops'),
  highCloudSea: assetUrl('assets/biplanes/arena/backgrounds/arena_07_high_cloud_sea.jpg?v=20260603-full-backdrops'),
  violetTwilight: assetUrl('assets/biplanes/arena/backgrounds/arena_08_violet_twilight.jpg?v=20260603-full-backdrops'),
  stormFront: assetUrl('assets/biplanes/arena/backgrounds/arena_09_storm_front.jpg?v=20260603-full-backdrops'),
  thunderheads: assetUrl('assets/biplanes/arena/backgrounds/arena_10_thunderheads.jpg?v=20260603-full-backdrops'),
  emberSea: assetUrl('assets/biplanes/arena/backgrounds/arena_11_ember_sea.jpg?v=20260603-full-backdrops'),
  moonlitFog: assetUrl('assets/biplanes/arena/backgrounds/arena_12_moonlit_fog.jpg?v=20260603-full-backdrops'),
  coldFront: assetUrl('assets/biplanes/arena/backgrounds/arena_13_cold_front.jpg?v=20260603-full-backdrops'),
  goldenBreak: assetUrl('assets/biplanes/arena/backgrounds/arena_14_golden_break.jpg?v=20260603-full-backdrops'),
  bossApproach: assetUrl('assets/biplanes/arena/backgrounds/arena_15_boss_approach.jpg?v=20260603-full-backdrops'),
} as const;

export interface ArenaLocationTheme {
  name: string;
  sky: SkyThemeId;
  weather: ArenaWeatherPreset;
  background: string;
}

export const ARENA_LOCATION_THEMES: ArenaLocationTheme[] = [
  { name: 'ЯСНОЕ УТРО', sky: 'noon', weather: 'dawn', background: ARENA_BACKGROUND_URLS.clearMorning },
  { name: 'РОЗОВЫЙ ЗАКАТ', sky: 'sunset', weather: 'sunset', background: ARENA_BACKGROUND_URLS.roseSunset },
  { name: 'ЗВЕЗДНАЯ НОЧЬ', sky: 'night', weather: 'night', background: ARENA_BACKGROUND_URLS.starNight },
  { name: 'ГОРЯЩИЙ ГОРИЗОНТ', sky: 'sunset', weather: 'rain', background: ARENA_BACKGROUND_URLS.burningHorizon },
  { name: 'СНЕЖНЫЙ ШКВАЛ', sky: 'twilight', weather: 'snow', background: ARENA_BACKGROUND_URLS.snowSquall },
  { name: 'ФИНАЛЬНАЯ ГРОЗА', sky: 'night', weather: 'thunder', background: ARENA_BACKGROUND_URLS.finalStorm },
  { name: 'МОРЕ ОБЛАКОВ', sky: 'noon', weather: 'clear', background: ARENA_BACKGROUND_URLS.highCloudSea },
  { name: 'ФИОЛЕТОВЫЕ СУМЕРКИ', sky: 'twilight', weather: 'dawn', background: ARENA_BACKGROUND_URLS.violetTwilight },
  { name: 'ГРОЗОВОЙ ФРОНТ', sky: 'twilight', weather: 'storm', background: ARENA_BACKGROUND_URLS.stormFront },
  { name: 'ГРОЗОВЫЕ БАШНИ', sky: 'night', weather: 'thunder', background: ARENA_BACKGROUND_URLS.thunderheads },
  { name: 'УГОЛЬНОЕ МОРЕ', sky: 'sunset', weather: 'sunset', background: ARENA_BACKGROUND_URLS.emberSea },
  { name: 'ЛУННЫЙ ТУМАН', sky: 'night', weather: 'fog', background: ARENA_BACKGROUND_URLS.moonlitFog },
  { name: 'ХОЛОДНЫЙ ФРОНТ', sky: 'twilight', weather: 'blizzard', background: ARENA_BACKGROUND_URLS.coldFront },
  { name: 'ЗОЛОТОЙ ПРОРЫВ', sky: 'sunset', weather: 'dawn', background: ARENA_BACKGROUND_URLS.goldenBreak },
  { name: 'ПОДХОД ШРАМА', sky: 'night', weather: 'storm', background: ARENA_BACKGROUND_URLS.bossApproach },
];
