import { Assets, Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  TICK_DT,
  PLANE_INITIAL_HP,
  ENEMY_INITIAL_HP_LIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  RUNWAY_X,
  RUNWAY_Y,
  LOW_HP_VIGNETTE_THRESHOLD,
  SLOW_MO_SCALE,
  SLOW_MO_DURATION_SEC,
  SLOW_MO_RECOVERY_SEC,
  HIT_PAUSE_FRAMES_RAM,
  HIT_PAUSE_FRAMES_RAM_KILL,
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
  createCloudField,
  createPlaneSprite,
  createPilotSprite,
  BulletPool,
  createCamera,
  createHud,
  createRenderClock,
  createGlowLayer,
  DamageFx,
  MuzzleFlashes,
  BulletTracers,
  createScreenEffects,
  createLightning,
  createLensFlare,
  createDistantSilhouettes,
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
import { createDialogueOverlay, createRadioPopup, type DialogueLine } from './campaign/dialogue-overlay.js';
import { createMissionOneScene } from './campaign/mission-one-scene.js';
import { createMissionOneController, type MissionOnePhase } from './campaign/mission-one-controller.js';
import { getMissionOneBossPlan, getMissionOneWavePlan, type MissionOneEnemyRole } from './campaign/mission-one-encounters.js';
import { resolveMissionOneFrameGate } from './campaign/mission-one-frame-gate.js';
import { getMissionOneEscortFocus } from './campaign/mission-one-camera.js';
import {
  MISSION_ONE_WORLD_WIDTH,
  MISSION_ONE_CARAVAN_SPEED,
  getMissionOneCarrierLaunch,
  getMissionOneCaravanStart,
  getMissionOneEnemySpawnX,
} from './campaign/mission-one-layout.js';
import { getMissionOneObjectiveText } from './campaign/mission-one-objectives.js';
import { resolveMissionOneOutcome } from './campaign/mission-one-rules.js';

const MENU_VIDEO_URL = '/assets/menu/main-menu-placeholder.mp4';
const CHICO_PORTRAIT_URL = '/assets/campaign/portrait_chico.png';
const ISLAND_BRYNN_FRAME_URLS = Array.from({ length: 50 }, (_, i) => `/assets/campaign/island_brynn/frame_${String(i + 1).padStart(4, '0')}.png`);

const VISUAL_ASSET_URLS = [
  '/assets/biplanes/sky_noon.jpg',
  '/assets/biplanes/sky_sunset.jpg',
  '/assets/biplanes/sky_twilight.jpg',
  '/assets/biplanes/sky_night.jpg',
  '/assets/biplanes/plane_chico_blue.png',
  '/assets/biplanes/plane_player_sov_sheet.png',
  '/assets/biplanes/plane_enemy_red.png',
  '/assets/biplanes/plane_enemy_crimson_sheet.png',
  '/assets/biplanes/airship_1.png',
  '/assets/biplanes/airship_2.png',
  '/assets/biplanes/enemy_airship_1.png',
  '/assets/biplanes/enemy_airship_2.png',
  '/assets/biplanes/island_factory.png',
  '/assets/biplanes/island_player.png',
  '/assets/biplanes/island_industrial.png',
  '/assets/biplanes/island_enemy_red.png',
  '/assets/biplanes/island_enemy_core.png',
  '/assets/biplanes/island_oilfield.png',
  '/assets/biplanes/island_blackyard.png',
  '/assets/biplanes/island_moon.png',
  '/assets/campaign/portrait_chico.png',
  '/assets/campaign/plane_scar.png',
  '/assets/campaign/caravan_sov.png',
  '/assets/campaign/airship_sov_large.png',
  '/assets/campaign/airship_sov_variant_1.png',
  '/assets/campaign/airship_sov_variant_2.png',
  ...ISLAND_BRYNN_FRAME_URLS,
];

const STORY_INTRO_LINES: DialogueLine[] = [
  {
    speaker: 'Тотти',
    text: 'Ну что, взлетаем. Обычный рейс, тихий люменный караван, даже скучно немного.'
  },
  {
    speaker: 'Чико',
    text: 'Тотти, после слова «скучно» у меня обычно чешется шлем. Дурная примета.',
    portraitUrl: CHICO_PORTRAIT_URL
  },
  {
    speaker: 'Искрик',
    text: 'Чико, только не вздумай чесать его об винт! Я замучился регулировать лопасти!'
  },
  {
    speaker: 'Мира',
    text: 'Ребята, отставить шутки. Караван несет важнейший груз люменов для маяка Бринн. Он уже мигает со сбоями, а туман вокруг Бринна густеет.'
  },
  {
    speaker: 'Чико',
    text: 'Понял! Обещаю геройствовать аккуратно. Запускаю двигатель, держусь рядом с караваном!',
    portraitUrl: CHICO_PORTRAIT_URL
  }
];

const STORY_VICTORY_LINES: DialogueLine[] = [
  {
    speaker: 'Тотти',
    text: 'Караван вошел в доки Бринна! Все люменные ящики на месте, разгрузка началась.'
  },
  {
    speaker: 'Чико',
    text: 'Отлично сработано! Но посмотрите на маяк Бринн... Он продолжает странно мигать.',
    portraitUrl: CHICO_PORTRAIT_URL
  },
  {
    speaker: 'Старый Ас',
    text: 'Маяки не моргают от радости, сынок. Тут творится что-то неладное.'
  },
  {
    speaker: 'Мира',
    text: 'Согласна. Отдыхаем, заправляемся, а завтра летим разбираться прямо к маяку Бринн!'
  }
];

const STORY_FAILURE_CARAVAN_LINES: DialogueLine[] = [
  {
    speaker: 'Мира',
    text: 'Караван потерян в тумане! Связь с транспортами оборвалась.'
  },
  {
    speaker: 'Чико',
    text: 'Проклятье... Разворачиваемся. Мы починим биплан, вернемся с новым планом и не оставим Бринн во тьме!',
    portraitUrl: CHICO_PORTRAIT_URL
  }
];
const STORY_FAILURE_PILOT_LINES: DialogueLine[] = [
  {
    speaker: 'Тотти',
    text: 'Капитан сбит! Караван остался без прикрытия — миссия сорвана.'
  },
  {
    speaker: 'Чико',
    text: 'Ладно… я ещё подышу. И вернусь за теми, кто меня уронил.',
    portraitUrl: CHICO_PORTRAIT_URL
  }
];

function createMenuBackdrop(container: HTMLElement) {
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  const video = document.createElement('video');
  video.src = MENU_VIDEO_URL;
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.position = 'absolute';
  video.style.inset = '0';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.zIndex = '0';
  video.style.pointerEvents = 'none';
  video.style.background = '#06101f';
  container.appendChild(video);

  return {
    show() {
      video.style.display = 'block';
      void video.play().catch(() => undefined);
    },
    hide() {
      video.style.display = 'none';
      video.pause();
    },
  };
}

function createTouchGuide(touch: ReturnType<typeof createTouchController>) {
  const c = new Container();
  const rings = {
    left: new Graphics(),
    right: new Graphics(),
    fire: new Graphics(),
    bomb: new Graphics(),
  };
  const labelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 3 },
  });
  const labels = {
    left: new Text({ text: 'TURN', style: labelStyle }),
    right: new Text({ text: 'TURN', style: labelStyle }),
    fire: new Text({ text: 'FIRE', style: labelStyle }),
    bomb: new Text({ text: 'BOMB', style: labelStyle }),
  };
  c.addChild(rings.left, rings.right, rings.fire, rings.bomb, labels.left, labels.right, labels.fire, labels.bomb);
  let active = false;
  let touchLikely = false;

  function drawRing(g: Graphics, x: number, y: number, r: number, color: number) {
    g.clear()
      .circle(x, y, r)
      .fill({ color, alpha: 0.1 })
      .stroke({ color, width: 2.5, alpha: 0.55 })
      .circle(x, y, r * 0.58)
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.24 });
  }

  function placeLabel(label: Text, x: number, y: number) {
    label.x = x - label.width / 2;
    label.y = y - label.height / 2;
  }

  function layout(w: number, h: number) {
    touchLikely = navigator.maxTouchPoints > 0 || w < 900;
    c.visible = active && touchLikely;
    if (!touchLikely) return;
    const z = touch.zones;
    drawRing(rings.left, z.rotateCcw.x, z.rotateCcw.y, z.rotateCcw.r, 0x33d6ff);
    drawRing(rings.right, z.rotateCw.x, z.rotateCw.y, z.rotateCw.r, 0x33d6ff);
    drawRing(rings.fire, z.fire.x, z.fire.y, z.fire.r, 0xff8c19);
    drawRing(rings.bomb, z.bomb.x, z.bomb.y, z.bomb.r, 0xff4444);
    placeLabel(labels.left, z.rotateCcw.x, z.rotateCcw.y);
    placeLabel(labels.right, z.rotateCw.x, z.rotateCw.y);
    placeLabel(labels.fire, z.fire.x, z.fire.y);
    placeLabel(labels.bomb, z.bomb.x, z.bomb.y);
  }

  function setActive(nextActive: boolean) {
    active = nextActive;
    c.visible = active && touchLikely;
  }

  return { container: c, layout, setActive };
}

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

