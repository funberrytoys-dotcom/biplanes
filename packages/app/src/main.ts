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
} from '@biplanes/core';
import {
  createPixiApp,
  createSkyBackground,
  createPlaneSprite,
  BulletPool,
  createCamera,
  createHud,
} from '@biplanes/render';
import {
  createKeyboardController,
  createTouchController,
} from '@biplanes/input';

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

  // World layer holds the 1920×1080 logical playfield.
  // We scale + letterbox it to fit the canvas so the game looks correct on any aspect ratio.
  const worldLayer = new Container();
  app.stage.addChild(worldLayer);

  const sky = createSkyBackground(WORLD_WIDTH, WORLD_HEIGHT);
  worldLayer.addChild(sky);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  worldLayer.addChild(bulletLayer, planeLayer);

  const bullets = new BulletPool(bulletLayer);
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  // Camera is kept for shake only — no follow.
  const camera = createCamera(worldLayer, app.screen.width, app.screen.height);

  // UI layer (screen-space, never scaled)
  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  const hud = createHud(app.screen.width, app.screen.height);
  uiLayer.addChild(hud.container);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());

  // Input
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
    };
  }

  // Letterbox layout — scale world to fit, center it.
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

  // Fixed-timestep loop with interpolation accumulator
  let acc = 0;
  app.ticker.add((ticker) => {
    const deltaMS = ticker.deltaMS;
    acc += deltaMS / 1000;
    const cmd = currentCommand();
    let safety = 8;
    while (acc >= TICK_DT && safety > 0) {
      state = tick(state, cmd);
      acc -= TICK_DT;
      safety--;
    }

    // Render
    playerSprite.update(state.player);

    // Sync enemy sprites
    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy');
        planeLayer.addChild(s.container);
        enemySprites.set(e.id, s);
      }
      s.update(e);
    }
    for (const [id, s] of enemySprites) {
      if (!seenEnemy.has(id)) {
        planeLayer.removeChild(s.container);
        enemySprites.delete(id);
      }
    }

    bullets.sync(state.bullets);
    hud.update(state);
    // Camera shake still ticks (for hit feedback), but no follow.
    camera.tickShake();
  });

  // Resize
  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    layoutWorld();
    camera.setScreen(w, h);
    hud.resize(w, h);
    touch.updateZones(w, h);
  };
  window.addEventListener('resize', onResize);
}
