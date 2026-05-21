import { Application } from 'pixi.js';

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    background: 0x1a2a4a,
    resizeTo: container,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  container.appendChild(app.canvas);
  return app;
}
