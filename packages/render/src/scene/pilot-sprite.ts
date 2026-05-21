import { Container, Graphics } from 'pixi.js';
import type { Pilot } from '@biplanes/core';

/**
 * Renders the ejected pilot in four visual states:
 *  - parachute: pilot hanging under a white canopy
 *  - walking:   small standing figure
 *  - dead:      prone figure on the ground
 *  - safe:      same as walking (visible just for the last frame before despawn)
 */
export function createPilotSprite(): { container: Container; update: (p: Pilot) => void } {
  const c = new Container();

  // --- Parachute group ---
  const parachuteGroup = new Container();
  const canopy = new Graphics()
    .moveTo(-30, 0)
    .arc(0, 0, 30, Math.PI, 0, false)
    .lineTo(30, 0)
    .closePath()
    .fill(0xf2f2f2)
    .stroke({ color: 0xaaaaaa, width: 2 });
  const lineL = new Graphics().moveTo(-26, 0).lineTo(-6, 26).stroke({ color: 0x222222, width: 1.5 });
  const lineR = new Graphics().moveTo(26, 0).lineTo(6, 26).stroke({ color: 0x222222, width: 1.5 });
  const lineM1 = new Graphics().moveTo(-10, 0).lineTo(-3, 26).stroke({ color: 0x222222, width: 1.2 });
  const lineM2 = new Graphics().moveTo(10, 0).lineTo(3, 26).stroke({ color: 0x222222, width: 1.2 });
  const bodyP = new Graphics().rect(-4, 24, 8, 12).fill(0x6b4226);
  const headP = new Graphics().circle(0, 22, 4).fill(0xf2c79a);
  parachuteGroup.addChild(canopy, lineL, lineR, lineM1, lineM2, bodyP, headP);

  // --- Walking group ---
  const walkingGroup = new Container();
  const bodyW = new Graphics().rect(-3, -8, 6, 14).fill(0x6b4226);
  const headW = new Graphics().circle(0, -12, 4).fill(0xf2c79a);
  const legL = new Graphics().rect(-3, 6, 2, 8).fill(0x3a2a1a);
  const legR = new Graphics().rect(1, 6, 2, 8).fill(0x3a2a1a);
  const armR = new Graphics().rect(2, -6, 5, 2).fill(0x6b4226);
  walkingGroup.addChild(legL, legR, bodyW, armR, headW);
  walkingGroup.visible = false;

  // --- Dead group (prone figure) ---
  const deadGroup = new Container();
  const bodyD = new Graphics().rect(-10, -2, 20, 5).fill(0x6b4226);
  const headD = new Graphics().circle(-12, 0, 4).fill(0xf2c79a);
  const legsD = new Graphics().rect(8, -1, 8, 3).fill(0x3a2a1a);
  // small "X" cross over the body to indicate KIA
  const x1 = new Graphics().moveTo(-4, -6).lineTo(4, 2).stroke({ color: 0xff3030, width: 1.5 });
  const x2 = new Graphics().moveTo(4, -6).lineTo(-4, 2).stroke({ color: 0xff3030, width: 1.5 });
  deadGroup.addChild(bodyD, headD, legsD, x1, x2);
  deadGroup.visible = false;

  c.addChild(parachuteGroup, walkingGroup, deadGroup);

  return {
    container: c,
    update(p: Pilot) {
      c.x = p.position.x;
      c.y = p.position.y;
      parachuteGroup.visible = p.state === 'parachute';
      walkingGroup.visible = p.state === 'walking' || p.state === 'safe';
      deadGroup.visible = p.state === 'dead';

      // Mirror walking figure based on facing.
      walkingGroup.scale.x = p.facing === -1 ? -1 : 1;

      // Dim out a soon-to-be-removed dead pilot
      if (p.state === 'dead') {
        deadGroup.alpha = Math.max(0.4, Math.min(1, p.deathTimer / 2.0));
      }
    },
  };
}
