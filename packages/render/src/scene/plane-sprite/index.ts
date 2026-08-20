import { Container, Graphics, Sprite } from 'pixi.js';
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
import { nextStick, type Stick } from './pose.js';
import { createPlaneControls } from './controls.js';
import { createPilotHead } from './pilot-head.js';
import { advanceKick, flightRollDegrees, flightWobble, wobblePhase, type KickState } from './wobble.js';
import { resolveGunfeelImpact, shouldApplyImpactCamera } from '../gunfeel-math.js';

interface CameraLike {
  punch(dx: number, dy: number, amount: number): void;
  shake(amount: number): void;
  zoomPunch(targetMultiplier: number, durSec: number): void;
}

export { use3dPlaneArt } from './body.js';

export interface PlaneSpriteUpdateOpts {
  screenFx?: ScreenEffectsHandle;
  /** No sun, no shadow: night skies get none at all. */
  sunless?: boolean;
  /** Actual ground Y of the current world (worldHeight − 90). The arena world is 3×
   *  tall, so the shared GROUND_Y constant is wrong there — pass the real one. */
  groundY?: number;
  /** 0..1 gustiness of the current weather. Feeds the flight sway only: planes
   *  rock harder in a storm than on a clear day. Purely cosmetic. */
  turbulence?: number;
}

export interface PlaneSpriteHandle {
  container: Container;
  /** Screen-aligned HP bar that floats above the plane (does not rotate with the body). */
  hpBar: Container;
  /** Flat ground shadow on the deck below the plane; scales/fades with altitude. */
  shadow: Container;
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
  /** Free this sprite's display objects (children only — keeps the shared spritesheet). */
  destroy: () => void;
}

