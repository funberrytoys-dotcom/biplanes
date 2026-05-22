import { Container } from 'pixi.js';
import {
  TICK_DT,
  PLANE_INITIAL_HP,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RUNWAY_X,
  RUNWAY_Y,
  LOW_HP_VIGNETTE_THRESHOLD,
  SLOW_MO_SCALE,
  SLOW_MO_DURATION_SEC,
  SLOW_MO_RECOVERY_SEC,
  type PlayerCommand,
} from '@biplanes/shared';
import {
  createWorldState, tick,
  applyUpgrade,
  createRng,
  rollUpgradeChoices,
  type WorldState,
  type Plane,
  type Difficulty,
  type UpgradeId,
} from '@biplanes/core';
import {
  createPixiApp,
  createSkyBackground,
  createPlaneSprite,
  createPilotSprite,
  createBlimpSprite,
  BulletPool,
  createCamera,
  createHud,
  createRenderClock,
  createGlowLayer,
  DamageFx,
  MuzzleFlashes,
  BulletTracers,
  createScreenEffects,
  FloatingNumbers,
  createLightning,
  createLensFlare,
  GroundFx,
  type SkyThemeId,
  type SkyBackgroundHandle,
} from '@biplanes/render';
import {
  createKeyboardController,
  createTouchController,
} from '@biplanes/input';
import { createStartScreen } from './screens/start-screen.js';
import { createLevelUpScreen } from './screens/level-up-screen.js';
import { createDeathScreen } from './screens/death-screen.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: {
      position: { x: RUNWAY_X, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: false,
      g: 0, facing: 1, throttle: false, throttleLevel: 0,
    },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
    state: 'taxi',
    respawnTimer: 0,
  };
}

