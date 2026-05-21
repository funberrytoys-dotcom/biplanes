import { Container } from 'pixi.js';
import {
  TICK_DT,
  PLANE_INITIAL_HP,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RUNWAY_X,
  RUNWAY_Y,
  type PlayerCommand,
} from '@biplanes/shared';
import {
  createWorldState, tick,
  type WorldState,
  type Plane,
  type Difficulty,
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
  DamageFx,
} from '@biplanes/render';
import {
  createKeyboardController,
  createTouchController,
} from '@biplanes/input';
import { createStartScreen } from './screens/start-screen.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: {
      position: { x: RUNWAY_X, y: RUNWAY_Y },
      velocity: { x: 0, y: 0 },
      heading: 0,
      throttleOn: true,
      g: 0, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
    state: 'taxi',
    respawnTimer: 0,
  };
}

export async function startGame(container: HTMLElement) {
  const app = await createPixiApp(container);

  const worldLayer = new Container();
  app.stage.addChild(worldLayer);

  const sky = createSkyBackground(WORLD_WIDTH, WORLD_HEIGHT);
  worldLayer.addChild(sky);

  // Blimp sits between the sky and the action — visible but subtle (alpha set inside).
  const blimpSprite = createBlimpSprite();
  worldLayer.addChild(blimpSprite.container);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  const fxLayer = new Container();
  worldLayer.addChild(bulletLayer, fxLayer, planeLayer);

  const bullets = new BulletPool(bulletLayer);
  const damageFx = new DamageFx(fxLayer);
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  // Pilot sprites — keyed by pilot.id like enemy planes. Faction baked in at creation.
  const pilotSprites = new Map<number, ReturnType<typeof createPilotSprite>>();

  const camera = createCamera(worldLayer, app.screen.width, app.screen.height);

  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  const hud = createHud(app.screen.width, app.screen.height);
  uiLayer.addChild(hud.container);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
  let gameRunning = false;

  const startScreen = createStartScreen(app.screen.width, app.screen.height, (d: Difficulty) => {
    state = { ...state, difficulty: d };
    startScreen.hide();
    gameRunning = true;
  });
  uiLayer.addChild(startScreen.container);

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
  app.ticker.add((ticker) => {
    if (!gameRunning) return;
    const deltaMS = ticker.deltaMS;
    const dt = deltaMS / 1000;
    acc += dt;
    const cmd = currentCommand();
    let safety = 8;
    while (acc >= TICK_DT && safety > 0) {
      state = tick(state, cmd);
      acc -= TICK_DT;
      safety--;
    }

    playerSprite.update(state.player, dt, damageFx);

    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy');
        planeLayer.addChild(s.container);
        enemySprites.set(e.id, s);
      }
      s.update(e, dt, damageFx);
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
    damageFx.update(dt);
    blimpSprite.update(state);
    hud.update(state);
    camera.tickShake();
  });

  function resetToMenu() {
    gameRunning = false;
    for (const [, s] of enemySprites) {
      planeLayer.removeChild(s.container);
    }
    enemySprites.clear();
    for (const [, s] of pilotSprites) {
      planeLayer.removeChild(s.container);
    }
    pilotSprites.clear();
    bullets.sync([]);
    state = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
    startScreen.show();
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
    touch.updateZones(w, h);
    startScreen.resize(w, h);
  };
  window.addEventListener('resize', onResize);
}