/**
 * Player plane spawned just off the Leviathan's flight deck — already airborne
 * at cruise speed. Spawning in 'taxi' clamps Y to the runway ground (≈990),
 * which is far below the painted carrier deck and makes the takeoff look like
 * the plane rolls along the bottom of the screen instead of off a flying
 * carrier. We spawn flying at G_MAX_LEVEL with a gentle nose-up so the launch
 * assist (in the main loop) can hold heading steady for the first ~1.8 s.
 */
function makeCarrierLaunchPlayer(): Plane {
  const player = makePlayer();
  const launch = getMissionOneCarrierLaunch();
  return {
    ...player,
    kinematic: {
      ...player.kinematic,
      position: launch,
      heading: 0,
      g: 680,
      throttleOn: true,
      throttle: true,
      throttleLevel: 1.0,
      facing: 1,
    },
    state: 'flying',
  };
}

// Launch-assist tuning. Plane spawns LEVEL (heading=0) at mid-screen so it
// has equal room above and below. Without input it cruises horizontally and
// will not drift into the world ceiling. Steering is fully the player's.
const LAUNCH_ASSIST_SEC = 1.8;
const LAUNCH_TARGET_HEADING = 0;
// Story-mode safety net: ceiling proximity AND floor proximity. The base
// engine has its own ceiling force, but it pushes the nose to straight-down
// which crashes the plane. We override with a gentler return-to-level steer.
const CEILING_SAFETY_Y = 220;
const FLOOR_SAFETY_Y = 820;

function makeScriptedEnemy(id: number, x: number, y: number, hpMultiplier = 1, heading = Math.PI): Plane {
  const maxHp = Math.round(ENEMY_INITIAL_HP_LIGHT * hpMultiplier);
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: Math.cos(heading) * 220, y: Math.sin(heading) * 220 },
      heading,
      throttleOn: true,
      g: 720,
      facing: heading > Math.PI / 2 || heading < -Math.PI / 2 ? -1 : 1,
      throttle: true,
      throttleLevel: 0.86,
    },
    hp: maxHp,
    maxHp,
    weaponCooldown: 0.25,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

