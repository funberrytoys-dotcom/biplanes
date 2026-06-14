import type { ArenaWeatherPreset, SkyThemeId } from '@biplanes/render';
import { assetUrl } from './asset-url.js';

export const ARENA_BACKGROUND_URLS = {
  clearMorning: assetUrl('assets/biplanes/arena/backgrounds/arena_01_clear_morning.jpg?v=20260613-vivid-backdrops'),
  roseSunset: assetUrl('assets/biplanes/arena/backgrounds/arena_02_rose_sunset.jpg?v=20260613-vivid-backdrops'),
  starNight: assetUrl('assets/biplanes/arena/backgrounds/arena_03_star_night.jpg?v=20260613-vivid-backdrops'),
  burningHorizon: assetUrl('assets/biplanes/arena/backgrounds/arena_04_burning_horizon.jpg?v=20260613-vivid-backdrops'),
  snowSquall: assetUrl('assets/biplanes/arena/backgrounds/arena_05_snow_squall.jpg?v=20260613-vivid-backdrops'),
  finalStorm: assetUrl('assets/biplanes/arena/backgrounds/arena_06_final_storm.jpg?v=20260613-vivid-backdrops'),
  highCloudSea: assetUrl('assets/biplanes/arena/backgrounds/arena_07_high_cloud_sea.jpg?v=20260613-vivid-backdrops'),
  violetTwilight: assetUrl('assets/biplanes/arena/backgrounds/arena_08_violet_twilight.jpg?v=20260613-vivid-backdrops'),
  stormFront: assetUrl('assets/biplanes/arena/backgrounds/arena_09_storm_front.jpg?v=20260613-vivid-backdrops'),
  thunderheads: assetUrl('assets/biplanes/arena/backgrounds/arena_10_thunderheads.jpg?v=20260613-vivid-backdrops'),
  emberSea: assetUrl('assets/biplanes/arena/backgrounds/arena_11_ember_sea.jpg?v=20260613-vivid-backdrops'),
  moonlitFog: assetUrl('assets/biplanes/arena/backgrounds/arena_12_moonlit_fog.jpg?v=20260613-vivid-backdrops'),
  coldFront: assetUrl('assets/biplanes/arena/backgrounds/arena_13_cold_front.jpg?v=20260613-vivid-backdrops'),
  goldenBreak: assetUrl('assets/biplanes/arena/backgrounds/arena_14_golden_break.jpg?v=20260613-vivid-backdrops'),
  bossApproach: assetUrl('assets/biplanes/arena/backgrounds/arena_15_boss_approach.jpg?v=20260613-vivid-backdrops'),
} as const;

export interface ArenaLocationTheme {
  name: string;
  sky: SkyThemeId;
  weather: ArenaWeatherPreset;
  background: string;
}

export type WeatherIcon = 'sun' | 'rain' | 'snow' | 'storm' | 'fog' | 'night';

export interface WeatherGameplay {
  wind: { x: number; y: number };  // base gust vector (px/sec), modulated by the host
  lightning: boolean;
  label: string;                   // short weather name for the HUD indicator
  hazard: string | null;           // warning line, or null when calm
  icon: WeatherIcon;
}

