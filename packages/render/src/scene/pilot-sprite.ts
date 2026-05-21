import { Container, Graphics } from 'pixi.js';
import type { Pilot } from '@biplanes/core';

interface PilotColors {
  jacket: number;
  canopy: number;
  canopyStroke: number;
}

const PLAYER_COLORS: PilotColors = {
  jacket: 0x6b4226,        // brown jacket — friendly
  canopy: 0xf2f2f2,        // white canopy
  canopyStroke: 0xaaaaaa,
};
const ENEMY_COLORS: PilotColors = {
  jacket: 0x4a3a52,        // muted purple-gray for enemy
  canopy: 0xc8c8c8,        // greyer canopy
  canopyStroke: 0x666666,
};

/**
 * Renders an ejected pilot in four visual states. Faction determines colors:
 * player = brown jacket / white canopy, enemy = darker jacket / grey canopy.
 */
export function createPilotSprite(faction: 'player' | 'enemy' = 'player'): {
  container: Container;
  update: (p: Pilot) => void;
} {
  const colors = faction === 'player' ? PLAYER_COLORS : ENEMY_COLORS;
  const c = new Container();

  // --- Parachute group ---
  const parachuteGroup = new Container();
  const canopy = new Graphics()
    .moveTo(-30, 0)
    .arc(0, 0, 30, Math.PI, 0, false)
    .lineTo(30, 0)
    .closePath()
    .fill(colors.canopy)
    .stroke({ color: colors.canopyStroke, width: 2 });
  const lineL = new Graphics().moveTo(-26, 0).lineTo(-6, 26).stroke({ color: 0x222222, width: 1.5 });
  const lineR = new Graphics().moveTo(26, 0).lineTo(6, 26).stroke({ color: 0x222222, width: 1.5 });
  const lineM1 = new Graphics().moveTo(-10, 0).lineTo(-3, 26).stroke({ color: 0x222222, width: 1.2 });
  const lineM2 = new Graphics().moveTo(10, 0).lineTo(3, 26).stroke({ color: 0x222222, width: 1.2 });
  const bodyP = new Graphics().rect(-4, 24, 8, 12).fill(colors.jacket);
  const headP = new Graphics().circle(0, 22, 4).fill(0xf2c79a);
  parachuteGroup.addChild(canopy, lineL, lineR, lineM1, lineM2, bodyP, headP);

  // --- Walking group ---
  const walkingGroup = new Container();
  const bodyW = new Graphics().rect(-3, -8, 6, 14).fill(colors.jacket);
  const headW = new Graphics().circle(0, -12, 4).fill(0xf2c79a);
  const legL = new Graphics().rect(-3, 6, 2, 8).fill(0x3a2a1a);
  const legR = new Graphics().rect(1, 6, 2, 8).fill(0x3a2a1a);
  const armR = new Graphics().rect(2, -6, 5, 2).fill(colors.jacket);
  walkingGroup.addChild(legL, legR, bodyW, armR, headW);
  walkingGroup.visible = false;

  // --- Dead group (prone figure) ---
  const deadGroup = new Container();
  const bodyD = new Graphics().rect(-10, -2, 20, 5).fill(colors.jacket);
  const headD = new Graphics().circle(-12, 0, 4).fill(0xf2c79a);
  const legsD = new Graphics().rect(8, -1, 8, 3).fill(0x3a2a1a);
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

      walkingGroup.scale.x = p.facing === -1 ? -1 : 1;

      if (p.state === 'dead') {
        deadGroup.alpha = Math.max(0.4, Math.min(1, p.deathTimer / 2.0));
      }
    },
  };
}
