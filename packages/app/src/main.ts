import { Container } from 'pixi.js';
import {
  TICK_DT,
  PLANE_INITIAL_HP,
  type PlayerCommand,
} from '@biplanes/shared';
import {
  createWorldState, tick,
  applyUpgrade,
  rollUpgradeChoices,
  createRng,
  type WorldState,
  type Plane,
  type UpgradeId,
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
import { createLevelUpScreen } from './screens/level-up-screen.js';
import { createDeathScreen } from './screens/death-screen.js';

function makePlayer(): Plane {
  return {
    id: 1, faction: 'player',
    kinematic: { position: { x: 2000, y: 1000 }, velocity: { x: 250, y: 0 }, heading: 0, throttleOn: true },
    hp: PLANE_INITIAL_HP, maxHp: PLANE_INITIAL_HP,
    weaponCooldown: 0, alive: true,
  };
}

export async function startGame(container: HTMLElement) {
  const app = await createPixiApp(container);
  const { width, height } = app.screen;

  // World layer (camera follows)
  const worldLayer = new Container();
  app.stage.addChild(worldLayer);

  const sky = createSkyBackground(8000, 4000);
  sky.x = -2000; sky.y = -1000;
  worldLayer.addChild(sky);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  worldLayer.addChild(bulletLayer, planeLayer);

  const bullets = new BulletPool(bulletLayer);
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  const camera = createCamera(worldLayer, width, height);

  // UI layer (fixed)
  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  const hud = createHud(width, height);
  uiLayer.addChild(hud.container);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
  let pendingChoices: ReturnType<typeof rollUpgradeChoices> = [];

  const levelUpScreen = createLevelUpScreen(width, height, (id) => {
    state = applyUpgrade(state, id as UpgradeId);
    levelUpScreen.hide();
  });
  uiLayer.addChild(levelUpScreen.container);

  const deathScreen = createDeathScreen(width, height, () => {
    state = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
    deathScreen.hide();
  });
  uiLayer.addChild(deathScreen.container);

  // Input
  const kb = createKeyboardController();
  const touch = createTouchController(app.canvas);
  touch.updateZones(width, height);

  function currentCommand(): PlayerCommand {
    const k = kb.current();
    const t = touch.current();
    return {
      rotate: (k.rotate || t.rotate) as -1 | 0 | 1,
      fire: k.fire || t.fire,
      bomb: k.bomb || t.bomb,
    };
  }

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

      // Trigger level-up screen
      if (state.pendingLevelUp && !levelUpScreen.container.visible) {
        const rng = createRng(state.rngState);
        pendingChoices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
        if (pendingChoices.length === 0) {
          state = { ...state, pendingLevelUp: false };
        } else {
          levelUpScreen.show(pendingChoices);
        }
      }

      // Death screen
      if (state.gameOver && !deathScreen.container.visible) {
        deathScreen.show(state);
      }
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
    camera.follow(state.player);
  });

  // Resize
  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    camera.setScreen(w, h);
    hud.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
    touch.updateZones(w, h);
  };
  window.addEventListener('resize', onResize);
}
