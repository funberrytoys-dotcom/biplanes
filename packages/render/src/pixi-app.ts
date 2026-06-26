import { Application } from 'pixi.js';

export function resolveRenderResolution(devicePixelRatio: number, isTouchDevice: boolean): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, isTouchDevice ? 2.5 : 3);
}

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  await app.init({
    preference: 'webgl',
    powerPreference: 'high-performance',
    backgroundAlpha: 0,
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    // Render at the device's pixel density, capped. PHONES are fill-rate bound, and
    // a 3× retina screen means ~2.25× the pixels of 2× — a huge cost for a weak GPU
    // (30fps with an empty scene). So cap touch devices at 2× (slightly softer, ~2×
    // the framerate); desktop/Steam keep up to 3× for crispness.
    resolution: resolveRenderResolution(window.devicePixelRatio || 1, isTouchDevice),
  });
  app.canvas.style.position = 'absolute';
  app.canvas.style.inset = '0';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.display = 'block';
  app.canvas.style.zIndex = '1';
  container.appendChild(app.canvas);
  return app;
}
