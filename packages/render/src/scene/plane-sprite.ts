import { Container, Graphics } from 'pixi.js';
import type { Plane } from '@biplanes/core';
import { SMOKE_THRESHOLD, FIRE_THRESHOLD } from '@biplanes/shared';
import type { DamageFx } from './damage-fx.js';

export interface PlaneSpriteHandle {
  container: Container;
  update: (p: Plane, dt: number, fx?: DamageFx) => void;
}

export function createPlaneSprite(faction: 'player' | 'enemy'): PlaneSpriteHandle {
  const c = new Container();

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

  // Track previous state to detect the moment of death (for explosion burst).
  let wasAlive = true;
  // Particle emission accumulator — emit ~30Hz for smoke, ~50Hz for fire regardless of frame rate.
  let smokeAcc = 0;
  let fireAcc = 0;

  return {
    container: c,
    update(p: Plane, dt: number, fx?: DamageFx) {
      c.x = p.kinematic.position.x;
      c.y = p.kinematic.position.y;
      if (p.kinematic.facing === -1) {
        c.scale.x = -1;
        c.rotation = Math.PI - p.kinematic.heading;
      } else {
        c.scale.x = 1;
        c.rotation = p.kinematic.heading;
      }
      c.alpha = p.state === 'crashed' ? 0 : 1;

      // ---- Damage effects ----
      const aliveAndFlying = p.alive && p.state === 'flying';
      if (fx) {
        // Tail world-space position (~16 px behind the nose direction).
        // Nose direction is +cos/+sin of heading; tail is the opposite.
        const tailDist = 18;
        const tailX = p.kinematic.position.x - Math.cos(p.kinematic.heading) * tailDist;
        const tailY = p.kinematic.position.y - Math.sin(p.kinematic.heading) * tailDist;

        if (aliveAndFlying) {
          const hpFrac = p.hp / p.maxHp;
          if (hpFrac <= FIRE_THRESHOLD) {
            // Fire + lighter smoke
            fireAcc += dt;
            while (fireAcc >= 1 / 50) {
              fx.addFireTrail({ x: tailX, y: tailY }, 1);
              fireAcc -= 1 / 50;
            }
            smokeAcc += dt;
            while (smokeAcc >= 1 / 25) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 25;
            }
          } else if (hpFrac <= SMOKE_THRESHOLD) {
            smokeAcc += dt;
            while (smokeAcc >= 1 / 30) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 30;
            }
          } else {
            smokeAcc = 0;
            fireAcc = 0;
          }
        }

        // Just died / just crashed → explosion burst.
        if (wasAlive && (!p.alive || p.state === 'crashed')) {
          fx.addExplosion({ x: p.kinematic.position.x, y: p.kinematic.position.y });
        }
      }

      wasAlive = p.alive && p.state !== 'crashed';
    },
  };
}
