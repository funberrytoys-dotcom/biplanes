import { Container, Graphics } from 'pixi.js';

export interface PilotHeadHandle {
  container: Container;
  update(throttleChange: number, dt: number): void;
}

export function createPilotHead(faction: 'player' | 'enemy'): PilotHeadHandle {
  const c = new Container();
  const skin = new Graphics()
    .ellipse(0, 0, 3, 4)
    .fill(0xf2c79a)
    .stroke({ color: 0x000000, width: 0.8 });
  const helmet = new Graphics()
    .moveTo(-3, 0)
    .arc(0, 0, 3.5, Math.PI, 0, false)
    .closePath()
    .fill(faction === 'player' ? 0x6b4226 : 0x2a2030)
    .stroke({ color: 0x000000, width: 0.8 });
  if (faction === 'player') {
    const scarf = new Graphics().rect(-1, 3, 4, 1).fill(0xf4d35e);
    c.addChild(scarf);
  }
  c.addChild(skin, helmet);
  c.x = 1;
  c.y = -5;

  let bob = 0;
  return {
    container: c,
    update(throttleChange, dt) {
      bob += (throttleChange - bob) * 6 * dt;
      c.rotation = bob * 0.18;
    },
  };
}
