import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, CEILING_Y } from '@biplanes/shared';

/**
 * Static single-screen background:
 *  - sky gradient (blue → warmer near horizon)
 *  - ground strip from GROUND_Y to bottom
 *  - silhouetted hangars + control tower
 *  - dashed runway line
 *  - faint ceiling hint at top
 */
export function createSkyBackground(width: number, height: number): Container {
  const c = new Container();

  // Sky in three bands — top deep blue, mid blue, lower warmer.
  const skyTop = new Graphics().rect(0, 0, width, height * 0.35).fill(0x1a3b6a);
  const skyMid = new Graphics().rect(0, height * 0.35, width, height * 0.35).fill(0x2f6ba8);
  const skyLow = new Graphics()
    .rect(0, height * 0.7, width, (GROUND_Y - height * 0.7))
    .fill(0xd8985c);
  c.addChild(skyTop, skyMid, skyLow);

  // Ceiling hint — faint red band at the very top to discourage scraping the top.
  const ceiling = new Graphics()
    .rect(0, CEILING_Y, width, 18)
    .fill({ color: 0xff5555, alpha: 0.18 });
  c.addChild(ceiling);

  // Distant cloud silhouettes
  for (let i = 0; i < 6; i++) {
    const cloud = new Graphics()
      .ellipse((i * width) / 6 + 40, height * 0.18 + (i % 2) * 60, 90 + (i * 17) % 50, 22 + (i * 5) % 14)
      .fill({ color: 0xffffff, alpha: 0.22 });
    c.addChild(cloud);
  }

  // Ground strip — dark brown/green
  const groundStrip = new Graphics()
    .rect(0, GROUND_Y, width, height - GROUND_Y)
    .fill(0x3d2914);
  c.addChild(groundStrip);

  // Grass tuft on top of the ground strip
  const grass = new Graphics()
    .rect(0, GROUND_Y, width, 8)
    .fill(0x4a6b2f);
  c.addChild(grass);

  // Runway: dashed centerline along the ground
  const runwayY = GROUND_Y + (height - GROUND_Y) * 0.6;
  const dashLen = 60;
  const dashGap = 40;
  for (let x = 20; x < width - 20; x += dashLen + dashGap) {
    const seg = new Graphics()
      .rect(x, runwayY - 2, dashLen, 4)
      .fill({ color: 0xeeeeee, alpha: 0.55 });
    c.addChild(seg);
  }

  // Hangars — silhouette boxes with triangular roofs. Spread across the strip.
  const hangarSpots = [
    { x: width * 0.18, w: 110, h: 50 },
    { x: width * 0.36, w: 90,  h: 42 },
    { x: width * 0.62, w: 130, h: 58 },
    { x: width * 0.83, w: 100, h: 46 },
  ];
  for (const h of hangarSpots) {
    const top = GROUND_Y - h.h;
    const body = new Graphics()
      .rect(h.x, top, h.w, h.h)
      .fill(0x1f1810);
    // Triangle roof
    const roof = new Graphics()
      .moveTo(h.x - 6, top)
      .lineTo(h.x + h.w / 2, top - 22)
      .lineTo(h.x + h.w + 6, top)
      .closePath()
      .fill(0x140d08);
    c.addChild(body, roof);
  }

  // Control tower — taller, narrow rectangle with a small cabin on top.
  const towerX = width * 0.5 - 18;
  const towerH = 110;
  const tower = new Graphics()
    .rect(towerX, GROUND_Y - towerH, 36, towerH)
    .fill(0x1a130b);
  const cabin = new Graphics()
    .rect(towerX - 8, GROUND_Y - towerH - 24, 52, 24)
    .fill(0x261c11);
  const antenna = new Graphics()
    .rect(towerX + 16, GROUND_Y - towerH - 50, 4, 28)
    .fill(0x0a0705);
  c.addChild(tower, cabin, antenna);

  return c;
}