/** Maps a visual weather preset to its gameplay effect + HUD hazard text. */
export function weatherGameplay(preset: ArenaWeatherPreset): WeatherGameplay {
  switch (preset) {
    case 'rain':
      return { wind: { x: -72, y: 8 }, lightning: false, label: 'ДОЖДЬ', hazard: 'Ветер сносит — правь курс', icon: 'rain' };
    case 'storm':
      return { wind: { x: -120, y: 12 }, lightning: false, label: 'ШТОРМ', hazard: 'Сильный ветер! Держи газ', icon: 'storm' };
    case 'thunder':
      return { wind: { x: -140, y: 14 }, lightning: true, label: 'ГРОЗА', hazard: '⚡ Молнии — не зависай высоко', icon: 'storm' };
    case 'snow':
      return { wind: { x: -56, y: 10 }, lightning: false, label: 'СНЕГ', hazard: 'Снежный снос', icon: 'snow' };
    case 'blizzard':
      return { wind: { x: -128, y: 12 }, lightning: false, label: 'БУРАН', hazard: 'Буран — сильный снос!', icon: 'snow' };
    case 'fog':
      return { wind: { x: -18, y: 0 }, lightning: false, label: 'ТУМАН', hazard: 'Плохая видимость', icon: 'fog' };
    case 'night':
      return { wind: { x: -16, y: 0 }, lightning: false, label: 'НОЧЬ', hazard: null, icon: 'night' };
    case 'dawn':
      return { wind: { x: -10, y: 0 }, lightning: false, label: 'РАССВЕТ', hazard: null, icon: 'sun' };
    case 'sunset':
      return { wind: { x: -14, y: 0 }, lightning: false, label: 'ЗАКАТ', hazard: null, icon: 'sun' };
    case 'clear':
    default:
      return { wind: { x: -8, y: 0 }, lightning: false, label: 'ЯСНО', hazard: null, icon: 'sun' };
  }
}

export const ARENA_LOCATION_THEMES: ArenaLocationTheme[] = [
  { name: 'РОЗОВЫЙ ЗАКАТ', sky: 'sunset', weather: 'sunset', background: ARENA_BACKGROUND_URLS.roseSunset },
  { name: 'ГОРЯЩИЙ ГОРИЗОНТ', sky: 'sunset', weather: 'rain', background: ARENA_BACKGROUND_URLS.burningHorizon },
  { name: 'ФИОЛЕТОВЫЕ СУМЕРКИ', sky: 'twilight', weather: 'dawn', background: ARENA_BACKGROUND_URLS.violetTwilight },
  { name: 'ЗОЛОТОЙ ПРОРЫВ', sky: 'sunset', weather: 'dawn', background: ARENA_BACKGROUND_URLS.goldenBreak },
  { name: 'МОРЕ ОБЛАКОВ', sky: 'noon', weather: 'clear', background: ARENA_BACKGROUND_URLS.highCloudSea },
  { name: 'ЗВЕЗДНАЯ НОЧЬ', sky: 'night', weather: 'night', background: ARENA_BACKGROUND_URLS.starNight },
  { name: 'ГРОЗОВОЙ ФРОНТ', sky: 'twilight', weather: 'storm', background: ARENA_BACKGROUND_URLS.stormFront },
  { name: 'УГОЛЬНОЕ МОРЕ', sky: 'sunset', weather: 'sunset', background: ARENA_BACKGROUND_URLS.emberSea },
  { name: 'ЯСНОЕ УТРО', sky: 'noon', weather: 'dawn', background: ARENA_BACKGROUND_URLS.clearMorning },
  { name: 'ГРОЗОВЫЕ БАШНИ', sky: 'night', weather: 'thunder', background: ARENA_BACKGROUND_URLS.thunderheads },
  { name: 'ЛУННЫЙ ТУМАН', sky: 'night', weather: 'fog', background: ARENA_BACKGROUND_URLS.moonlitFog },
  { name: 'ХОЛОДНЫЙ ФРОНТ', sky: 'twilight', weather: 'blizzard', background: ARENA_BACKGROUND_URLS.coldFront },
  { name: 'СНЕЖНЫЙ ШКВАЛ', sky: 'twilight', weather: 'snow', background: ARENA_BACKGROUND_URLS.snowSquall },
  { name: 'ФИНАЛЬНАЯ ГРОЗА', sky: 'night', weather: 'thunder', background: ARENA_BACKGROUND_URLS.finalStorm },
  { name: 'ПОДХОД ШРАМА', sky: 'night', weather: 'storm', background: ARENA_BACKGROUND_URLS.bossApproach },
];
