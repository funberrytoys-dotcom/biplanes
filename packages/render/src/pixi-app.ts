import { Application } from 'pixi.js';

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
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
    resolution: Math.min(
      window.devicePixelRatio || 1,
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ? 1.5 : 3,
    ),
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
