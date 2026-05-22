import { Container, Graphics } from 'pixi.js';
import type { Plane } from '@biplanes/core';
import {
  SMOKE_THRESHOLD,
  FIRE_THRESHOLD,
  HIT_PAUSE_FRAMES_HIT,
  HIT_PAUSE_FRAMES_KILL,
} from '@biplanes/shared';
import type { DamageFx } from './damage-fx.js';
import type { RenderClock } from '../render-clock.js';

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
  ) => void;
}

export function createPlaneSprite(faction: 'player' | 'enemy'): PlaneSpriteHandle {
  const c = new Container();

  // Create sub-containers for layered drawing
  const wingContainer = new Container();
  const fuselageContainer = new Container();
  const propellerContainer = new Container();
  c.addChild(wingContainer, fuselageContainer, propellerContainer);

  const isPlayer = faction === 'player';
  const primaryColor = isPlayer ? 0xf4d35e : 0xc0392b;    // Warm yellow / Crimson red
  const secondaryColor = isPlayer ? 0xeab308 : 0x962d22;  // Golden ochre / Dark burgundy
  const metalColor = 0x5a5f69;                            // Steel grey for engine cylinders
  const outlineColor = 0x000000;

  // 1. Draw Exposed Cylinder Engine (Radial block at the nose)
  const engineNode = new Graphics();
  // Drawing 4 small engine cylinder caps radiating near the cowling
  engineNode.circle(13, -6, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(13, 6, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(10, -9, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  engineNode.circle(10, 9, 2.5).fill(metalColor).stroke({ color: outlineColor, width: 1 });
  fuselageContainer.addChild(engineNode);

  // 2. Draw Aerodynamic Fuselage (Body)
  const body = new Graphics();
  // Curved top cockpit hump, sleek tapered tail, and large vertical rudder
  body.moveTo(18, 0)
      .bezierCurveTo(18, -6, 8, -8, -4, -6)        // nose to cockpit hump
      .lineTo(-14, -4)                             // tail taper upper
      .lineTo(-18, -12)                            // vertical stabilizer top
      .lineTo(-15, -12)
      .lineTo(-10, -4)                             // vertical stabilizer back
      .lineTo(-12, 0)                              // tail point
      .lineTo(-12, 4)                              // lower tail taper
      .lineTo(12, 6)                               // belly
      .closePath()
      .fill(primaryColor)
      .stroke({ color: outlineColor, width: 1.8 });

  // Fuselage canopy glass / decorative stripes
  const canopy = new Graphics()
    .moveTo(4, -6)
    .lineTo(8, -6)
    .bezierCurveTo(6, -2, 2, -2, 0, -5)
    .closePath()
    .fill(isPlayer ? 0x66d9ef : 0xe74c3c); // Blue / Red canopy glass

  fuselageContainer.addChild(body, canopy);

  // 3. Draw Unique Faction Stencil Symbols on the Fuselage
  const symbol = new Graphics();
  if (isPlayer) {
    // Draw military-style stencil "01" on player plane
    symbol
      // "0"
      .rect(-6, -2, 4, 5).stroke({ color: 0xffffff, width: 1.5 })
      // "1"
      .moveTo(0, -2).lineTo(0, 3).stroke({ color: 0xffffff, width: 1.5 });
  } else {
    // Draw double crimson scratch markings / skull-ish cross on enemies
    symbol
      .moveTo(-6, -2).lineTo(-2, 2).stroke({ color: outlineColor, width: 2 })
      .moveTo(-2, -2).lineTo(-6, 2).stroke({ color: outlineColor, width: 2 })
      .moveTo(-5, -2).lineTo(-1, 2).stroke({ color: 0xff3333, width: 1 })
      .moveTo(-1, -2).lineTo(-5, 2).stroke({ color: 0xff3333, width: 1 });
  }
  fuselageContainer.addChild(symbol);

  // 4. Draw Biplane Wings with wire struts
  const wingTop = new Graphics()
    .roundRect(-10, -18, 22, 5, 2.5)
    .fill(secondaryColor)
    .stroke({ color: outlineColor, width: 1.5 });
    
  const wingBot = new Graphics()
    .roundRect(-10, 13, 22, 5, 2.5)
    .fill(secondaryColor)
    .stroke({ color: outlineColor, width: 1.5 });

  // Wire struts connecting top and bottom wings visually
  const wires = new Graphics()
    .moveTo(-8, -13).lineTo(-8, 13) // Left vertical strut
    .moveTo(8, -13).lineTo(8, 13)   // Right vertical strut
    .moveTo(-8, -13).lineTo(8, 13)  // Diagonal strut wire
    .stroke({ color: 0x222222, width: 1, alpha: 0.65 });

  wingContainer.addChild(wires, wingTop, wingBot);

  // 5. Draw Propeller Spinner and Blades
  // Blurred speed disk behind the propeller blades
  const blurDisk = new Graphics()
    .ellipse(20, 0, 3, 20)
    .fill({ color: 0xffffff, alpha: 0.16 });
  blurDisk.visible = false;
  propellerContainer.addChild(blurDisk);

  const blades = new Graphics();
  // Nose spinner cap
  blades.circle(20, 0, 3.5).fill(0xd3d3d3).stroke({ color: outlineColor, width: 1.2 });
  // Dynamic blades structure (starts pointing up/down)
  blades.moveTo(20, 0)
        .lineTo(19, -17).lineTo(21, -17)
        .lineTo(20, 0)
        .lineTo(19, 17).lineTo(21, 17)
        .closePath()
        .fill(0xd8d8d8)
        .stroke({ color: outlineColor, width: 1 });
  
  // Pivot propeller blades at the nose spinner center
  blades.pivot.set(20, 0);
  blades.x = 20;
  blades.y = 0;
  propellerContainer.addChild(blades);

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
    update(p: Plane, dt: number, fx?: DamageFx, clock?: RenderClock, camera?: CameraLike) {
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
