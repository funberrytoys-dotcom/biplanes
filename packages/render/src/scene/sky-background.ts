import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  GROUND_Y,
  CEILING_Y,
  PLAYER_HANGAR_X,
  ENEMY_HANGAR_X,
} from '@biplanes/shared';

/**
 * Draw one prominent hangar at `hangarX` with the given colors and a single-letter label.
 * Used to render both the player (red/H) and enemy (steel-blue/X) hangars consistently.
 */
function drawHangar(
  c: Container,
  hangarX: number,
  opts: {
    wallColor: number;
    roofColor: number;
    label: string;
    labelColor: number;
  },
): void {
  const phW = 150;
  const phH = 95;
  const phTop = GROUND_Y - phH;
  const phLeft = hangarX - phW / 2;
  const wall = new Graphics()
    .rect(phLeft, phTop, phW, phH)
    .fill(opts.wallColor)
    .stroke({ color: 0x000000, width: 2 });
  // Door
  const doorW = 56;
  const doorH = 62;
  const door = new Graphics()
    .rect(phLeft + (phW - doorW) / 2, GROUND_Y - doorH, doorW, doorH)
    .fill(0x2a2018)
    .stroke({ color: 0xeeeeee, width: 2 });
  // Roof triangle
  const roof = new Graphics()
    .moveTo(phLeft - 10, phTop)
    .lineTo(phLeft + phW / 2, phTop - 32)
    .lineTo(phLeft + phW + 10, phTop)
    .closePath()
    .fill(opts.roofColor);
  c.addChild(wall, roof, door);

  const labelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 36,
    fill: opts.labelColor,
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 3 },
  });
  const label = new Text({ text: opts.label, style: labelStyle });
  label.x = hangarX - label.width / 2;
  label.y = phTop + 6;
  c.addChild(label);
}

/**
 * Static single-screen background:
 *  - sky gradient (blue → warmer near horizon)
 *  - ground strip from GROUND_Y to bottom
 *  - silhouetted hangars + control tower
 *  - TWO prominent hangars: player (left, red roof, white "H") and enemy (right, blue roof, red "X")
 *  - dashed runway line
 *  - faint ceiling hint at top
 */
export function createSkyBackground(width: number, height: number): Container {
  const c = new Container();

  const skyTop = new Graphics().rect(0, 0, width, height * 0.35).fill(0x1a3b6a);
  const skyMid = new Graphics().rect(0, height * 0.35, width, height * 0.35).fill(0x2f6ba8);
  const skyLow = new Graphics()
    .rect(0, height * 0.7, width, (GROUND_Y - height * 0.7))
    .fill(0xd8985c);
  c.addChild(skyTop, skyMid, skyLow);

  const ceiling = new Graphics()
    .rect(0, CEILING_Y, width, 18)
    .fill({ color: 0xff5555, alpha: 0.18 });
  c.addChild(ceiling);

  for (let i = 0; i < 6; i++) {
    const cloud = new Graphics()
      .ellipse((i * width) / 6 + 40, height * 0.18 + (i % 2) * 60, 90 + (i * 17) % 50, 22 + (i * 5) % 14)
      .fill({ color: 0xffffff, alpha: 0.22 });
    c.addChild(cloud);
  }

  const groundStrip = new Graphics()
    .rect(0, GROUND_Y, width, height - GROUND_Y)
    .fill(0x3d2914);
  c.addChild(groundStrip);

  const grass = new Graphics()
    .rect(0, GROUND_Y, width, 8)
    .fill(0x4a6b2f);
  c.addChild(grass);

  const runwayY = GROUND_Y + (height - GROUND_Y) * 0.6;
  const dashLen = 60;
  const dashGap = 40;
  for (let x = 20; x < width - 20; x += dashLen + dashGap) {
    const seg = new Graphics()
      .rect(x, runwayY - 2, dashLen, 4)
      .fill({ color: 0xeeeeee, alpha: 0.55 });
    c.addChild(seg);
  }

  // Background silhouette hangars (decorative, spaced across)
  const hangarSpots = [
    { x: width * 0.36, w: 90,  h: 42 },
    { x: width * 0.62, w: 130, h: 58 },
  ];
  for (const h of hangarSpots) {
    const top = GROUND_Y - h.h;
    const body = new Graphics().rect(h.x, top, h.w, h.h).fill(0x1f1810);
    const roof = new Graphics()
      .moveTo(h.x - 6, top)
      .lineTo(h.x + h.w / 2, top - 22)
      .lineTo(h.x + h.w + 6, top)
      .closePath()
      .fill(0x140d08);
    c.addChild(body, roof);
  }

  // Player hangar — warm red/orange, white "H".
  drawHangar(c, PLAYER_HANGAR_X, {
    wallColor: 0xb84a2a,
    roofColor: 0x6e2a15,
    label: 'H',
    labelColor: 0xffffff,
  });

  // Enemy hangar — cold steel blue with darker roof and red "X".
  drawHangar(c, ENEMY_HANGAR_X, {
    wallColor: 0x3d5c7a,
    roofColor: 0x1f3148,
    label: 'X',
    labelColor: 0xff4040,
  });

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
