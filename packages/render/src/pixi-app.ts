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
    // Render at the device's native pixel density (capped at 3× so absurd DPRs
    // don't tank perf). Previously phones were forced to 2×, which upscaled to a
    // 3× screen like the iPhone 15 Pro Max → everything looked slightly soft.
    resolution: Math.min(window.devicePixelRatio || 1, 3),
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
