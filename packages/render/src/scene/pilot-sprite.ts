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
 * Adds Chico's signature yellow scarf trailing and waving dynamically in the wind under parachute.
 */
export function createPilotSprite(faction: 'player' | 'enemy' = 'player'): {
  container: Container;
  update: (p: Pilot) => void;
} {
  const colors = faction === 'player' ? PLAYER_COLORS : ENEMY_COLORS;
  const c = new Container();

  let animTime = 0;
  const isPlayer = faction === 'player';

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
  
  const bodyP = new Graphics().rect(-4, 24, 8, 12).fill(colors.jacket).stroke({ color: 0x000000, width: 1 });
  const headP = new Graphics().circle(0, 22, 4).fill(0xf2c79a).stroke({ color: 0x000000, width: 1 });
  
  // Parachute Scarf node (only for player Captain Chico)
  const parachuteScarf = new Graphics();
  
  parachuteGroup.addChild(canopy, lineL, lineR, lineM1, lineM2, bodyP, headP, parachuteScarf);

  // --- Walking group ---
  const walkingGroup = new Container();
  const bodyW = new Graphics().rect(-3, -8, 6, 14).fill(colors.jacket).stroke({ color: 0x000000, width: 1 });
  const headW = new Graphics().circle(0, -12, 4).fill(0xf2c79a).stroke({ color: 0x000000, width: 1 });
  const legL = new Graphics().rect(-3, 6, 2, 8).fill(0x221a10).stroke({ color: 0x000000, width: 1 });
  const legR = new Graphics().rect(1, 6, 2, 8).fill(0x221a10).stroke({ color: 0x000000, width: 1 });
  const armR = new Graphics().rect(2, -6, 5, 2).fill(colors.jacket).stroke({ color: 0x000000, width: 1 });
  
  // Walking Scarf node (only for player Captain Chico)
  const walkingScarf = new Graphics();
  
  walkingGroup.addChild(legL, legR, bodyW, armR, headW, walkingScarf);
  walkingGroup.visible = false;

  // --- Dead group (prone figure) ---
  const deadGroup = new Container();
  const bodyD = new Graphics().rect(-10, -2, 20, 5).fill(colors.jacket).stroke({ color: 0x000000, width: 1 });
  const headD = new Graphics().circle(-12, 0, 4).fill(0xf2c79a).stroke({ color: 0x000000, width: 1 });
  const legsD = new Graphics().rect(8, -1, 8, 3).fill(0x221a10).stroke({ color: 0x000000, width: 1 });
  const x1 = new Graphics().moveTo(-4, -6).lineTo(4, 2).stroke({ color: 0xff3030, width: 2 });
  const x2 = new Graphics().moveTo(4, -6).lineTo(-4, 2).stroke({ color: 0xff3030, width: 2 });
  
  deadGroup.addChild(bodyD, headD, legsD, x1, x2);
  deadGroup.visible = false;

  c.addChild(parachuteGroup, walkingGroup, deadGroup);

  return {
    container: c,
    update(p: Pilot) {
      c.x = p.position.x;
      c.y = p.position.y;
      
      const isParachuting = p.state === 'parachute';
      const isWalking = p.state === 'walking' || p.state === 'safe';
      
      parachuteGroup.visible = isParachuting;
      walkingGroup.visible = isWalking;
      deadGroup.visible = p.state === 'dead';

      // Steer facing direction
      walkingGroup.scale.x = p.facing === -1 ? -1 : 1;

      // Animate timers
      animTime += 0.15;

      // Chico's dynamic scarf under parachute
      if (isPlayer && isParachuting) {
        parachuteScarf.clear();
        const neckX = 0;
        const neckY = 24;
        
        // Trail opposite to drift direction (facing)
        const windDirection = -p.facing; // trails behind
        // Scarf trails upwards and backwards because the pilot falls down
        const targetX = windDirection * 20;
        const targetY = 8; // higher in screen coordinates
        
        // Waving Bezier curve paths
        const cp1x = neckX + targetX * 0.35 + Math.sin(animTime * 2.2) * 5;
        const cp1y = neckY - (neckY - targetY) * 0.35 + Math.cos(animTime * 1.8) * 3;
        
        const cp2x = neckX + targetX * 0.75 - Math.sin(animTime * 2.2) * 4;
        const cp2y = neckY - (neckY - targetY) * 0.75;
        
        const endX = neckX + targetX + Math.sin(animTime * 2.8) * 6;
        const endY = targetY;
        
        // Primary thick gold strand
        parachuteScarf.moveTo(neckX, neckY)
                      .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
                      .stroke({ color: 0xf4d35e, width: 3.5 });
                      
        // Secondary thinner dark ochre shade strand for texture depth
        parachuteScarf.moveTo(neckX, neckY + 1)
                      .bezierCurveTo(cp1x - 1, cp1y + 1, cp2x - 1, cp2y + 1, endX - 2, endY + 1)
                      .stroke({ color: 0xeab308, width: 1.8 });
      }

      // Chico's walking scarf
      if (isPlayer && isWalking) {
        walkingScarf.clear();
        // Since walkingGroup scales horizontally, draw in local coordinates (facing is baked as positive right)
        const neckX = -1;
        const neckY = -8;
        
        // Trail backwards
        const targetX = -10;
        const targetY = -6;
        
        const cpX = neckX + targetX * 0.5;
        const cpY = neckY + Math.sin(animTime * 1.5) * 2.2;
        
        const endX = neckX + targetX;
        const endY = targetY + Math.sin(animTime * 1.5) * 1.5;
        
        walkingScarf.moveTo(neckX, neckY)
                    .quadraticCurveTo(cpX, cpY, endX, endY)
                    .stroke({ color: 0xf4d35e, width: 2.2 });
      }

      if (p.state === 'dead') {
        deadGroup.alpha = Math.max(0.4, Math.min(1, p.deathTimer / 2.0));
      }
    },
  };
}
