import { Container, Graphics } from 'pixi.js';
import { arenaWeatherConfig, type ArenaWeatherPreset } from './arena-weather-math.js';

interface WeatherDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

interface WeatherFlake {
  x: number;
  y: number;
  speed: number;
  radius: number;
  phase: number;
  alpha: number;
}

interface WindStreak {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
  phase: number;
}

export interface ArenaWeatherHandle {
  container: Container;
  setPreset: (preset: ArenaWeatherPreset) => void;
  update: (dt: number, timeSec: number) => void;
  resize: (width: number, height: number) => void;
}

function makeDrop(width: number, height: number): WeatherDrop {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 850 + Math.random() * 520,
    length: 22 + Math.random() * 26,
    alpha: 0.16 + Math.random() * 0.24,
  };
}

function makeFlake(width: number, height: number): WeatherFlake {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 45 + Math.random() * 92,
    radius: 1.2 + Math.random() * 2.8,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.24 + Math.random() * 0.48,
  };
}

export function createArenaWeather(width: number, height: number, initialPreset: ArenaWeatherPreset = 'clear'): ArenaWeatherHandle {
  const container = new Container();
  const tint = new Graphics();
  const haze = new Graphics();
  const rain = new Graphics();
  const snow = new Graphics();
  const streaks = new Graphics();
  const flash = new Graphics();
  container.addChild(tint, haze, streaks, rain, snow, flash);

  let w = width;
  let h = height;
  let preset = initialPreset;
  let config = arenaWeatherConfig(preset);
  let drops: WeatherDrop[] = [];
  let flakes: WeatherFlake[] = [];
  let windStreaks: WindStreak[] = [];
  let lightningCooldown = 2.0 + Math.random() * 3.0;
  let lightningLife = 0;

  function rebuildParticles() {
    drops = Array.from({ length: config.rainCount }, () => makeDrop(w, h));
    flakes = Array.from({ length: config.snowCount }, () => makeFlake(w, h));
    windStreaks = Array.from({ length: config.streakCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: 150 + Math.random() * 340 + config.wind,
      length: 50 + Math.random() * 120,
      alpha: 0.05 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function redrawTint() {
    tint.clear();
    haze.clear();
    if (config.overlayAlpha > 0) {
      tint.rect(0, 0, w, h).fill({ color: config.tint, alpha: config.overlayAlpha });
    }
    if (config.hazeAlpha > 0) {
      haze.rect(0, 0, w, h).fill({ color: config.tint, alpha: config.hazeAlpha * 0.12 });
      haze.rect(0, h * 0.72, w, h * 0.28).fill({ color: 0xffffff, alpha: config.hazeAlpha * 0.18 });
    }
  }

  function drawLightning() {
    flash.clear();
    if (lightningLife <= 0) {
      flash.alpha = 0;
      return;
    }
    // Softer weather-flash (was 0.52/0.22 near-white) + spaced out far more (see cooldowns) so
    // storm stages don't strobe the whole screen every couple of seconds = eye strain.
    flash.rect(0, 0, w, h).fill({ color: 0xdfeeff, alpha: 0.25 });
    flash.rect(0, h * 0.06, w, h * 0.28).fill({ color: 0xffffff, alpha: 0.12 });
    flash.alpha = Math.min(1, lightningLife / 0.12);
  }

  function applyPreset(nextPreset: ArenaWeatherPreset) {
    preset = nextPreset;
    config = arenaWeatherConfig(preset);
    rebuildParticles();
    redrawTint();
    rain.clear();
    snow.clear();
    lightningCooldown = config.lightning ? 7 + Math.random() * 7 : 9999;
    lightningLife = 0;
    drawLightning();
  }

  applyPreset(initialPreset);

  return {
    container,
    setPreset(nextPreset) {
      if (nextPreset === preset) return;
      applyPreset(nextPreset);
    },
    update(dt, timeSec) {
      rain.clear();
      snow.clear();
      streaks.clear();

      if (windStreaks.length > 0) {
        for (const streak of windStreaks) {
          streak.x -= streak.speed * dt;
          streak.y += Math.sin(timeSec * 1.4 + streak.phase) * 12 * dt;
          if (streak.x < -streak.length - 40) {
            streak.x = w + Math.random() * w * 0.25;
            streak.y = Math.random() * h;
          }
          const slant = 14 + config.wind * 0.05;
          streaks.moveTo(streak.x, streak.y);
          streaks.lineTo(streak.x + streak.length, streak.y - slant);
          streaks.stroke({ color: 0xffffff, width: 1.2, alpha: streak.alpha });
        }
      }

      if (drops.length > 0) {
        for (const drop of drops) {
          drop.x += (config.wind - 340) * dt;
          drop.y += drop.speed * dt;
          if (drop.y > h + drop.length || drop.x < -80) {
            drop.x = Math.random() * w + 80;
            drop.y = -Math.random() * h * 0.18;
          }
          rain.moveTo(drop.x, drop.y);
          rain.lineTo(drop.x - 20 - config.wind * 0.06, drop.y + drop.length);
          rain.stroke({ color: 0xc7e4ff, width: 1.25, alpha: drop.alpha });
        }
      }

      if (flakes.length > 0) {
        for (const flake of flakes) {
          flake.x += (Math.sin(timeSec * 1.7 + flake.phase) * 22 + config.wind * 0.22) * dt;
          flake.y += flake.speed * dt;
          if (flake.y > h + 10 || flake.x > w + 20) {
            flake.x = Math.random() * w;
            flake.y = -Math.random() * h * 0.1;
          }
          snow.circle(flake.x, flake.y, flake.radius).fill({ color: 0xffffff, alpha: flake.alpha });
        }
      }

      if (config.lightning) {
        if (lightningLife > 0) {
          lightningLife = Math.max(0, lightningLife - dt);
        } else {
          lightningCooldown -= dt;
          if (lightningCooldown <= 0) {
            lightningLife = 0.12;
            lightningCooldown = 8 + Math.random() * 8; // far more spacing (was 2.5–7.5s)
          }
        }
      } else {
        lightningLife = 0;
      }
      drawLightning();
    },
    resize(width, height) {
      w = width;
      h = height;
      rebuildParticles();
      redrawTint();
      drawLightning();
    },
  };
}
