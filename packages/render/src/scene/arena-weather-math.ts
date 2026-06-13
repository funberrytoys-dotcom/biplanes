export type ArenaWeatherPreset =
  | 'clear'
  | 'dawn'
  | 'sunset'
  | 'night'
  | 'rain'
  | 'storm'
  | 'thunder'
  | 'snow'
  | 'blizzard'
  | 'fog';

export interface ArenaWeatherConfig {
  tint: number;
  overlayAlpha: number;
  rainCount: number;
  snowCount: number;
  streakCount: number;
  hazeAlpha: number;
  wind: number;
  lightning: boolean;
}

export function arenaWeatherConfig(preset: ArenaWeatherPreset): ArenaWeatherConfig {
  switch (preset) {
    case 'dawn':
      return { tint: 0xffd6a8, overlayAlpha: 0.06, rainCount: 0, snowCount: 0, streakCount: 12, hazeAlpha: 0.08, wind: 12, lightning: false };
    case 'sunset':
      return { tint: 0xff6a4d, overlayAlpha: 0.1, rainCount: 0, snowCount: 0, streakCount: 18, hazeAlpha: 0.1, wind: 18, lightning: false };
    case 'night':
      return { tint: 0x172a66, overlayAlpha: 0.22, rainCount: 0, snowCount: 0, streakCount: 16, hazeAlpha: 0.16, wind: 20, lightning: false };
    case 'rain':
      return { tint: 0x5f7fa6, overlayAlpha: 0.18, rainCount: 82, snowCount: 0, streakCount: 34, hazeAlpha: 0.18, wind: 130, lightning: false };
    case 'storm':
      return { tint: 0x26324d, overlayAlpha: 0.28, rainCount: 110, snowCount: 0, streakCount: 42, hazeAlpha: 0.22, wind: 190, lightning: false };
    case 'thunder':
      return { tint: 0x18213d, overlayAlpha: 0.36, rainCount: 155, snowCount: 0, streakCount: 58, hazeAlpha: 0.26, wind: 245, lightning: true };
    case 'snow':
      return { tint: 0xcfeaff, overlayAlpha: 0.2, rainCount: 0, snowCount: 145, streakCount: 24, hazeAlpha: 0.22, wind: 110, lightning: false };
    case 'blizzard':
      return { tint: 0xd8edff, overlayAlpha: 0.26, rainCount: 0, snowCount: 230, streakCount: 46, hazeAlpha: 0.3, wind: 210, lightning: false };
    case 'fog':
      return { tint: 0xb8c8d8, overlayAlpha: 0.24, rainCount: 0, snowCount: 0, streakCount: 6, hazeAlpha: 0.34, wind: 22, lightning: false };
    case 'clear':
    default:
      return { tint: 0x6fb8ff, overlayAlpha: 0, rainCount: 0, snowCount: 0, streakCount: 8, hazeAlpha: 0.04, wind: 8, lightning: false };
  }
}
