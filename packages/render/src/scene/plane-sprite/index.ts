import { Container } from 'pixi.js';
import type { Plane } from '@biplanes/core';
import {
  SMOKE_THRESHOLD,
  FIRE_THRESHOLD,
  HIT_PAUSE_FRAMES_HIT,
  HIT_PAUSE_FRAMES_KILL,
} from '@biplanes/shared';
import type { DamageFx } from '../damage-fx.js';
import type { RenderClock } from '../../render-clock.js';
import type { FloatingNumbers } from '../floating-numbers.js';
import { createPlaneBody } from './body.js';
import { createPlaneControls } from './controls.js';
import { createPilotHead } from './pilot-head.js';

interface CameraLike {
  punch(dx: number, dy: number, amount: number): void;
  shake(amount: number): void;
  zoomPunch(targetMultiplier: number, durSec: number): void;
}

export interface PlaneSpriteHandle {
  container: Container;
  update: (
    p: Plane,
    dt: number,
    fx?: DamageFx,
    clock?: RenderClock,
    camera?: CameraLike,
    numbers?: FloatingNumbers,
  ) => void;
}

export function createPlaneSprite(faction: 'player' | 'enemy'): PlaneSpriteHandle {
  const c = new Container();

  const body = createPlaneBody(faction);
  const { fuselageContainer, wingContainer, propellerContainer, blades, blurDisk } = body;

  c.addChild(wingContainer, fuselageContainer, propellerContainer);

  const controls = createPlaneControls(faction);
  const head = createPilotHead(faction);
  // Stubs in Phase 2.1; will render once 2.3 / 2.4 land.
  fuselageContainer.addChild(controls.container);
  fuselageContainer.addChild(head.container);

  // Track state for interactive visuals and sparks
  let wasAlive = true;
  let prevHp: number | null = null;
  let prevHeading: number | null = null;

  // Particle emission timers
  let smokeAcc = 0;
  let fireAcc = 0;
  let wingTrailAcc = 0;

  return {
    container: c,
    update(
      p: Plane,
      dt: number,
      fx?: DamageFx,
      clock?: RenderClock,
      camera?: CameraLike,
      numbers?: FloatingNumbers,
    ) {
      if (prevHp === null) prevHp = p.hp;
      if (prevHeading === null) prevHeading = p.kinematic.heading;

      c.x = p.kinematic.position.x;
      c.y = p.kinematic.position.y;
      c.scale.x = 1;
      c.rotation = p.kinematic.heading;
      c.alpha = p.state === 'crashed' ? 0 : 1;

      const aliveAndFlying = p.alive && p.state === 'flying';

      // 1. Interactive Propeller Spinning Animation
      if (p.alive && p.state !== 'crashed') {
        const isEngineActive = p.state === 'flying' || p.kinematic.throttleOn;
        if (isEngineActive) {
          const throttle = p.kinematic.throttleLevel ?? 0;
          // Spin speed based on throttle setting
          const spinSpeed = 10 + throttle * 45; // rad/sec
          blades.rotation += spinSpeed * dt;

          // Toggle blurred disc for premium visual speed illusion at high RPM
          blurDisk.visible = throttle > 0.15;
        } else {
          // Slow down propeller to a stop
          blades.rotation *= 0.95;
          blurDisk.visible = false;
        }
      } else {
        blurDisk.visible = false;
      }

      // 2. Damage impact sparks trigger
      if (aliveAndFlying && p.hp < prevHp) {
        const wasKill = p.hp <= 0 && prevHp > 0;
        if (fx) {
          fx.addSparks({ x: p.kinematic.position.x, y: p.kinematic.position.y }, 18);
          fx.addImpactFlash({ x: p.kinematic.position.x, y: p.kinematic.position.y });
        }
        if (clock) {
          clock.hitPause(wasKill ? HIT_PAUSE_FRAMES_KILL : HIT_PAUSE_FRAMES_HIT);
        }
        if (camera) {
          const dirX = p.kinematic.velocity.x;
          const dirY = p.kinematic.velocity.y;
          camera.punch(-dirX, -dirY, 3);
          camera.shake(wasKill ? 8 : 4);
          if (wasKill) camera.zoomPunch(1.04, 0.1);
        }
        if (numbers) {
          const damageDealt = prevHp - p.hp;
          if (damageDealt > 0) {
            const isPlayerDealing = p.faction === 'enemy';
            numbers.spawn(
              p.kinematic.position.x,
              p.kinematic.position.y,
              damageDealt,
              isPlayerDealing,
            );
          }
        }
      }
      prevHp = p.hp;

      // 3. Aerodynamic Vortex Wingtip Trails
      if (fx && aliveAndFlying) {
        // Calculate hard-G turns or stall conditions
        const isStalling = p.kinematic.g < 620; // stalled flight

        let headingDiff = Math.abs(p.kinematic.heading - prevHeading);
        if (headingDiff > Math.PI) {
          headingDiff = Math.PI * 2 - headingDiff;
        }
        const turnRate = headingDiff / Math.max(0.001, dt);
        const isHighG = turnRate > 1.35; // turning extremely sharply

        if (isStalling || isHighG) {
          wingTrailAcc += dt;
          // Emit aerodynamic trails at ~40Hz
          while (wingTrailAcc >= 1 / 40) {
            const cos = Math.cos(p.kinematic.heading);
            const sin = Math.sin(p.kinematic.heading);

            // Convert top and bottom wingtips from local (-10, -18) and (-10, 15) to world space
            const tx = p.kinematic.position.x - 10 * cos - (-18) * sin;
            const ty = p.kinematic.position.y - 10 * sin + (-18) * cos;

            const bx = p.kinematic.position.x - 10 * cos - 15 * sin;
            const by = p.kinematic.position.y - 10 * sin + 15 * cos;

            fx.addWindTrail({ x: tx, y: ty });
            fx.addWindTrail({ x: bx, y: by });

            wingTrailAcc -= 1 / 40;
          }
        } else {
          wingTrailAcc = 0;
        }
      } else {
        wingTrailAcc = 0;
      }
      prevHeading = p.kinematic.heading;

      // 4. Fire and smoke damage trails
      if (fx) {
        const tailDist = 18;
        const tailX = p.kinematic.position.x - Math.cos(p.kinematic.heading) * tailDist;
        const tailY = p.kinematic.position.y - Math.sin(p.kinematic.heading) * tailDist;

        if (aliveAndFlying) {
          const hpFrac = p.hp / p.maxHp;
          if (hpFrac <= FIRE_THRESHOLD) {
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

        // Sudden death explosion burst
        if (wasAlive && (!p.alive || p.state === 'crashed')) {
          fx.addExplosion({ x: p.kinematic.position.x, y: p.kinematic.position.y });
        }
      }

      wasAlive = p.alive && p.state !== 'crashed';
    },
  };
}
