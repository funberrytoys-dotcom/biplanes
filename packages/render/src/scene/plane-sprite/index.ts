import { Container, Graphics } from 'pixi.js';
import type { Plane, PlaneState } from '@biplanes/core';
import {
  SMOKE_THRESHOLD,
  FIRE_THRESHOLD,
  HIT_PAUSE_FRAMES_EXPLODE,
  G_STALL,
  G_MAX_LEVEL,
  GROUND_Y,
  PLANE_INITIAL_HP,
} from '@biplanes/shared';
import type { DamageFx } from '../damage-fx.js';
import type { RenderClock } from '../../render-clock.js';
import type { FloatingNumbers } from '../floating-numbers.js';
import type { GroundFx } from '../ground-fx.js';
import type { ScreenEffectsHandle } from '../screen-effects.js';
import { createPlaneBody } from './body.js';
import { createPlaneControls } from './controls.js';
import { createPilotHead } from './pilot-head.js';
import { resolveGunfeelImpact, shouldApplyImpactCamera } from '../gunfeel-math.js';

interface CameraLike {
  punch(dx: number, dy: number, amount: number): void;
  shake(amount: number): void;
  zoomPunch(targetMultiplier: number, durSec: number): void;
}

export interface PlaneSpriteUpdateOpts {
  screenFx?: ScreenEffectsHandle;
}

export interface PlaneSpriteHandle {
  container: Container;
  /** Screen-aligned HP bar that floats above the plane (does not rotate with the body). */
  hpBar: Container;
  update: (
    p: Plane,
    dt: number,
    fx?: DamageFx,
    clock?: RenderClock,
    camera?: CameraLike,
    numbers?: FloatingNumbers,
    groundFx?: GroundFx,
    opts?: PlaneSpriteUpdateOpts,
  ) => void;
}

