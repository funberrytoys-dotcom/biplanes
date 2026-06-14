import { Application } from 'pixi.js';

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  const phoneLike = Math.min(window.innerWidth, window.innerHeight) <= 520
    && Math.max(window.innerWidth, window.innerHeight) <= 1100;
  await app.init({
    preference: 'webgl',
    powerPreference: 'high-performance',
    backgroundAlpha: 0,
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    resolution: phoneLike ? Math.min(window.devicePixelRatio || 1, 2) : window.devicePixelRatio || 1,
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