// `faction` = combat role (drives gameplay-side visuals like contrails/taxi/camera).
// `visual` = colour scheme (С.О.В.-blue uses 'player' art, Jackal-crimson uses 'enemy'
// art). They differ when the player picks the Crimson Jackals: the player plane is
// drawn crimson ('enemy' scheme) and the enemies blue ('player' scheme).
export function createPlaneSprite(
  faction: 'player' | 'enemy',
  visual: 'player' | 'enemy' = faction,
  // Hero planes (the player's own + bosses) get the faction HERO in the cockpit
  // (Chico / Baron); everyone else gets the rank-and-file pilot (cat / jackal).
  heroPilot = false,
  // Which Jackal squadron this airframe belongs to (3D art only): enemies
  // alternate so a wave is not a row of identical planes.
  variant = 0,
): PlaneSpriteHandle {
  const c = new Container();

  const body = createPlaneBody(visual, heroPilot, variant);
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
  // Planes read clearly bigger/chunkier (closer to the Godot build's scale). Purely
  // cosmetic — gameplay hitboxes live in the core and are unchanged.
  const VISUAL_SCALE = 1.5;
  wingContainer.scale.set(VISUAL_SCALE);
  fuselageContainer.scale.set(VISUAL_SCALE);
  propellerContainer.scale.set(VISUAL_SCALE);

  // Propeller motion blur spokes (Task 2.8). Added BEFORE the blades so
  // they render under the spinner/blade overlay.
  const spokes = new Graphics();
  propellerContainer.addChildAt(spokes, propellerContainer.children.indexOf(blades));

  const controls = createPlaneControls(visual);
  const head = createPilotHead(visual);
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

  // Where the stick is, and how far the airframe is banked — see pose.ts. The
  // stick is sticky: the aeroplane is always drifting a little in pitch, so a
  // bare sign test would flick the elevator back and forth every other frame.
  let stick: Stick = 0;
  let rollDeg = 0;

  // Flight motion — see wobble.ts. Render-only, so it never reaches the sim.
  let wobbleTime = 0;
  let wobbleEnv = 0;
  let wobblePhaseValue: number | null = null;
  let kick: KickState = { value: 0, velocity: 0 };
  let prevPitchRate = 0;
  // Signed pitch rate, shared by the elevator picker and the manoeuvre kick.
  let pitchRate = 0;

  // Throttle bob tracking for pilot head (Task 2.4)
  let prevThrottle = 0;
  let shudderTime = 0;

  // Wind streak accumulator (Task 3.2 — player only at high g)
  let windAcc = 0;
  let vaporTick = 0; // throttles wingtip contrail emission

  // Screen-aligned HP bar. Lives in its own container so it doesn't rotate
  // with the plane body. Width auto-scales with maxHp so the +50% HP upgrade
  // ("Reinforced armor") visibly extends the bar.
  const hpBar = new Container();
  const hpBarBg = new Graphics();
  const hpBarFill = new Graphics();
  hpBar.addChild(hpBarBg, hpBarFill);

  // Ground shadow — the aircraft's own silhouette laid on the deck, not a blob:
  // the current sheet frame, tinted black and squashed flat, so wings, tail and
  // spinning propeller all read in the shadow. Biggest and darkest at ground
  // level, shrinking and fading as the plane climbs, gone up high.
  const shadow = new Container();
  const shadowSprite = new Sprite();
  shadowSprite.anchor.set(0.5);
  shadowSprite.tint = 0x000000;
  shadow.addChild(shadowSprite);
  shadow.visible = false;
  const SHADOW_SQUASH = 0.34;   // how flat it lies on the deck
  const SHADOW_SWING = 0.32;    // how much of the plane's bank the shadow shows
  // Only show right at the deck (takeoff/landing). A larger range made shadows float
  // in mid-air below low-flying planes — there's no visible ground up there, so it
  // read as a blob "near the wings". Tight band = a real takeoff shadow only.
  const SHADOW_MAX_ALT = 190;
  let lastDrawnMaxHp = -1;
  let lastDrawnHpFrac = -1;
  let lastFillMaxHp = -1;
  const HP_BAR_HEIGHT = 6;
  const HP_BAR_BASE_W = 42; // px per PLANE_INITIAL_HP
  const HP_BAR_Y_OFFSET = -44;

  function hpBarWidth(p: Plane) {
    const scaled = HP_BAR_BASE_W * (p.maxHp / PLANE_INITIAL_HP);
    // Floor so low-HP enemies (e.g. 30 HP) still get a readable bar, not a sliver.
    return Math.max(28, Math.min(p.isBoss ? 160 : 116, scaled));
  }

  return {
    container: c,
    hpBar,
    shadow,
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
        const bodyColor = visual === 'player' ? 0x4f86c6 : 0xc0392b;
        fx.addDebris(p.kinematic.position, bodyColor);
      }

      // Elevator: this is a looping dogfighter, so a turn IS a pitch change and
      // the elevator is the surface doing the work — the one thing a side-on
      // camera can actually read. Positive heading change swings the nose the
      // way stick-forward does, whichever way round the aircraft happens to be.
      {
        let delta = p.kinematic.heading - prevHeading;
        if (delta > Math.PI) delta -= Math.PI * 2;
        else if (delta < -Math.PI) delta += Math.PI * 2;
        pitchRate = delta / Math.max(0.001, dt);
        stick = nextStick(stick, pitchRate, p.alive && p.state === 'flying');
      }
      // The propeller is its own sheet now, spun by the throttle rather than
      // baked at one speed — see prop-spin.ts.
      {
        const engineOn = p.alive && p.state !== 'crashed'
          && (p.state === 'flying' || (p.kinematic.throttleOn ?? false));
        updateArt(dt, { rollDeg, stick }, engineOn, p.kinematic.throttleLevel ?? 0);
      }

      // Ground shadow: directly under the plane, biggest/darkest near the deck,
      // shrinking + fading with altitude until it vanishes high up. Uses the world's
      // REAL ground (worldHeight−90), not the shared GROUND_Y (wrong in the 3×-tall arena).
      {
        const groundY = opts?.groundY ?? GROUND_Y;
        const altitude = Math.max(0, groundY - p.kinematic.position.y);
        const k = Math.max(0, 1 - altitude / SHADOW_MAX_ALT);
        if (k > 0.02 && p.alive && p.state !== 'crashed' && !opts?.sunless) {
          const s = (0.62 + k * 0.95) * (p.visualScale ?? 1);
          shadow.visible = true;
          shadow.x = p.kinematic.position.x;
          // Sit below the fuselage (the plane's spawn origin is AT groundY, so the body
          // straddles the line) — pushes the shadow under the wheels, not the wings.
          shadow.y = groundY + 22 * (p.visualScale ?? 1);
          const tex = body.artSprite.texture;
          if (tex) shadowSprite.texture = tex;
          const w = body.artScale * VISUAL_SCALE * s;
          // mirrored on X like the airframe art, flattened on Y onto the ground
          shadowSprite.scale.set(-w, w * SHADOW_SQUASH);
          // only a hint of the bank: a shadow on flat ground barely rotates
          shadowSprite.rotation = c.rotation * SHADOW_SWING;
          shadow.alpha = k * 0.55;
        } else {
          shadow.visible = false;
        }
      }

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

      // Visible bank squeeze on hard turns (Task 2.2). Keeps the plane's own
      // visualScale — bosses are 1.34× and used to lose it on the Y axis here,
      // which drew them wide and squat.
      {
        const target = Math.min(1, turnRate / 2.5);
        // Snaps in, eases out: rolling into a manoeuvre should read as sharp,
        // coming out of one as the airframe settling.
        const speed = (target > bankT ? 16 : 5) * dt;
        bankT += (target - bankT) * Math.min(1, speed);
        c.scale.y = spriteScale * (1 - bankT * 0.2);
      }

      // Flight motion. Three parts, all render-only (see wobble.ts): a slow
      // idle sway so a cruising aeroplane is not on rails, a steady lean into a
      // held turn, and a spring that gets slapped every time the stick moves
      // hard — so throwing it into a manoeuvre pitches the airframe past where
      // the simulation has it and then lets it settle.
      {
        if (wobblePhaseValue === null) wobblePhaseValue = wobblePhase(Number(p.id) || 0);
        wobbleTime += dt;
        const target = aliveAndFlying && p.state !== 'taxi' ? 1 : 0;
        wobbleEnv += (target - wobbleEnv) * Math.min(1, dt * 3);
        const sway = flightWobble({
          time: wobbleTime,
          phase: wobblePhaseValue,
          envelope: wobbleEnv,
          turnRate,
          speed: p.kinematic.g,
          stallSpeed: G_STALL,
          turbulence: opts?.turbulence ?? 0,
        });
        // A heading wrap would read as an enormous jerk; ignore anything past
        // what an aeroplane can actually do.
        const rawDelta = pitchRate - prevPitchRate;
        const jerk = Math.abs(rawDelta) > 12 ? 0 : rawDelta;
        kick = wobbleEnv > 0
          ? advanceKick(kick, jerk * wobbleEnv, dt)
          : { value: kick.value * 0.9, velocity: 0 };
        prevPitchRate = pitchRate;
        // Bank is a real pose out of the sheet, so the wings actually dip; the
        // 2D kick stays on top as the jolt of the airframe being thrown about.
        rollDeg = flightRollDegrees({
          time: wobbleTime,
          phase: wobblePhaseValue,
          envelope: wobbleEnv,
          pitchRate,
          kick: kick.value,
        });
        c.rotation += sway.rotation + kick.value * 0.5;
        c.y += sway.heave;
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
          // Chunks shear off on a real bullet/collision hit — blue for Chico, red for
          // pirates. Gated on damage > 4 so the steady fire-burn drain doesn't spam them.
          // A kill blows a big shower of panels off.
          if (wasKill) {
            fx.addDebris({ x: p.kinematic.position.x, y: p.kinematic.position.y }, visual === 'player' ? 0x4f86c6 : 0xc0392b, 7);
          } else if (prevHp - p.hp > 4) {
            fx.addDebris({ x: p.kinematic.position.x, y: p.kinematic.position.y }, visual === 'player' ? 0x4f86c6 : 0xc0392b, 3);
          }
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

      // 3. Aerodynamic wingtip contrails — stream during fast cruise (not just hard
      //    turns), so flight reads as atmospheric. PLAYER ONLY + throttled to ~30/s:
      //    8 planes all emitting churned the particle pool hard (a perf risk).
      if (fx && aliveAndFlying && faction === 'player') {
        const isStalling = p.kinematic.g < G_STALL;
        const isHighG = turnRate > 1.35;
        const fast = p.kinematic.g > G_MAX_LEVEL * 0.82;
        const wantTrail = isStalling || isHighG || fast;

        const cos = Math.cos(p.kinematic.heading);
        const sin = Math.sin(p.kinematic.heading);

        // Convert top and bottom wingtips from local (-10, -18) and (-10, 15) to world space
        const tx = p.kinematic.position.x - 10 * cos - (-18) * sin;
        const ty = p.kinematic.position.y - 10 * sin + (-18) * cos;

        const bx = p.kinematic.position.x - 10 * cos - 15 * sin;
        const by = p.kinematic.position.y - 10 * sin + 15 * cos;

        vaporTick = (vaporTick + 1) % 2; // emit every other frame (segment spans 2 frames → continuous)
        if (wantTrail) {
          if (vaporTick === 0 && prevTx !== null && prevTy !== null && prevBx !== null && prevBy !== null) {
            const sz = isHighG ? 4.0 : 3.2;
            fx.addVaporSegment({ x: prevTx, y: prevTy }, { x: tx, y: ty }, sz);
            fx.addVaporSegment({ x: prevBx, y: prevBy }, { x: bx, y: by }, sz);
            prevTx = tx; prevTy = ty; prevBx = bx; prevBy = by;
          } else if (prevTx === null) {
            prevTx = tx; prevTy = ty; prevBx = bx; prevBy = by;
          }
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
            while (fireAcc >= 1 / 16) {
              fx.addFireTrail({ x: tailX, y: tailY }, 1);
              fireAcc -= 1 / 16;
            }
            smokeAcc += dt;
            while (smokeAcc >= 1 / 9) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 9;
            }
          } else if (hpFrac <= SMOKE_THRESHOLD) {
            smokeAcc += dt;
            while (smokeAcc >= 1 / 9) {
              fx.addSmokeTrail({ x: tailX, y: tailY }, 1);
              smokeAcc -= 1 / 9;
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
          const barH = p.isBoss ? HP_BAR_HEIGHT + 3 : HP_BAR_HEIGHT;
          if (p.maxHp !== lastDrawnMaxHp) {
            const w = hpBarWidth(p);
            hpBarBg.clear()
              .roundRect(-w / 2 - 1.5, -1.5, w + 3, barH + 3, 3)
              .fill({ color: 0x05080c, alpha: 0.7 })
              .stroke({ color: 0x000000, width: 1.5, alpha: 0.9 });
            lastDrawnMaxHp = p.maxHp;
          }
          const w = hpBarWidth(p);
          const hpFrac = Math.max(0, Math.min(1, p.hp / p.maxHp));
          // Only re-tessellate the fill when HP actually changed (per-plane, every
          // frame, ×many planes was wasteful) — position still updates below.
          if (Math.abs(hpFrac - lastDrawnHpFrac) > 0.004 || p.maxHp !== lastFillMaxHp) {
            let fillColor = 0x4ade80;
            if (hpFrac <= 0.25) fillColor = 0xef4444;
            else if (hpFrac <= 0.5) fillColor = 0xfacc15;
            hpBarFill.clear()
              .roundRect(-w / 2, 0, Math.max(1, w * hpFrac), barH, 2.5)
              .fill({ color: fillColor })
              .stroke({ color: 0xffffff, width: 0.8, alpha: 0.35 });
            lastDrawnHpFrac = hpFrac;
            lastFillMaxHp = p.maxHp;
          }
          hpBar.x = p.kinematic.position.x;
          hpBar.y = p.kinematic.position.y + (p.isBoss ? HP_BAR_Y_OFFSET - 16 : HP_BAR_Y_OFFSET);
        }
      }

      wasAlive = p.alive && p.state !== 'crashed';
      prevState = p.state;
    },
    destroy() {
      // Free per-sprite Graphics/geometry. children:true only — the shared spritesheet
      // texture is NOT destroyed, so the other planes keep rendering.
      c.destroy({ children: true });
      hpBar.destroy({ children: true });
      shadow.destroy();
    },
  };
}