export async function startGame(container: HTMLElement) {
  const app = await createPixiApp(container);
  const clock = createRenderClock();

  const worldLayer = new Container();
  app.stage.addChild(worldLayer);

  // Screen effects must be created before lightning (lightning triggers screenFx.flash).
  // Layout: uiLayer/screenFx is added later — we just need the handle to pass into lightning.
  const screenFx = createScreenEffects(app.screen.width, app.screen.height);

  // Lightning bolts — gated by setSkyTheme. Sits above sky (index 0), below action layers.
  const lightning = createLightning(WORLD_WIDTH, WORLD_HEIGHT, screenFx);

  // Lens flare — gated by setSkyTheme to noon/sunset themes.
  const lensFlare = createLensFlare(WORLD_WIDTH, WORLD_HEIGHT, false);

  let sky: SkyBackgroundHandle;
  function setSkyTheme(themeId: SkyThemeId) {
    if (sky) {
      worldLayer.removeChild(sky.container);
      sky.container.destroy({ children: true });
    }
    sky = createSkyBackground(WORLD_WIDTH, WORLD_HEIGHT, themeId);
    worldLayer.addChildAt(sky.container, 0); // Keep sky behind all active elements
    lightning.setActive(themeId === 'twilight' || themeId === 'night');
    lensFlare.setActive(themeId === 'noon' || themeId === 'sunset');
  }

  const themes: SkyThemeId[] = ['noon', 'sunset', 'twilight', 'night'];
  const rollSkyTheme = () => {
    const randomTheme = themes[Math.floor(Math.random() * themes.length)] ?? 'noon';
    setSkyTheme(randomTheme);
  };

  // Set initial random sky theme for start screen
  rollSkyTheme();

  // Lightning bolts render above the sky but below all action layers.
  worldLayer.addChild(lightning.container);

  // Lens flare sits above sky atmosphere, before action layers.
  worldLayer.addChild(lensFlare.container);

  // Blimp sits between the sky and the action — visible but subtle (alpha set inside).
  const blimpSprite = createBlimpSprite();
  worldLayer.addChild(blimpSprite.container);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  const fxLayer = new Container();
  const glowLayer = createGlowLayer();
  const groundFxLayer = new Container();
  worldLayer.addChild(bulletLayer, fxLayer, glowLayer.container, groundFxLayer, planeLayer);
  const groundFx = new GroundFx(groundFxLayer);

  const bullets = new BulletPool(bulletLayer);
  const damageFx = new DamageFx(fxLayer, glowLayer.container);
  const muzzleFlashes = new MuzzleFlashes(glowLayer.container);
  const tracers = new BulletTracers(glowLayer.container);
  const numbersLayer = new Container();
  worldLayer.addChild(numbersLayer);
  const floatingNumbers = new FloatingNumbers(numbersLayer);
  let prevBulletIds = new Set<number>();
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  // Pilot sprites — keyed by pilot.id like enemy planes. Faction baked in at creation.
  const pilotSprites = new Map<number, ReturnType<typeof createPilotSprite>>();

  const camera = createCamera(worldLayer, app.screen.width, app.screen.height);

  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  uiLayer.addChild(screenFx.container);

  const hud = createHud(app.screen.width, app.screen.height);
  uiLayer.addChild(hud.container);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
  let gameRunning = false;
  let choicesShowing = false;

  const startScreen = createStartScreen(app.screen.width, app.screen.height, (d: Difficulty) => {
    state = { ...state, difficulty: d };
    startScreen.hide();
    gameRunning = true;
  });
  uiLayer.addChild(startScreen.container);

  const levelUpScreen = createLevelUpScreen(app.screen.width, app.screen.height, (id: string) => {
    state = applyUpgrade(state, id as UpgradeId);
    levelUpScreen.hide();
    choicesShowing = false;
  });
  uiLayer.addChild(levelUpScreen.container);

  const deathScreen = createDeathScreen(app.screen.width, app.screen.height, () => {
    resetToMenu();
  });
  uiLayer.addChild(deathScreen.container);

  const kb = createKeyboardController();
  const touch = createTouchController(app.canvas);
  touch.updateZones(app.screen.width, app.screen.height);

  function currentCommand(): PlayerCommand {
    const k = kb.current();
    const t = touch.current();
    return {
      rotate: (k.rotate || t.rotate) as -1 | 0 | 1,
      fire: k.fire || t.fire,
      bomb: k.bomb || t.bomb,
      throttleDelta: (k.throttleDelta || t.throttleDelta) as -1 | 0 | 1,
      eject: k.eject || t.eject,
      jump: k.jump || t.jump,
    };
  }

  function layoutWorld() {
    const cw = app.screen.width;
    const ch = app.screen.height;
    const scale = Math.min(cw / WORLD_WIDTH, ch / WORLD_HEIGHT);
    worldLayer.scale.set(scale);
    worldLayer.x = (cw - WORLD_WIDTH * scale) / 2;
    worldLayer.y = (ch - WORLD_HEIGHT * scale) / 2;
    camera.setBase(worldLayer.x, worldLayer.y);
  }
  layoutWorld();

  let acc = 0;
  let renderTimeSec = 0;
  let prevPlayerScore = state.playerScore;
  let prevLevel = state.level;
  let prevPlayerAlive = state.player.alive;
  app.ticker.add((ticker) => {
    const realDt = ticker.deltaMS / 1000;
    const dt = clock.tick(realDt);
    renderTimeSec += dt;

    // 1. Update Sky Background animations (clouds, beacons, searchlights)
    if (sky) {
      const px = state.player ? state.player.kinematic.position.x : RUNWAY_X;
      const py = state.player ? state.player.kinematic.position.y : RUNWAY_Y;
      sky.update(dt, renderTimeSec, px, py);
    }
    lightning.update(dt);
    lensFlare.update(dt, renderTimeSec, state.player ? state.player.kinematic.position.x : RUNWAY_X);

    // 2. Update UI overlays (Level Up Card entries & Death Telegram Typewriter)
    levelUpScreen.update(dt);
    deathScreen.update(dt);

    if (!gameRunning) return;
    acc += dt;
    if (acc > 0.2) {
      acc = 0.2; // Spiral of death prevention / clamp physics accumulator catch-up
    }
    const cmd = currentCommand();
    let safety = 8;
    while (acc >= TICK_DT && safety > 0) {
      state = tick(state, cmd);
      acc -= TICK_DT;
      safety--;
      if (state.pendingLevelUp || state.gameOver) break;
    }

    if (state.pendingLevelUp && !choicesShowing) {
      const rng = createRng((state.rngState ^ (state.level * 0x9e3779b9) ^ state.tickCount) >>> 0);
      const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
      if (choices.length > 0) {
        choicesShowing = true;
        levelUpScreen.show(choices);
      } else {
        state = { ...state, pendingLevelUp: false };
      }
    }

    if (state.gameOver && !deathScreen.container.visible) {
      deathScreen.show(state);
    }

    if (state.playerScore > prevPlayerScore) {
      screenFx.flash(0xffffff, 0.25, 0.12);
    }
    if (state.level > prevLevel) {
      screenFx.flash(0xffc24a, 0.4, 0.22);
    }
    if (prevPlayerAlive && !state.player.alive) {
      screenFx.flash(0xff5544, 0.5, 0.4);
      clock.slowMo(SLOW_MO_SCALE, SLOW_MO_DURATION_SEC, SLOW_MO_RECOVERY_SEC);
    }
    prevPlayerScore = state.playerScore;
    prevLevel = state.level;
    prevPlayerAlive = state.player.alive;

    const hpFrac = state.player.hp / state.player.maxHp;
    const vignette = hpFrac <= LOW_HP_VIGNETTE_THRESHOLD
      ? 1 - (hpFrac / LOW_HP_VIGNETTE_THRESHOLD)
      : 0;
    screenFx.setVignette(vignette * 0.6);

    const seenBulletIds = new Set<number>();
    for (const b of state.bullets) {
      seenBulletIds.add(b.id);
      if (!prevBulletIds.has(b.id)) {
        const heading = Math.atan2(b.velocity.y, b.velocity.x);
        muzzleFlashes.spawn(b.position.x, b.position.y, heading);
        damageFx.addCasing({ x: b.position.x, y: b.position.y }, heading);
      }
    }
    prevBulletIds = seenBulletIds;

    playerSprite.update(state.player, dt, damageFx, clock, camera, floatingNumbers, groundFx);

    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy');
        planeLayer.addChild(s.container);
        enemySprites.set(e.id, s);
      }
      s.update(e, dt, damageFx, clock, camera, floatingNumbers, groundFx);
    }
    for (const [id, s] of enemySprites) {
      if (!seenEnemy.has(id)) {
        planeLayer.removeChild(s.container);
        enemySprites.delete(id);
      }
    }

    // Pilot rendering — Map<id, sprite> synced against state.pilots.
    const seenPilot = new Set<number>();
    for (const p of state.pilots) {
      seenPilot.add(p.id);
      let s = pilotSprites.get(p.id);
      if (!s) {
        s = createPilotSprite(p.faction);
        planeLayer.addChild(s.container);
        pilotSprites.set(p.id, s);
      }
      s.update(p);
    }
    for (const [id, s] of pilotSprites) {
      if (!seenPilot.has(id)) {
        planeLayer.removeChild(s.container);
        pilotSprites.delete(id);
      }
    }

    bullets.sync(state.bullets);
    for (const b of state.bullets) tracers.emit(b);
    tracers.update(dt);
    damageFx.update(dt);
    groundFx.update(dt, (x, y) => damageFx.addSmokeTrail({ x, y }, 1));
    muzzleFlashes.update(dt);
    floatingNumbers.update(dt);
    screenFx.update(dt, renderTimeSec, worldLayer);
    blimpSprite.update(state);
    hud.update(state);
    camera.tickShake(dt);
  });

  function resetToMenu() {
    gameRunning = false;
    choicesShowing = false;
    acc = 0; // Reset physics time accumulator to avoid hyper-speed catch-up spikes
    for (const [, s] of enemySprites) {
      planeLayer.removeChild(s.container);
    }
    enemySprites.clear();
    for (const [, s] of pilotSprites) {
      planeLayer.removeChild(s.container);
    }
    pilotSprites.clear();
    bullets.sync([]);
    prevBulletIds = new Set();
    groundFx.clear();
    state = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
    prevPlayerScore = state.playerScore;
    prevLevel = state.level;
    prevPlayerAlive = state.player.alive;
    screenFx.setVignette(0);
    levelUpScreen.hide();
    deathScreen.hide();
    startScreen.show();
    rollSkyTheme(); // Roll a new gorgeous environment style for the next run
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      resetToMenu();
    }
  });

  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    layoutWorld();
    camera.setScreen(w, h);
    hud.resize(w, h);
    screenFx.resize(w, h);
    touch.updateZones(w, h);
    startScreen.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
  };
  window.addEventListener('resize', onResize);
}
