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
    resolution: window.devicePixelRatio || 1,
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