export function createPlaneSprite(faction: 'player' | 'enemy'): PlaneSpriteHandle {
  const c = new Container();

  const body = createPlaneBody(faction);
  const {
    fuselageContainer,
    wingContainer,
    propellerContainer,
    usesFullSpriteArt,
    blades,
    blurDisk,
    wingShadow,
    fuselageGlint,
    propellerX,
    updateArt,
  } = body;

  c.addChild(wingContainer, fuselageContainer, propellerContainer);
  // Planes read a touch bigger/chunkier (closer to the Godot build's scale). Purely
  // cosmetic — gameplay hitboxes live in the core and are unchanged.
  const VISUAL_SCALE = 1.3;
  wingContainer.scale.set(VISUAL_SCALE);
  fuselageContainer.scale.set(VISUAL_SCALE);
  propellerContainer.scale.set(VISUAL_SCALE);

  // Propeller motion blur spokes (Task 2.8). Added BEFORE the blades so
  // they render under the spinner/blade overlay.
  const spokes = new Graphics();
  propellerContainer.addChildAt(spokes, propellerContainer.children.indexOf(blades));

  const controls = createPlaneControls(faction);
  const head = createPilotHead(faction);
  controls.container.visible = !usesFullSpriteArt;
  head.container.visible = !usesFullSpriteArt;
  fuselageContainer.addChild(controls.container);
  fuselageContainer.addChild(head.container);

  // Track state for interactive visuals and sparks
  let wasAlive = true;
  let prevHp: number | null = null;
  let prevHeading: number | null = null;
  let prevState: PlaneState | null = null;

  // Wingtip coordinates for continuous ribbon trails (Phase 3)
  let prevTx: number | null = null;
  let prevTy: number | null = null;
  let prevBx: number | null = null;
  let prevBy: number | null = null;

  // Particle emission timers
  let smokeAcc = 0;
  let fireAcc = 0;
  let exhaustAcc = 0;
  let dustAcc = 0;

  // Banking visual squeeze (Task 2.2)
  let bankT = 0;

  // Throttle bob tracking for pilot head (Task 2.4)
  let prevThrottle = 0;
  let shudderTime = 0;

  // Wind streak accumulator (Task 3.2 — player only at high g)
  let windAcc = 0;

  // Screen-aligned HP bar. Lives in its own container so it doesn't rotate
  // with the plane body. Width auto-scales with maxHp so the +50% HP upgrade
  // ("Reinforced armor") visibly extends the bar.
  const hpBar = new Container();
  const hpBarBg = new Graphics();
  const hpBarFill = new Graphics();
  hpBar.addChild(hpBarBg, hpBarFill);
  let lastDrawnMaxHp = -1;
  const HP_BAR_HEIGHT = 3;
  const HP_BAR_BASE_W = 30; // px per PLANE_INITIAL_HP
  const HP_BAR_Y_OFFSET = -34;

  function hpBarWidth(p: Plane) {
    const scaled = HP_BAR_BASE_W * (p.maxHp / PLANE_INITIAL_HP);
    return Math.min(p.isBoss ? 96 : 54, scaled);
  }

  return {
    container: c,
    hpBar,
    update(
      p: Plane,
      dt: number,
      fx?: DamageFx,
      clock?: RenderClock,
      camera?: CameraLike,
      numbers?: FloatingNumbers,
      groundFx?: GroundFx,
      opts?: PlaneSpriteUpdateOpts,
    ) {
      if (prevHp === null) prevHp = p.hp;
      if (prevHeading === null) prevHeading = p.kinematic.heading;
      if (prevState === null) prevState = p.state;

      // Detect flying → dying transition: emit two chunky fuselage-colored pieces
      // at the lethal moment.
      const transitionedToDying = prevState === 'flying' && p.state === 'dying';
      if (transitionedToDying && fx) {
        const bodyColor = faction === 'player' ? 0xf4d35e : 0xc0392b;
        fx.addDebris(p.kinematic.position, bodyColor);
      }

      updateArt(dt);

      const taxiLean =
        faction === 'player' && p.state === 'taxi'
          ? Math.max(0, 1 - Math.min(1, p.kinematic.g / 260))
          : 0;
      const enemyRunwayVisual = faction === 'enemy' && p.state === 'taxi';

      c.x = p.kinematic.position.x;
      c.y = p.kinematic.position.y + taxiLean * 3.5;
      const spriteScale = p.visualScale ?? 1;
      c.scale.x = (enemyRunwayVisual ? -1 : 1) * spriteScale;
      c.scale.y = spriteScale;
      if (enemyRunwayVisual) {
        let runwayHeading = p.kinematic.heading - Math.PI;
        while (runwayHeading > Math.PI) runwayHeading -= Math.PI * 2;
        while (runwayHeading < -Math.PI) runwayHeading += Math.PI * 2;
        c.rotation = runwayHeading;
      } else {
        c.rotation = p.kinematic.heading - taxiLean * 0.13;
      }
      c.alpha = p.state === 'crashed' ? 0 : 1;

      const aliveAndFlying = p.alive && p.state === 'flying';

      // Compute turn rate once — reused by bank squeeze (Task 2.2) and body shake (Task 2.5)
      let turnRate: number;
      {
        let headingDiff = Math.abs(p.kinematic.heading - prevHeading);
        if (headingDiff > Math.PI) headingDiff = Math.PI * 2 - headingDiff;
        turnRate = headingDiff / Math.max(0.001, dt);
      }

      // Visible bank squeeze on hard turns (Task 2.2)
      {
        const target = Math.min(1, turnRate / 2.5);
        const speed = 6 * dt;
        bankT += (target - bankT) * speed;
        c.scale.y = 1 - bankT * 0.12;
      }

      // Dynamic specular highlight and shadow cast (Phase 1.1).
      // Disabled for full sprite-sheet planes: the painted art already includes
      // its own cockpit, pilot, shadows, highlights, and propeller frames.
      if (!usesFullSpriteArt) {
        // Sun position assumed at top-right (approx -Math.PI / 4)
        const SUN_ANGLE = -Math.PI / 4;
        const relativeAngle = p.kinematic.heading - SUN_ANGLE;
        
        // specularity is maximized when the fuselage curvature aligns with the sun
        const lightFactor = Math.max(0, Math.cos(relativeAngle));
        fuselageGlint.alpha = 0.15 + 0.65 * lightFactor;

        // shadow casts down and leftwards relative to the sun direction
        const shadowAngle = relativeAngle;
        wingShadow.x = Math.sin(shadowAngle) * 5.5;
      }

      // Aileron / elevator / rudder deflection (Task 2.3)
      if (!usesFullSpriteArt) {
        const rawDelta = p.kinematic.heading - prevHeading;
        // Wrap to [-π, π] so a heading wrap doesn't slam the controls.
        let headingDelta = rawDelta;
        if (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
        else if (headingDelta < -Math.PI) headingDelta += Math.PI * 2;
        const rotateInput = Math.sign(headingDelta);
        controls.update(rotateInput, headingDelta, dt);
      }

      // Pilot head bob on throttle change (Task 2.4)
      if (!usesFullSpriteArt) {
        const cur = p.kinematic.throttleLevel ?? 0;
        const throttleChange = cur - prevThrottle;
        head.update(throttleChange, dt);
        prevThrottle = cur;
      }

      // Body shake under deep stall / hard maneuver (Task 2.5).
      // The stall shudder ramps in only once speed drops MEANINGFULLY below the
      // stall line. Normal cruise sits just under G_STALL (stall-edge flight is
      // the signature feel), so shaking at exactly G_STALL made the plane jitter
      // every frame during ordinary flight.
      {
        let shakeX = 0;
        let shakeY = 0;
        if (aliveAndFlying) {
          shudderTime += dt;
          const stallShakeFloor = G_STALL * 0.8;
          if (p.kinematic.g < stallShakeFloor) {
            const depth = Math.min(1, (stallShakeFloor - p.kinematic.g) / stallShakeFloor);
            const amp = 2.4 * depth;
            shakeX = Math.sin(shudderTime * 42) * amp;
            shakeY = Math.sin(shudderTime * 57 + 1.8) * amp * 0.7;
          } else if (turnRate > 1.5) {
            // Hard maneuver — subtle buffet
            const amp = Math.min(1, (turnRate - 1.5) / 2.8);
            shakeX = Math.sin(shudderTime * 36 + 0.6) * amp;
            shakeY = Math.sin(shudderTime * 48 + 2.2) * amp * 0.5;
          }
        } else {
          shudderTime = 0;
        }
        fuselageContainer.x = shakeX;
        fuselageContainer.y = shakeY;
      }

      // (Removed: full-throttle heat shimmer — its soft additive blobs over the
      // nose made the plane read as blurry at full gas.)

      // Wind streaks at high g (Task 3.2 — player only). Spawn BEHIND the plane
      // so they read as a speed trail, never a haze over the fuselage.
      if (fx && p.kinematic.g > G_MAX_LEVEL * 0.85 && aliveAndFlying && p.faction === 'player') {
        windAcc += dt;
        const cos = Math.cos(p.kinematic.heading);
        const sin = Math.sin(p.kinematic.heading);
        while (windAcc >= 1 / 30) {
          const back = 46 + Math.random() * 54;       // 46–100px behind the nose
          const lateral = (Math.random() - 0.5) * 64;  // spread across the wings
          const px = p.kinematic.position.x - cos * back - sin * lateral;
          const py = p.kinematic.position.y - sin * back + cos * lateral;
          fx.addWindStreak({ x: px, y: py }, p.kinematic.heading);
          windAcc -= 1 / 30;
        }
      } else {
        windAcc = 0;
      }

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

      // 1b. Propeller motion-blur radial spokes + strobing (Task 2.8)
      spokes.clear();
      {
        const throttle = p.kinematic.throttleLevel ?? 0;
        if (throttle > 0.3 && aliveAndFlying) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + blades.rotation;
            spokes
              .moveTo(propellerX + Math.cos(a) * 4, Math.sin(a) * 4)
              .lineTo(propellerX + Math.cos(a) * 22, Math.sin(a) * 22)
              .stroke({ color: 0xeeeeee, width: 1, alpha: 0.3 });
          }
          if (throttle > 0.4 && throttle < 0.7) {
            const strobe = (Math.sin(blades.rotation * 4) + 1) * 0.5;
            blurDisk.alpha = 0.06 + strobe * 0.12;
          } else {
            blurDisk.alpha = 0.16;
          }
        }
      }

      // 2. Damage impact sparks trigger
      if (aliveAndFlying && p.hp < prevHp) {
        const wasKill = p.hp <= 0 && prevHp > 0;
        const incomingHeading = Math.atan2(p.kinematic.velocity.y, p.kinematic.velocity.x) + Math.PI;
        const impact = resolveGunfeelImpact({
          incomingHeadingRad: incomingHeading,
          isHeavy: wasKill,
          killed: wasKill,
        });
        if (fx) {
          fx.addDirectionalSparks(
            { x: p.kinematic.position.x, y: p.kinematic.position.y },
            impact.sparkDirection,
            impact.sparkCount,
            wasKill ? 1.35 : 1,
          );
          fx.addImpactFlash({ x: p.kinematic.position.x, y: p.kinematic.position.y }, impact.flashRadius);
        }
        const applyImpactCamera = shouldApplyImpactCamera({
          targetFaction: p.faction,
          killed: wasKill,
        });
        if (clock && applyImpactCamera) {
          clock.hitPause(impact.hitPauseFrames);
        }
        if (camera && applyImpactCamera) {
          camera.punch(-impact.sparkDirection.x, -impact.sparkDirection.y, impact.cameraPunch);
          camera.shake(impact.cameraShake);
          camera.zoomPunch(impact.zoomPunch, wasKill ? 0.12 : 0.08);
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

      // 3. Aerodynamic Vortex Wingtip Trails (Vapor Ribbons — Phase 3)
      if (fx && aliveAndFlying) {
        const isStalling = p.kinematic.g < G_STALL;
        const isHighG = turnRate > 1.35;

        const cos = Math.cos(p.kinematic.heading);
        const sin = Math.sin(p.kinematic.heading);

        // Convert top and bottom wingtips from local (-10, -18) and (-10, 15) to world space
        const tx = p.kinematic.position.x - 10 * cos - (-18) * sin;
        const ty = p.kinematic.position.y - 10 * sin + (-18) * cos;

        const bx = p.kinematic.position.x - 10 * cos - 15 * sin;
        const by = p.kinematic.position.y - 10 * sin + 15 * cos;

        if (isStalling || isHighG) {
          if (prevTx !== null && prevTy !== null && prevBx !== null && prevBy !== null) {
            fx.addVaporSegment({ x: prevTx, y: prevTy }, { x: tx, y: ty }, 2.8);
            fx.addVaporSegment({ x: prevBx, y: prevBy }, { x: bx, y: by }, 2.8);
          }
          prevTx = tx;
          prevTy = ty;
          prevBx = bx;
          prevBy = by;
        } else {
          prevTx = null;
          prevTy = null;
          prevBx = null;
          prevBy = null;
        }
      } else {
        prevTx = null;
        prevTy = null;
        prevBx = null;
        prevBy = null;
      }
      prevHeading = p.kinematic.heading;

      // 4. Fire and smoke damage trails
      const isDying = p.state === 'dying';
      if (fx) {
        const tailDist = 18;
        const tailX = p.kinematic.position.x - Math.cos(p.kinematic.heading) * tailDist;
        const tailY = p.kinematic.position.y - Math.sin(p.kinematic.heading) * tailDist;
        const throttle = p.kinematic.throttleLevel ?? 0;

        if ((aliveAndFlying || p.state === 'taxi') && throttle > 0.12) {
          exhaustAcc += dt * (0.7 + throttle);
          while (exhaustAcc >= 1 / 18) {
            fx.addEngineExhaust({ x: tailX, y: tailY }, throttle);
            exhaustAcc -= 1 / 18;
          }
        } else {
          exhaustAcc = 0;
        }

        if (p.state === 'taxi' && throttle > 0.2) {
          dustAcc += dt * throttle;
          while (dustAcc >= 1 / 16) {
            fx.addRunwayDust({
              x: p.kinematic.position.x - Math.cos(p.kinematic.heading) * 12,
              y: p.kinematic.position.y + 3,
            }, 1);
            dustAcc -= 1 / 16;
          }
        } else {
          dustAcc = 0;
        }

        if (isDying) {
          // Cranked emission while spinning down — heavy fire + heavy smoke.
          fireAcc += dt * 2.5;
          smokeAcc += dt * 2.5;
          while (fireAcc >= 1 / 50) {
            fx.addFireTrail({ x: tailX, y: tailY }, 1);
            fireAcc -= 1 / 50;
          }
          while (smokeAcc >= 1 / 25) {
            fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
            smokeAcc -= 1 / 25;
          }
        } else if (aliveAndFlying) {
          // Emission rates are halved vs. the original tuning to cap particle
          // churn on mobile (fire ~26/sec, smoke ~14/sec at fire threshold;
          // smoke ~16/sec at smoke threshold).
          const hpFrac = p.hp / p.maxHp;
          if (hpFrac <= FIRE_THRESHOLD) {
            fireAcc += dt;
            while (fireAcc >= 1 / 26) {
              fx.addFireTrail({ x: tailX, y: tailY }, 1);
              fireAcc -= 1 / 26;
            }
            smokeAcc += dt;
            while (smokeAcc >= 1 / 14) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 14;
            }
          } else if (hpFrac <= SMOKE_THRESHOLD) {
            smokeAcc += dt;
            while (smokeAcc >= 1 / 16) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 16;
            }
          } else {
            smokeAcc = 0;
            fireAcc = 0;
          }
        }

        // Sudden death explosion burst — fires only for self-crashes (ground impact,
        // taxi-off-edge, fire-burn). Lethal-hit deaths go through 'dying' and trigger
        // the bigger cinematic explosion below at the dying → crashed transition.
        if (wasAlive && p.state === 'crashed' && prevState !== 'dying') {
          fx.addExplosion({ x: p.kinematic.position.x, y: p.kinematic.position.y });
          if (groundFx && p.kinematic.position.y > GROUND_Y - 10) {
            groundFx.spawnCrater(p.kinematic.position.x, p.kinematic.position.y);
          }
        }

        // Final cinematic explosion at end of death-spin (dying → crashed).
        const becameCrashed = prevState === 'dying' && p.state === 'crashed';
        if (becameCrashed) {
          fx.addExplosion({ x: p.kinematic.position.x, y: p.kinematic.position.y });
          fx.addExplosion({ x: p.kinematic.position.x, y: p.kinematic.position.y }); // double-up
          if (clock) clock.hitPause(HIT_PAUSE_FRAMES_EXPLODE);
          if (camera) {
            camera.shake(12);
            camera.zoomPunch(1.02, 0.15);
          }
          if (opts?.screenFx) opts.screenFx.flash(0xffa040, 0.5, 0.3);
          if (groundFx && p.kinematic.position.y > GROUND_Y - 10) {
            groundFx.spawnCrater(p.kinematic.position.x, p.kinematic.position.y);
          }
        }
      }

      // HP bar: screen-aligned, follows the plane in world space, hidden when
      // crashed. Width scales with maxHp so the +50% upgrade visibly widens it.
      {
        const visible = p.state === 'flying' || p.state === 'dying' || p.state === 'taxi';
        hpBar.visible = visible;
        if (visible) {
          if (p.maxHp !== lastDrawnMaxHp) {
            const w = hpBarWidth(p);
            hpBarBg.clear()
              .rect(-w / 2, 0, w, p.isBoss ? HP_BAR_HEIGHT + 2 : HP_BAR_HEIGHT)
              .fill({ color: 0x000000, alpha: 0.6 })
              .stroke({ color: 0x000000, width: 1, alpha: 0.9 });
            lastDrawnMaxHp = p.maxHp;
          }
          const w = hpBarWidth(p);
          const hpFrac = Math.max(0, Math.min(1, p.hp / p.maxHp));
          // Color shifts green → yellow → red as HP drops.
          let fillColor = 0x4ade80;
          if (hpFrac <= 0.25) fillColor = 0xef4444;
          else if (hpFrac <= 0.5) fillColor = 0xfacc15;
          hpBarFill.clear()
            .rect(-w / 2, 0, w * hpFrac, p.isBoss ? HP_BAR_HEIGHT + 2 : HP_BAR_HEIGHT)
            .fill({ color: fillColor });
          hpBar.x = p.kinematic.position.x;
          hpBar.y = p.kinematic.position.y + (p.isBoss ? HP_BAR_Y_OFFSET - 16 : HP_BAR_Y_OFFSET);
        }
      }

      wasAlive = p.alive && p.state !== 'crashed';
      prevState = p.state;
    },
  };
}
