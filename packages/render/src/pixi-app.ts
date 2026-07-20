import { Application } from 'pixi.js';

export function resolveRenderResolution(devicePixelRatio: number, isTouchDevice: boolean): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  // Phones cap at 2×: at 2.5× the GPU pushes ~56% MORE pixels for a sharpness
  // gain nobody sees at arm's length — that surplus is pure heat and battery
  // drain (owner: «игра сильно греет телефон»). Desktop/Steam keep up to 3×.
  return Math.min(dpr, isTouchDevice ? 2 : 3);
}

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  await app.init({
    preference: 'webgl',
    powerPreference: 'high-performance',
    backgroundAlpha: 0,
    resizeTo: container,
    // MSAA is one of the most expensive flags on a mobile GPU and the game is
    // sprite-drawn art at 2× density — the visual difference is nil, the heat
    // difference is real. Desktop keeps it for crisp vector HUD lines.
    antialias: !isTouchDevice,
    autoDensity: true,
    // Render at the device's pixel density, capped (see resolveRenderResolution).
    resolution: resolveRenderResolution(window.devicePixelRatio || 1, isTouchDevice),
  });
  // 90/120 Hz phones drive rAF at panel rate — rendering 2× the frames of the
  // 60 Hz simulation is invisible on screen but doubles GPU work (heat/battery).
  app.ticker.maxFPS = 60;
  app.canvas.style.position = 'absolute';
  app.canvas.style.inset = '0';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.display = 'block';
  app.canvas.style.zIndex = '1';
  container.appendChild(app.canvas);
  return app;
}