// === URL params (debug / verification) ============================
// ?story            — auto-start mission 1 (skip menu)
// ?skipBriefing     — skip the briefing dialog
// ?debug            — show debug HUD on boot (F3 toggles in-game)
const URL_PARAMS = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams();
const AUTO_STORY = URL_PARAMS.has('story');
const SKIP_BRIEFING = URL_PARAMS.has('skipBriefing');
const DEBUG_HUD_ON_BOOT = URL_PARAMS.has('debug');
const TIME_SKIP_SEC = Math.max(0, parseFloat(URL_PARAMS.get('t') ?? '0') || 0);

export async function startGame(container: HTMLElement) {
  await Assets.load(VISUAL_ASSET_URLS);
  const menuBackdrop = createMenuBackdrop(container);

  const app = await createPixiApp(container);
  const clock = createRenderClock();

  const worldLayer = new Container();
  app.stage.addChild(worldLayer);
  worldLayer.visible = false;

  // Screen effects must be created before lightning (lightning triggers screenFx.flash).
  // Layout: uiLayer/screenFx is added later — we just need the handle to pass into lightning.
  const screenFx = createScreenEffects(app.screen.width, app.screen.height);

  // Lightning bolts — gated by setSkyTheme. Sits above sky (index 0), below action layers.
  const lightning = createLightning(WORLD_WIDTH, WORLD_HEIGHT, screenFx);

  // Lens flare — gated by setSkyTheme to noon/sunset themes.
  const lensFlare = createLensFlare(WORLD_WIDTH, WORLD_HEIGHT, false);

  // Distant silhouettes — re-created per theme so the silhouette tint matches the sky.
  let silhouettes: ReturnType<typeof createDistantSilhouettes> | null = null;
  let runMode: 'menu' | 'arena' | 'story' = 'menu';

  let sky: SkyBackgroundHandle;
  function setSkyTheme(themeId: SkyThemeId) {
    if (sky) {
      worldLayer.removeChild(sky.container);
      sky.container.destroy({ children: true });
    }
    sky = createSkyBackground(WORLD_WIDTH, WORLD_HEIGHT, themeId, runMode === 'story');
    worldLayer.addChildAt(sky.container, 0); // Keep sky behind all active elements
    lightning.setActive(themeId === 'twilight' || themeId === 'night');
    lensFlare.setActive(themeId === 'noon' || themeId === 'sunset');

    // Rebuild silhouettes with theme-tinted color and reinsert immediately above sky.
    if (silhouettes) {
      worldLayer.removeChild(silhouettes.container);
      silhouettes.container.destroy({ children: true });
    }
    const silhouetteColor =
      themeId === 'night' ? 0x06091c :
      themeId === 'twilight' ? 0x170f30 :
      themeId === 'sunset' ? 0x561841 :
      0x224975; // noon
    silhouettes = createDistantSilhouettes(WORLD_WIDTH, WORLD_HEIGHT, silhouetteColor);
    worldLayer.addChildAt(silhouettes.container, 1);
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

  const storyScene = createMissionOneScene();
  worldLayer.addChild(storyScene.container);

  // Background clouds — behind the dogfight for depth. Subtle and high.
  const bgClouds = createCloudField({
    count: 7,
    yMin: 70,
    yMax: 470,
    widthMin: 170,
    widthMax: 330,
    alphaMin: 0.16,
    alphaMax: 0.4,
    speedMin: 6,
    speedMax: 16,
  });
  worldLayer.addChild(bgClouds.container);

  const bulletLayer = new Container();
  const planeLayer = new Container();
  const fxLayer = new Container();
  const glowLayer = createGlowLayer();
  const groundFxLayer = new Container();
  worldLayer.addChild(bulletLayer, fxLayer, glowLayer.container, groundFxLayer, planeLayer);
  const groundFx = new GroundFx(groundFxLayer);

  // Foreground clouds — ABOVE the planes, so the hero/enemy can fly into cover
  // and be partially hidden. Denser and larger; includes the soft photoreal puff.
  const fgClouds = createCloudField({
    count: 4,
    yMin: 160,
    yMax: 620,
    widthMin: 320,
    widthMax: 560,
    alphaMin: 0.38,
    alphaMax: 0.7,
    speedMin: 12,
    speedMax: 26,
    useSoft: true,
  });
  worldLayer.addChild(fgClouds.container);

  const bullets = new BulletPool(bulletLayer);
  const damageFx = new DamageFx(fxLayer, glowLayer.container);
  const muzzleFlashes = new MuzzleFlashes(glowLayer.container);
  const tracers = new BulletTracers(glowLayer.container);

  let prevBulletIds = new Set<number>();
  const playerSprite = createPlaneSprite('player');
  planeLayer.addChild(playerSprite.container, playerSprite.hpBar);

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  // Pilot sprites — keyed by pilot.id like enemy planes. Faction baked in at creation.
  const pilotSprites = new Map<number, ReturnType<typeof createPilotSprite>>();

  const camera = createCamera(worldLayer, app.screen.width, app.screen.height);

  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  uiLayer.addChild(screenFx.container);

  const hud = createHud(app.screen.width, app.screen.height);
  hud.container.visible = false;
  uiLayer.addChild(hud.container);

  // === Caravan HP gauge (story mode UI) ============================
  const caravanGauge = new Container();
  const caravanGaugeBg = new Graphics();
  const caravanGaugeBar = new Graphics();
  const caravanGaugeLabel = new Text({
    text: 'КАРАВАН',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffd07a,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });
  caravanGauge.addChild(caravanGaugeBg, caravanGaugeBar, caravanGaugeLabel);
  caravanGauge.visible = false;
  uiLayer.addChild(caravanGauge);

  const missionObjective = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xfff4dc,
      stroke: { color: 0x05080e, width: 4 },
      letterSpacing: 1,
    }),
  });
  missionObjective.visible = false;
  uiLayer.addChild(missionObjective);

  function layoutCaravanGauge(w: number, _h: number) {
    caravanGauge.x = (w - 220) / 2;
    caravanGauge.y = 88;
    missionObjective.x = w / 2;
    missionObjective.y = 118;
  }
  function drawCaravanGauge(hp: number) {
    if (!caravanGauge.visible) return;
    const W = 220, H = 16;
    caravanGaugeBg.clear()
      .roundRect(0, 0, W, H, 4)
      .fill({ color: 0x07101f, alpha: 0.78 })
      .stroke({ color: 0xffb44a, width: 1.5, alpha: 0.7 });
    const fillW = Math.max(0, Math.min(1, hp)) * (W - 4);
    const color = hp < 0.25 ? 0xff5a3a : hp < 0.55 ? 0xffb24a : 0x8ee08a;
    caravanGaugeBar.clear().roundRect(2, 2, fillW, H - 4, 3).fill({ color, alpha: 0.92 });
    caravanGaugeLabel.x = 0;
    caravanGaugeLabel.y = -18;
  }
  function drawMissionObjective(phase: MissionOnePhase) {
    if (!missionObjective.visible) return;
    missionObjective.text = getMissionOneObjectiveText(phase);
    missionObjective.anchor.set(0.5, 0);
  }
  layoutCaravanGauge(app.screen.width, app.screen.height);

  // === Boss marker (floats above Scar in world space) ==============
  const bossMarker = new Container();
  const bossMarkerArrow = new Graphics();
  const bossMarkerLabel = new Text({
    text: 'ШРАМ',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xff6060,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });
  bossMarkerArrow
    .moveTo(0, 6).lineTo(-9, -6).lineTo(9, -6).closePath()
    .fill({ color: 0xff6060, alpha: 0.95 })
    .stroke({ color: 0xfff4dc, width: 2, alpha: 0.85 });
  bossMarkerLabel.x = -bossMarkerLabel.width / 2;
  bossMarkerLabel.y = -28;
  bossMarker.addChild(bossMarkerLabel, bossMarkerArrow);
  bossMarker.visible = false;
  planeLayer.addChild(bossMarker);

  // === Debug HUD (F3 toggle, ?debug URL param) =====================
  const debugText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xa8c0ff,
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  debugText.x = 8;
  debugText.y = 8;
  debugText.visible = DEBUG_HUD_ON_BOOT;
  uiLayer.addChild(debugText);

  let state: WorldState = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
  let gameRunning = false;
  let choicesShowing = false;
  let storyCompleted = false;
  let shownChicoFirstKillRadio = false;
  const scriptedEnemyIds = new Set<number>();
  const missionOne = createMissionOneController();

  const dialogueOverlay = createDialogueOverlay(app.screen.width, app.screen.height);
  uiLayer.addChild(dialogueOverlay.container);

  const radioPopup = createRadioPopup(app.screen.width);
  uiLayer.addChild(radioPopup.container);

  const startScreen = createStartScreen(app.screen.width, app.screen.height, (action) => {
    if (action === 'arena') {
      startArena();
      return;
    }
    if (action === 'story') {
      startStoryMissionOne();
    }
  });
  uiLayer.addChild(startScreen.container);
  startScreen.show();

  const levelUpScreen = createLevelUpScreen(app.screen.width, app.screen.height, (id: string) => {
    state = applyUpgrade(state, id as UpgradeId);
    levelUpScreen.hide();
    choicesShowing = false;
  });
  uiLayer.addChild(levelUpScreen.container);

  function openLevelUpChoices() {
    if (!state.pendingLevelUp || choicesShowing) return;
    const rng = createRng((state.rngState ^ (state.level * 0x9e3779b9) ^ state.tickCount) >>> 0);
    const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
    if (choices.length > 0) {
      choicesShowing = true;
      levelUpScreen.show(choices);
    } else {
      state = { ...state, pendingLevelUp: false };
    }
  }

  const deathScreen = createDeathScreen(app.screen.width, app.screen.height, () => {
    resetToMenu();
  });
  uiLayer.addChild(deathScreen.container);

  const kb = createKeyboardController();
  const touch = createTouchController(app.canvas);
  touch.updateZones(app.screen.width, app.screen.height);
  const touchGuide = createTouchGuide(touch);
  uiLayer.addChild(touchGuide.container);
  touchGuide.layout(app.screen.width, app.screen.height);

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

  function resetRunState(difficulty: Difficulty, player: Plane = makePlayer()) {
    state = { ...createWorldState(Math.floor(Math.random() * 1e9), player), difficulty };
    acc = 0;
    prevBulletIds = new Set();
    prevPlayerScore = state.playerScore;
    prevLevel = state.level;
    prevPlayerAlive = state.player.alive;
    prevPlayerState = state.player.state;
    prevTickCount = state.tickCount;
    prevPlayerHp = state.player.hp;
    bullets.sync([]);
    groundFx.clear();
    screenFx.setVignette(0);
    screenFx.disableDeathTint();
    levelUpScreen.hide();
    deathScreen.hide();
    radioPopup.hide();
    dialogueOverlay.hide();
    shownChicoFirstKillRadio = false;
  }

  function startArena() {
    runMode = 'arena';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('medium' as Difficulty);
    rollSkyTheme();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    hud.container.visible = true;
    gameRunning = true;
  }

  function startStoryMissionOne() {
    runMode = 'story';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('medium' as Difficulty, makeCarrierLaunchPlayer());

    // Setup scrolling world width and scaling
    state.worldWidth = MISSION_ONE_WORLD_WIDTH;
    // Campaign has no lethal ground — the bottom turns the plane back like the ceiling.
    state.softFloor = true;
    camera.setWorldWidth(MISSION_ONE_WORLD_WIDTH);
    layoutWorld();
    // Start the camera already framed close on the carrier launch (no zoom-in pop).
    camera.setFocus(state.player.kinematic.position.x + 90, WORLD_HEIGHT * 0.52, 1.55);
    camera.snap();

    // Initialize Caravan State inside core state!
    const caravanStart = getMissionOneCaravanStart();
    state.caravan = {
      active: true,
      position: caravanStart,
      velocity: { x: MISSION_ONE_CARAVAN_SPEED, y: 0 },
      hp: 100,
      maxHp: 100,
      incomingDamageMultiplier: 0.6,
    };

    setSkyTheme('twilight');
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    hud.container.visible = true;
    caravanGauge.visible = true;
    missionObjective.visible = true;
    drawCaravanGauge(1);
    drawMissionObjective(missionOne.phase);
    const onReady = () => {
      gameRunning = true;
      if (TIME_SKIP_SEC > 0) {
        missionOne.fastForward(TIME_SKIP_SEC);
      }
    };
    if (SKIP_BRIEFING) {
      onReady();
    } else {
      gameRunning = false;
      dialogueOverlay.show(STORY_INTRO_LINES, onReady);
    }
  }

  function spawnStoryWave(count: number, boss = false, role: MissionOneEnemyRole = 'chase-player', hpMultiplier = 1) {
    const spawned: Plane[] = [];
    let nextId = state.nextEntityId;
    const cx = state.caravan ? state.caravan.position.x : WORLD_WIDTH / 2;
    const worldW = state.worldWidth || WORLD_WIDTH;

    for (let i = 0; i < count; i++) {
      const lane = i - (count - 1) / 2;
      
      // Calculate dynamic spawn X relative to the caravan based on the current wave timing
      let spawnX = state.caravan ? cx + 900 - i * 76 : getMissionOneEnemySpawnX(i, boss);
      if (boss) {
        spawnX = cx + 1000;
      } else {
        const t = missionOne.timeSec;
        if (t >= 30 && t < 70) {
          // Spawn behind caravan (tail hunters)
          spawnX = cx - 850 - i * 76;
        } else if (t >= 130 && t < 180 && i % 2 === 0) {
          // Crossfire split
          spawnX = cx - 800 - i * 76;
        }
      }

      // Clamp X spawn point to stay within world bounds
      spawnX = Math.max(150, Math.min(worldW - 150, spawnX));

      const y = boss
        ? WORLD_HEIGHT * 0.24
        : WORLD_HEIGHT * (0.18 + 0.1 * (i % 3)) + Math.sin(missionOne.timeSec + i) * 24;
      const enemy = makeScriptedEnemy(nextId, spawnX, y, boss ? hpMultiplier : 1.0, Math.PI + lane * 0.08);
      enemy.aiRole = role;
      scriptedEnemyIds.add(enemy.id);
      if (boss) missionOne.registerBoss(enemy.id);
      spawned.push(enemy);
      nextId++;
    }
    state = {
      ...state,
      enemies: [...state.enemies, ...spawned],
      nextEntityId: nextId,
    };
  }

  function layoutWorld() {
    const cw = app.screen.width;
    const ch = app.screen.height;
    let scale = Math.min(cw / WORLD_WIDTH, ch / WORLD_HEIGHT);
    if (runMode === 'story') {
      scale = ch / WORLD_HEIGHT;
    }
    worldLayer.scale.set(scale);
    
    const bx = runMode === 'story' ? 0 : (cw - WORLD_WIDTH * scale) / 2;
    const by = (ch - WORLD_HEIGHT * scale) / 2;
    
    camera.setBase(bx, by);
    if (runMode !== 'story') {
      worldLayer.x = bx;
      worldLayer.y = by;
    }
  }
  layoutWorld();

  let acc = 0;
  let renderTimeSec = 0;
  let prevPlayerScore = state.playerScore;
  let prevLevel = state.level;
  let prevPlayerAlive = state.player.alive;
  let prevPlayerState = state.player.state;
  let prevTickCount = state.tickCount;
  let prevPlayerHp = state.player.hp;
  app.ticker.add((ticker) => {
    const realDt = ticker.deltaMS / 1000;
    const dt = clock.tick(realDt);
    renderTimeSec += dt;

    lightning.update(dt);
    bgClouds.update(dt);
    fgClouds.update(dt);
    // 1. Update Sky Background animations (clouds, beacons, searchlights, lightning rim-light, leaves)
    if (sky) {
      const px = runMode === 'story' ? camera.currentFocusX : (state.player ? state.player.kinematic.position.x : RUNWAY_X);
      const py = runMode === 'story' ? WORLD_HEIGHT / 2 : (state.player ? state.player.kinematic.position.y : RUNWAY_Y);
      sky.update(dt, renderTimeSec, px, py, lightning.isLightningActive());
    }
    lensFlare.update(dt, renderTimeSec, state.player ? state.player.kinematic.position.x : RUNWAY_X);
    if (silhouettes) silhouettes.update(dt, renderTimeSec);

    // 2. Update UI overlays (Level Up Card entries & Death Telegram Typewriter)
    startScreen.update(dt);
    levelUpScreen.update(dt);
    deathScreen.update(dt);
    radioPopup.update(dt);
    touchGuide.setActive(gameRunning && !choicesShowing && !state.gameOver);

    if (!gameRunning) return;
    const frameGate = resolveMissionOneFrameGate({
      choicesShowing,
      pendingLevelUp: state.pendingLevelUp,
    });
    if (frameGate === 'open-upgrade') {
      openLevelUpChoices();
      return;
    }
    if (frameGate === 'pause') return;
    acc += dt;
    if (acc > 0.2) {
      acc = 0.2; // Spiral of death prevention / clamp physics accumulator catch-up
    }
    const inputCmd = currentCommand();
    // Story-mode launch assist — proportional steer toward LAUNCH_TARGET_HEADING.
    // Activates for the first 1.8 s of the mission and ONLY overrides axes the
    // player hasn't touched (so Сергей can start steering immediately).
    let cmd: PlayerCommand = inputCmd;
    if (runMode === 'story') {
      const heading = state.player.kinematic.heading;
      const py = state.player.kinematic.position.y;
      let assistRotate: -1 | 0 | 1 = 0;

      if (missionOne.timeSec < LAUNCH_ASSIST_SEC) {
        const err = heading - LAUNCH_TARGET_HEADING;
        if (err > 0.06) assistRotate = -1;
        else if (err < -0.06) assistRotate = 1;
      }

      // Anti-ceiling safety: if the plane is climbing into the world ceiling
      // and the player isn't actively pitching down, nose toward level. The
      // base engine would dive the plane to π/2 (vertical) at this altitude,
      // which crashes it. We override with a gentler return-to-level steer.
      // Also catches the symmetric "diving toward the floor" case.
      if (inputCmd.rotate === 0) {
        if (py < CEILING_SAFETY_Y && heading < 0.05) {
          assistRotate = 1; // pitch down toward level
        } else if (py > FLOOR_SAFETY_Y && heading > -0.05) {
          assistRotate = -1; // pitch up toward level
        }
      }

      const assistThrottle: -1 | 0 | 1 = state.player.kinematic.throttleLevel < 0.85 ? 1 : 0;
      const wantFire = missionOne.timeSec < LAUNCH_ASSIST_SEC && missionOne.timeSec > 1.2;
      cmd = {
        ...inputCmd,
        rotate: inputCmd.rotate !== 0 ? inputCmd.rotate : assistRotate,
        throttleDelta: inputCmd.throttleDelta !== 0 ? inputCmd.throttleDelta : assistThrottle,
        fire: inputCmd.fire || wantFire,
      };
    }
    let safety = 8;
    while (acc >= TICK_DT && safety > 0) {
      state = tick(state, cmd);
      acc -= TICK_DT;
      safety--;
      if (state.pendingLevelUp || state.gameOver) break;
    }


    if (runMode === 'story' && !storyCompleted) {
      state = {
        ...state,
        gameOver: false,
        enemies: state.enemies.filter((enemy) => scriptedEnemyIds.has(enemy.id) || enemy.state === 'dying' || enemy.state === 'crashed'),
      };

      for (const wave of missionOne.consumeWaves()) {
        for (const group of getMissionOneWavePlan(wave.id)) {
          spawnStoryWave(group.count, false, group.role);
        }
        radioPopup.show({ speaker: 'Мира', text: `${wave.label}: держи их подальше от каравана!` }, 3.4);
      }

      if (missionOne.shouldSpawnBoss()) {
        const bossPlan = getMissionOneBossPlan();
        spawnStoryWave(bossPlan.count, true, bossPlan.role, bossPlan.hpMultiplier);
        screenFx.flash(0xff3322, 0.5, 0.35);
        camera.shake(12);
        clock.slowMo(0.3, 1.8, 1.0); // Epic entry slow-mo!
      }

      let bossAlive = missionOne.isBossAlive(state.enemies);
      
      // If boss is defeated enough, trigger his retreat/crash.
      if (missionOne.bossId !== null) {
        const bossPlan = getMissionOneBossPlan();
        const boss = state.enemies.find(e => e.id === missionOne.bossId);
        const beaconForcesRetreat = missionOne.shouldForceBossRetreat();
        if (boss && boss.alive && (boss.hp < boss.maxHp * bossPlan.retreatHpFraction || beaconForcesRetreat) && boss.state === 'flying') {
          boss.hp = 0;
          boss.alive = false;
          boss.state = 'dying';
          boss.dyingTimer = 3.0;
          radioPopup.show({
            speaker: 'Мира',
            text: beaconForcesRetreat ? 'Маяк Бринн зажегся! Шрам уходит в туман!' : 'Шрам уходит! Караван почти у выхода!',
          }, 4.0);
        }
      }
      bossAlive = missionOne.isBossAlive(state.enemies);

      let caravanHpFraction = state.caravan ? state.caravan.hp / state.caravan.maxHp : 1.0;
      missionOne.update(dt, caravanHpFraction, bossAlive);
      const caravanBeforeRepair = state.caravan;
      if (caravanBeforeRepair && missionOne.shouldTriggerEmergencyRepair()) {
        const repairedHp = Math.min(caravanBeforeRepair.maxHp, caravanBeforeRepair.hp + 28);
        state = {
          ...state,
          caravan: {
            ...caravanBeforeRepair,
            hp: repairedHp,
          },
        };
        caravanHpFraction = repairedHp / caravanBeforeRepair.maxHp;
        radioPopup.show({
          speaker: 'Тотти',
          text: 'Держим строй! Ремонтная команда закрыла пробоины каравана.',
        }, 4.0);
      }
      drawCaravanGauge(caravanHpFraction);
      drawMissionObjective(missionOne.phase);

      // Boss marker — small red arrow + "ШРАМ" label hovering above Scar.
      if (missionOne.bossId !== null) {
        const boss = state.enemies.find(e => e.id === missionOne.bossId);
        if (boss && boss.alive && boss.state !== 'crashed') {
          bossMarker.visible = true;
          bossMarker.x = boss.kinematic.position.x;
          bossMarker.y = boss.kinematic.position.y - 44 + Math.sin(renderTimeSec * 4) * 2.5;
        } else {
          bossMarker.visible = false;
        }
      }

      storyScene.update(
        dt,
        missionOne.timeSec,
        true,
        missionOne.routeProgress,
        caravanHpFraction,
        missionOne.phase,
        missionOne.revealAmount,
        bossAlive,
        state.caravan ? state.caravan.position.x : 1200,
        camera.currentFocusX,
      );

      const radioEvent = missionOne.consumeRadio();
      if (radioEvent) radioPopup.show(radioEvent);

      // Chico first kill reaction
      if (state.playerScore > 0 && !shownChicoFirstKillRadio) {
        shownChicoFirstKillRadio = true;
        radioPopup.show({ speaker: 'Чико', text: 'Шакалы? Ну все, караван идет с оркестром!' }, 3.5);
      }

      // --- Camera Pan and Zoom Logic ---
      // Cap zoom at 1.2 during active play so the player keeps a wide enough
      // view to actually dogfight. Cinematic zooms (>1.2) are reserved for
      // brief beats: launch, boss entrance, victory.
      const tSec = missionOne.timeSec;
      const px = state.player.kinematic.position.x;
      const py = state.player.kinematic.position.y;
      if (tSec < 2.5) {
        // Launch — frame the carrier deck + player up close.
        camera.setFocus(px + 90, WORLD_HEIGHT * 0.52, 1.55);
      } else if (tSec < 8.0) {
        // Launch → escort transition: ease zoom back to cover while panning to player.
        const u = (tSec - 2.5) / 5.5;
        const cx = state.caravan ? state.caravan.position.x : px;
        const cy = state.caravan ? state.caravan.position.y : py;
        const midX = (px + cx) / 2;
        const midY = (py + cy) / 2;
        const fx = px + (midX - px) * u;
        const fy = WORLD_HEIGHT * 0.52 + (midY - WORLD_HEIGHT * 0.52) * u;
        const zoom = Math.max(1.0, 1.55 - u * 0.5);
        camera.setFocus(fx, fy, zoom);
      } else if (tSec >= 246 && tSec < 249) {
        // Boss entrance — frame Scar and the player together.
        const boss = state.enemies.find(e => e.id === missionOne.bossId);
        const bx = boss ? boss.kinematic.position.x : 10000;
        const by = boss ? boss.kinematic.position.y : WORLD_HEIGHT * 0.24;
        camera.setFocus((bx + px) * 0.5, (by + py) * 0.5, 1.18);
      } else {
        // Escort: keep the player in frame, with a limited bias toward the caravan.
        const cx = state.caravan ? state.caravan.position.x : WORLD_WIDTH / 2;
        const cy = state.caravan ? state.caravan.position.y : WORLD_HEIGHT * 0.31;
        const focus = getMissionOneEscortFocus({
          playerX: px,
          playerY: py,
          caravanX: cx,
          caravanY: cy,
        });
        camera.setFocus(focus.x, focus.y, focus.zoom);
      }

      const missionOutcome = resolveMissionOneOutcome({
        phase: missionOne.phase,
        routeProgress: missionOne.routeProgress,
        bossAlive,
        playerAlive: state.player.alive,
        playerState: state.player.state,
        playerScore: state.playerScore,
      });

      if (missionOutcome === 'caravan-lost' && !dialogueOverlay.container.visible) {
        storyCompleted = true;
        gameRunning = false;
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_FAILURE_CARAVAN_LINES, resetToMenu);
      } else if (missionOutcome === 'pilot-lost' && !dialogueOverlay.container.visible) {
        storyCompleted = true;
        gameRunning = false;
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_FAILURE_PILOT_LINES, resetToMenu);
      }

      if (missionOutcome === 'victory' && !dialogueOverlay.container.visible) {
        missionOne.markVictory();
        storyCompleted = true;
        gameRunning = false;
        screenFx.flash(0xffe2a2, 0.55, 0.35);
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_VICTORY_LINES, resetToMenu);
      }
    } else {
      storyScene.update(dt, renderTimeSec, false, 0, 1, 'briefing', 0, false);
    }

    // Plane-vs-plane collision VFX (Phase 5).
    // Only react when a NEW game tick has produced new events. Without this guard,
    // render frames during slow-mo / hit-pause re-read the same events buffer and
    // re-trigger shake + hit-pause every frame — the screen "shakes forever".
    if (state.tickCount !== prevTickCount) {
      for (const ev of state.planeCollisionEvents) {
        damageFx.addSparks({ x: ev.posX, y: ev.posY }, 36);
        damageFx.addImpactFlash({ x: ev.posX, y: ev.posY });
        const anyDied = ev.aDied || ev.bDied;
        camera.shake(anyDied ? 14 : 8);
        clock.hitPause(anyDied ? HIT_PAUSE_FRAMES_RAM_KILL : HIT_PAUSE_FRAMES_RAM);

        const playerIsA = ev.aFaction === 'player';
        const playerIsB = ev.bFaction === 'player';
        const enemyDied = (playerIsA && ev.bDied) || (playerIsB && ev.aDied);
        const playerSurvived = !(playerIsA && ev.aDied) && !(playerIsB && ev.bDied);
        if ((playerIsA || playerIsB) && enemyDied && playerSurvived) {
          hud.showRamNotice();
        }
      }
      prevTickCount = state.tickCount;
    }

    openLevelUpChoices();

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
      screenFx.enableDeathTint();
      clock.slowMo(SLOW_MO_SCALE, SLOW_MO_DURATION_SEC, SLOW_MO_RECOVERY_SEC);
    }
    if (!prevPlayerAlive && state.player.alive) {
      // Respawned — back to color.
      screenFx.disableDeathTint();
    }
    // When the player plane finishes the death-spin (dying → crashed), snap back
    // to color so the big final explosion lands in full saturation.
    if (state.player.state === 'crashed' && prevPlayerState !== 'crashed') {
      screenFx.disableDeathTint();
    }
    // Hit glitch & oil splatters on player damage (Phase 2)
    if (state.player.hp < prevPlayerHp && state.player.alive) {
      screenFx.triggerHitGlitch();
      // Drop oil if significantly damaged or by chance
      if (state.player.hp / state.player.maxHp <= 0.55 || Math.random() < 0.45) {
        screenFx.triggerOilSplatter();
      }
    }
    prevPlayerHp = state.player.hp;

    prevPlayerScore = state.playerScore;
    prevLevel = state.level;
    prevPlayerAlive = state.player.alive;
    prevPlayerState = state.player.state;

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

    playerSprite.update(state.player, dt, damageFx, clock, camera, undefined, groundFx, { screenFx });

    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy');
        planeLayer.addChild(s.container, s.hpBar);
        enemySprites.set(e.id, s);
      }
      s.update(e, dt, damageFx, clock, camera, undefined, groundFx, { screenFx });
    }
    for (const [id, s] of enemySprites) {
      if (!seenEnemy.has(id)) {
        planeLayer.removeChild(s.container);
        planeLayer.removeChild(s.hpBar);
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

    // Off-screen arrow for any dying enemy (Task 4.6).
    {
      const dyingEnemy = state.enemies.find(e => e.state === 'dying');
      if (dyingEnemy) {
        const wx = dyingEnemy.kinematic.position.x;
        const wy = dyingEnemy.kinematic.position.y;
        const onScreen = wx >= 0 && wx <= WORLD_WIDTH && wy >= 0 && wy <= WORLD_HEIGHT;
        if (!onScreen) {
          const sx = worldLayer.x + wx * worldLayer.scale.x;
          const sy = worldLayer.y + wy * worldLayer.scale.y;
          hud.showDirArrow(sx, sy);
        } else {
          hud.hideDirArrow();
        }
      } else {
        hud.hideDirArrow();
      }
    }

    bullets.sync(state.bullets);
    for (const b of state.bullets) tracers.emit(b);
    tracers.update(dt);
    damageFx.update(dt);
    groundFx.update(dt, (x, y) => damageFx.addSmokeTrail({ x, y }, 1));
    muzzleFlashes.update(dt);
    screenFx.update(dt, renderTimeSec, worldLayer);
    hud.update(state);
    camera.tickShake(dt);

    if (debugText.visible) {
      if (runMode === 'story') {
        const mm = Math.floor(missionOne.timeSec / 60);
        const ss = Math.floor(missionOne.timeSec % 60).toString().padStart(2, '0');
        const car = state.caravan ? `caravan=${(state.caravan.hp / state.caravan.maxHp * 100).toFixed(0)}%` : 'caravan=?';
        const boss = missionOne.bossId !== null
          ? ` boss-id=${missionOne.bossId} alive=${missionOne.isBossAlive(state.enemies)}`
          : '';
        debugText.text = `STORY  t=${mm}:${ss}  phase=${missionOne.phase}  ${car}  enemies=${state.enemies.length}${boss}  p.hp=${state.player.hp.toFixed(0)}  g=${state.player.kinematic.g.toFixed(0)}  st=${state.player.state}  h=${state.player.kinematic.heading.toFixed(2)}`;
      } else {
        debugText.text = `ARENA  t=${state.timeSec.toFixed(1)}  enemies=${state.enemies.length}  hp=${state.player.hp.toFixed(0)}  score=${state.playerScore}`;
      }
    }
  });

  function resetToMenu() {
    runMode = 'menu';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    gameRunning = false;
    choicesShowing = false;
    acc = 0; // Reset physics time accumulator to avoid hyper-speed catch-up spikes
    for (const [, s] of enemySprites) {
      planeLayer.removeChild(s.container);
      planeLayer.removeChild(s.hpBar);
    }
    enemySprites.clear();
    for (const [, s] of pilotSprites) {
      planeLayer.removeChild(s.container);
    }
    pilotSprites.clear();
    bullets.sync([]);
    prevBulletIds = new Set();
    groundFx.clear();
    storyScene.reset();
    state = createWorldState(Math.floor(Math.random() * 1e9), makePlayer());
    prevPlayerScore = state.playerScore;
    prevLevel = state.level;
    prevPlayerAlive = state.player.alive;
    prevPlayerState = state.player.state;
    prevPlayerHp = state.player.hp;
    screenFx.setVignette(0);
    screenFx.disableDeathTint();
    levelUpScreen.hide();
    deathScreen.hide();
    radioPopup.hide();
    dialogueOverlay.hide();
    worldLayer.visible = false;
    hud.container.visible = false;
    caravanGauge.visible = false;
    missionObjective.visible = false;
    menuBackdrop.show();
    startScreen.show();
    shownChicoFirstKillRadio = false;
    camera.resetFocus();
    camera.setWorldWidth(WORLD_WIDTH);
    layoutWorld();
    rollSkyTheme(); // Roll a new gorgeous environment style for the next run
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      resetToMenu();
    }
    if (e.code === 'F3') {
      debugText.visible = !debugText.visible;
    }
  });

  // Auto-start story mode if URL has ?story (used for screenshot verification).
  if (AUTO_STORY) {
    requestAnimationFrame(() => startStoryMissionOne());
  }

  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    layoutWorld();
    camera.setScreen(w, h);
    hud.resize(w, h);
    screenFx.resize(w, h);
    touch.updateZones(w, h);
    touchGuide.layout(w, h);
    startScreen.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
    dialogueOverlay.resize(w, h);
    radioPopup.resize(w);
    layoutCaravanGauge(w, h);
  };
  window.addEventListener('resize', onResize);
}
