import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';

/**
 * Decorative score blimp. A faint cream-coloured airship that drifts slowly across
 * the upper sky carrying a banner with the current score. Sits between sky and
 * planes — visible but subtle (alpha 0.7).
 */
export function createBlimpSprite(): {
  container: Container;
  update: (state: WorldState) => void;
} {
  const c = new Container();
  c.alpha = 0.78;

  // Body — large horizontal ellipse (cream)
  const bodyW = 200;
  const bodyH = 64;
  const body = new Graphics()
    .ellipse(0, 0, bodyW / 2, bodyH / 2)
    .fill(0xe8dfc4)
    .stroke({ color: 0x5a4a30, width: 2 });
  // Tail fins
  const finV = new Graphics()
    .moveTo(bodyW / 2 - 8, -10)
    .lineTo(bodyW / 2 + 20, -22)
    .lineTo(bodyW / 2 + 20, 22)
    .lineTo(bodyW / 2 - 8, 10)
    .closePath()
    .fill(0xc9b88a)
    .stroke({ color: 0x5a4a30, width: 2 });
  // Gondola underneath
  const gondola = new Graphics()
    .rect(-30, bodyH / 2 - 2, 60, 14)
    .fill(0x6a5238)
    .stroke({ color: 0x2a2018, width: 1.5 });
  // Suspension lines
  const lineL = new Graphics().moveTo(-25, bodyH / 2 - 2).lineTo(-25, bodyH / 2 - 14).stroke({ color: 0x2a2018, width: 1 });
  const lineR = new Graphics().moveTo(25, bodyH / 2 - 2).lineTo(25, bodyH / 2 - 14).stroke({ color: 0x2a2018, width: 1 });

  // Score banner — bright readable text
  const bannerStyle = new TextStyle({
    fontFamily: 'BiplanesMono, monospace',
    fontSize: 22,
    fill: 0x1f1810,
    fontWeight: 'bold',
  });
  const bannerText = new Text({ text: 'PLAYER 0  ENEMY 0', style: bannerStyle });

  c.addChild(body, finV, lineL, lineR, gondola, bannerText);

  return {
    container: c,
    update(state: WorldState) {
      c.x = state.blimp.position.x;
      c.y = state.blimp.position.y;
      bannerText.text = `PLAYER ${state.playerScore}  ENEMY ${state.enemyScore}`;
      bannerText.x = -bannerText.width / 2;
      bannerText.y = -bannerText.height / 2;
    },
  };
}
