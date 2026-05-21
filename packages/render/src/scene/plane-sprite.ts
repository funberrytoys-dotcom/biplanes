import { Container, Graphics } from 'pixi.js';
import type { Plane } from '@biplanes/core';

export function createPlaneSprite(faction: 'player' | 'enemy'): { container: Container; update: (p: Plane) => void } {
  const c = new Container();

  // Sprite is drawn pointing right (+x). We flip via scale.x when facing left.
  const body = new Graphics()
    .moveTo(20, 0)
    .lineTo(-16, -10)
    .lineTo(-12, 0)
    .lineTo(-16, 10)
    .closePath()
    .fill(faction === 'player' ? 0xf4d35e : 0xc0392b);

  const wingTop = new Graphics().rect(-10, -16, 22, 4).fill(faction === 'player' ? 0xeab308 : 0x922b21);
  const wingBot = new Graphics().rect(-10, 12, 22, 4).fill(faction === 'player' ? 0xeab308 : 0x922b21);

  c.addChild(wingTop, wingBot, body);

  return {
    container: c,
    update(p: Plane) {
      c.x = p.kinematic.position.x;
      c.y = p.kinematic.position.y;
      // When facing left we set scale.x = -1 to mirror; the rotation is the math heading.
      // To make a left-facing plane visually upright, we rotate by (heading - π) so its
      // body remains the same shape after the horizontal flip.
      if (p.kinematic.facing === -1) {
        c.scale.x = -1;
        c.rotation = Math.PI - p.kinematic.heading;
      } else {
        c.scale.x = 1;
        c.rotation = p.kinematic.heading;
      }
      c.alpha = p.state === 'crashed' ? 0 : 1;
    },
  };
}
