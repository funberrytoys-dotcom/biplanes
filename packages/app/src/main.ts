import { Assets, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { assetUrl } from './asset-url.js';
import {
  TICK_DT,
  PLANE_INITIAL_HP,
  ENEMY_INITIAL_HP_LIGHT,
  ENEMY_INITIAL_HP_HEAVY,
  G_MAX_LEVEL,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_SCORE_TO_WIN,
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
  ARENA_FINAL_BOSS_SCORE,
  type WorldState,
  type Plane,
  type Difficulty,
  type UpgradeId,
  isStalling,
  findPilot,
} from '@biplanes/core';
import {
  createPixiApp,
  createSkyBackground,
  createCloudField,
  createCloudSea,
  createPlaneSprite,
  createPilotSprite,
  BulletPool,
  BombPool,
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
  createCloudVolume,
  createArenaWeather,
  resolveGunfeelShot,
  GroundFx,
  type SkyThemeId,
  type SkyBackgroundHandle,
  type CloudVolumePlane,
} from '@biplanes/render';
import {
  createKeyboardController,
  createTouchController,
} from '@biplanes/input';
import { createStartScreen } from './screens/start-screen.js';
import { createLevelUpScreen } from './screens/level-up-screen.js';
import { createDeathScreen } from './screens/death-screen.js';
import { createDialogueOverlay, createRadioPopup, type DialogueLine } from './campaign/dialogue-overlay.js';
import { getMissionUiLayout } from './campaign/mission-ui-layout.js';
import { createMissionOneScene } from './campaign/mission-one-scene.js';
import { createMissionOneController } from './campaign/mission-one-controller.js';
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
import { resolveFirstSortieGuidance, shouldShowFirstUpgradeBriefing } from './campaign/first-sortie-guidance.js';
import { resolveMissionOneOutcome } from './campaign/mission-one-rules.js';
import {
  arenaDifficultyForRound,
  arenaEnemyCountForRound,
  arenaEnemyHpMultiplierForRound,
  arenaEnemyRoleForRound,
  arenaEnemyRoleTuning,
  countUnresolvedArenaEnemies,
  resolveArenaDuelFlow,
  shouldSpawnArenaFinalBossForRound,
  type ArenaRoundPhase,
} from './arena-director.js';
import { ARENA_BACKGROUND_URLS, ARENA_LOCATION_THEMES } from './arena-locations.js';
import {
  resolveArenaCameraFocus,
  resolveArenaPlayerRunwayStart,
  shouldStartArenaDuelAfterTakeoff,
} from './arena-camera.js';
import { getGunfeelLabShotAt } from './gunfeel-lab.js';
import { resolveFlightLabCue, resolveFlightLabSpawn } from './flight-lab.js';
import { createGameAudio } from './audio/game-audio.js';
import { shouldShowTouchGuide } from './mobile-touch-guide.js';
import { fitMobileZoom, getMobileViewportInfo } from './mobile-viewport.js';

const MENU_VIDEO_URL = assetUrl('assets/menu/main-menu-placeholder.mp4');
const CHICO_PORTRAIT_URL = assetUrl('assets/campaign/portrait_chico.png');
const ISLAND_BRYNN_FRAME_URLS = Array.from({ length: 50 }, (_, i) => assetUrl(`assets/campaign/island_brynn/frame_${String(i + 1).padStart(4, '0')}.png`));
const ARENA_WORLD_WIDTH = WORLD_WIDTH * 5;
const ARENA_WORLD_HEIGHT = WORLD_HEIGHT * 3;
const ARENA_TOTAL_STAGES = ARENA_LOCATION_THEMES.length;
const SKY_TEST_WORLD_WIDTH = 2172 * 3;
const SKY_TEST_WORLD_HEIGHT = 724 * 3;
const CLOUD_VOLUME_WORLD_WIDTH = Math.max(ARENA_WORLD_WIDTH, SKY_TEST_WORLD_WIDTH);
const CLOUD_VOLUME_WORLD_HEIGHT = Math.max(ARENA_WORLD_HEIGHT, SKY_TEST_WORLD_HEIGHT);
const SKY_TEST_IMAGE_URL = assetUrl('assets/biplanes/arena/day/arena_day_generated_test.jpg');
const SKY_TEST_LAYER_ASSET_URLS = [
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_01.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_02.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_03.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_05.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_07.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_01.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_02.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_04.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_05.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_08.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_11.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_13.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_14.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_18.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_20.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_22.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_23.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_25.png'),
  assetUrl('assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_27.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_02.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_03.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_04.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_05.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_06.png'),
  assetUrl('assets/biplanes/arena/day/islands/island_silhouette_07.png'),
];

const VISUAL_ASSET_URLS = [
  SKY_TEST_IMAGE_URL,
  ...Object.values(ARENA_BACKGROUND_URLS),
  ...SKY_TEST_LAYER_ASSET_URLS,
  assetUrl('assets/biplanes/sky_noon.jpg'),
  assetUrl('assets/biplanes/sky_sunset.jpg'),
  assetUrl('assets/biplanes/sky_twilight.jpg'),
  assetUrl('assets/biplanes/sky_night.jpg'),
  assetUrl('assets/biplanes/plane_chico_blue.png'),
  assetUrl('assets/biplanes/plane_player_sov_sheet.png'),
  assetUrl('assets/biplanes/plane_enemy_red.png'),
  assetUrl('assets/biplanes/plane_enemy_crimson_sheet.png'),
  assetUrl('assets/biplanes/airship_1.png'),
  assetUrl('assets/biplanes/airship_2.png'),
  assetUrl('assets/biplanes/enemy_airship_1.png'),
  assetUrl('assets/biplanes/enemy_airship_2.png'),
  assetUrl('assets/biplanes/island_factory.png'),
  assetUrl('assets/biplanes/island_player.png'),
  assetUrl('assets/biplanes/island_industrial.png'),
  assetUrl('assets/biplanes/island_enemy_red.png'),
  assetUrl('assets/biplanes/island_enemy_core.png'),
  assetUrl('assets/biplanes/island_oilfield.png'),
  assetUrl('assets/biplanes/island_blackyard.png'),
  assetUrl('assets/biplanes/island_moon.png'),
  assetUrl('assets/campaign/portrait_chico.png'),
  assetUrl('assets/campaign/plane_scar.png'),
  assetUrl('assets/campaign/caravan_sov.png'),
  assetUrl('assets/campaign/airship_sov_large.png'),
  assetUrl('assets/campaign/airship_sov_variant_1.png'),
  assetUrl('assets/campaign/airship_sov_variant_2.png'),
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
    boost: new Graphics(),
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
    boost: new Text({ text: 'BOOST', style: labelStyle }),
  };
  c.addChild(
    rings.left, rings.right, rings.fire, rings.bomb, rings.boost,
    labels.left, labels.right, labels.fire, labels.bomb, labels.boost
  );
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

  function layout(w: number, _h: number) {
    touchLikely = shouldShowTouchGuide({
      width: w,
      maxTouchPoints: navigator.maxTouchPoints,
    });
    c.visible = active && touchLikely;
    if (!touchLikely) return;
    const z = touch.zones;
    drawRing(rings.left, z.rotateCcw.x, z.rotateCcw.y, z.rotateCcw.r, 0x33d6ff);
    drawRing(rings.right, z.rotateCw.x, z.rotateCw.y, z.rotateCw.r, 0x33d6ff);
    drawRing(rings.fire, z.fire.x, z.fire.y, z.fire.r, 0xff8c19);
    drawRing(rings.bomb, z.bomb.x, z.bomb.y, z.bomb.r, 0xff4444);
    drawRing(rings.boost, z.boost.x, z.boost.y, z.boost.r, 0xffd34a);
    placeLabel(labels.left, z.rotateCcw.x, z.rotateCcw.y);
    placeLabel(labels.right, z.rotateCw.x, z.rotateCw.y);
    placeLabel(labels.fire, z.fire.x, z.fire.y);
    placeLabel(labels.bomb, z.bomb.x, z.bomb.y);
    placeLabel(labels.boost, z.boost.x, z.boost.y);
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

function makeArenaRunwayPlayer(previous?: Plane): Plane {
  const player = previous ?? makePlayer();
  const runway = resolveArenaPlayerRunwayStart(ARENA_WORLD_WIDTH, ARENA_WORLD_HEIGHT);
  return {
    ...player,
    kinematic: {
      ...player.kinematic,
      ...runway,
    },
    hp: player.maxHp,
    weaponCooldown: 0,
    alive: true,
    state: 'taxi',
    respawnTimer: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
  };
}

function makeSkyTestPlayer(): Plane {
  const player = makePlayer();
  return {
    ...player,
    kinematic: {
      ...player.kinematic,
      position: { x: 260, y: SKY_TEST_WORLD_HEIGHT * 0.48 },
      velocity: { x: G_MAX_LEVEL, y: 0 },
      heading: 0,
      g: G_MAX_LEVEL,
      throttleOn: true,
      throttle: true,
      throttleLevel: 1.0,
      facing: 1,
    },
    state: 'flying',
  };
}

function makeGunfeelLabPlayer(): Plane {
  const player = makeSkyTestPlayer();
  return {
    ...player,
    kinematic: {
      ...player.kinematic,
      position: { x: SKY_TEST_WORLD_WIDTH * 0.38, y: SKY_TEST_WORLD_HEIGHT * 0.46 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      g: G_MAX_LEVEL,
      throttleOn: true,
      throttle: true,
      throttleLevel: 1,
    },
  };
}

function makeFlightLabPlayer(): Plane {
  const player = makePlayer();
  return {
    ...player,
    kinematic: {
      ...player.kinematic,
      ...resolveFlightLabSpawn(SKY_TEST_WORLD_WIDTH, SKY_TEST_WORLD_HEIGHT),
    },
    state: 'flying',
  };
}

function makeSkyTestBoss(id: number): Plane {
  const hp = ENEMY_INITIAL_HP_LIGHT * 8;
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x: SKY_TEST_WORLD_WIDTH - 760, y: SKY_TEST_WORLD_HEIGHT * 0.47 },
      velocity: { x: -G_MAX_LEVEL * 0.9, y: 0 },
      heading: Math.PI,
      throttleOn: true,
      g: G_MAX_LEVEL * 0.9,
      facing: -1,
      throttle: true,
      throttleLevel: 0.95,
    },
    hp,
    maxHp: hp,
    weaponCooldown: 0.2,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
  };
}

function makeArenaRoundEnemy(id: number, player: Plane, round: number, lane: number = 0): Plane {
  const role = arenaEnemyRoleForRound(round, lane);
  const roleTuning = arenaEnemyRoleTuning(role);
  const hp = Math.round(ENEMY_INITIAL_HP_LIGHT * arenaEnemyHpMultiplierForRound(round) * roleTuning.hpScale);
  const speed = G_MAX_LEVEL * Math.min(1.2, (0.92 + round * 0.03) * roleTuning.speedScale);
  const fromRight = player.kinematic.position.x < ARENA_WORLD_WIDTH * 0.55;
  const heading = fromRight ? Math.PI : 0;
  const x = fromRight
    ? Math.min(ARENA_WORLD_WIDTH - 900, player.kinematic.position.x + 1350 + lane * 180)
    : Math.max(900, player.kinematic.position.x - 1350 - lane * 180);
  const laneOffset = (lane % 2 === 0 ? -1 : 1) * (220 + Math.floor(lane / 2) * 160);
  const y = Math.max(360, Math.min(ARENA_WORLD_HEIGHT - 560, player.kinematic.position.y + laneOffset));
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: Math.cos(heading) * speed, y: 0 },
      heading,
      throttleOn: true,
      g: speed,
      facing: fromRight ? -1 : 1,
      throttle: true,
      throttleLevel: Math.min(1, 0.94 + round * 0.018),
    },
    hp,
    maxHp: hp,
    weaponCooldown: Math.max(0.03, (0.34 - round * 0.026) * roleTuning.weaponCooldownScale),
    alive: true,
    state: 'flying',
    respawnTimer: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
    aiRole: role,
    visualScale: roleTuning.visualScale,
  };
}

function makeArenaScarBoss(id: number, player: Plane, round: number): Plane {
  const roleTuning = arenaEnemyRoleTuning('boss');
  const hp = Math.round(ENEMY_INITIAL_HP_HEAVY * arenaEnemyHpMultiplierForRound(round) * 3.2 * roleTuning.hpScale);
  const fromRight = player.kinematic.position.x < ARENA_WORLD_WIDTH * 0.55;
  const heading = fromRight ? Math.PI : 0;
  const x = fromRight
    ? Math.min(ARENA_WORLD_WIDTH - 1200, player.kinematic.position.x + 1800)
    : Math.max(1200, player.kinematic.position.x - 1800);
  const y = Math.max(420, Math.min(ARENA_WORLD_HEIGHT - 760, player.kinematic.position.y - 260));
  const speed = G_MAX_LEVEL * 0.96 * roleTuning.speedScale;
  return {
    id,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: Math.cos(heading) * speed, y: 0 },
      heading,
      throttleOn: true,
      g: speed,
      facing: fromRight ? -1 : 1,
      throttle: true,
      throttleLevel: 1,
    },
    hp,
    maxHp: hp,
    weaponCooldown: 0.05 * roleTuning.weaponCooldownScale,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
    boostHeat: 0,
    boostActive: false,
    noThrottleSec: 0,
    aiRole: 'boss',
    isBoss: true,
    visualScale: roleTuning.visualScale,
    bossName: 'ШРАМ',
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
const AUTO_ARENA = URL_PARAMS.has('arena');
const AUTO_SKY_TEST = URL_PARAMS.has('skytest');
const AUTO_GUNFEEL_LAB = URL_PARAMS.has('gunfeelLab');
const AUTO_FLIGHT_LAB = URL_PARAMS.has('flightLab');
const AUTO_OIL_SHOT = URL_PARAMS.has('oilshot');
const SKIP_BRIEFING = URL_PARAMS.has('skipBriefing');
const DEBUG_HUD_ON_BOOT = URL_PARAMS.has('debug');
const TIME_SKIP_SEC = Math.max(0, parseFloat(URL_PARAMS.get('t') ?? '0') || 0);
const DEBUG_ARENA_SCORE = DEBUG_HUD_ON_BOOT
  ? Math.max(0, Math.min(ARENA_FINAL_BOSS_SCORE, Math.floor(parseFloat(URL_PARAMS.get('arenaScore') ?? '0') || 0)))
  : 0;

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
  let runMode: 'menu' | 'arena' | 'story' | 'skytest' | 'gunfeelLab' | 'flightLab' | 'oilshot' = 'menu';

  let sky: SkyBackgroundHandle;
  function setSkyTheme(themeId: SkyThemeId, imageUrl?: string) {
    const worldW =
      runMode === 'story' ? MISSION_ONE_WORLD_WIDTH :
      runMode === 'arena' ? ARENA_WORLD_WIDTH :
      runMode === 'flightLab' ? SKY_TEST_WORLD_WIDTH :
      runMode === 'gunfeelLab' ? SKY_TEST_WORLD_WIDTH :
      runMode === 'oilshot' ? SKY_TEST_WORLD_WIDTH :
      runMode === 'skytest' ? SKY_TEST_WORLD_WIDTH :
      WORLD_WIDTH;
    const worldH =
      runMode === 'arena' ? ARENA_WORLD_HEIGHT :
      runMode === 'flightLab' ? SKY_TEST_WORLD_HEIGHT :
      runMode === 'gunfeelLab' ? SKY_TEST_WORLD_HEIGHT :
      runMode === 'oilshot' ? SKY_TEST_WORLD_HEIGHT :
      runMode === 'skytest' ? SKY_TEST_WORLD_HEIGHT :
      WORLD_HEIGHT;
    if (sky) {
      worldLayer.removeChild(sky.container);
      sky.container.destroy({ children: true });
    }
    sky = createSkyBackground(
      worldW,
      worldH,
      themeId,
      runMode === 'story' || runMode === 'skytest' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot',
      (runMode === 'skytest' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot') ? SKY_TEST_IMAGE_URL : imageUrl,
      (runMode === 'skytest' || runMode === 'arena' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot') ? { mode: 'layeredArena' } : undefined,
    );
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
    silhouettes = createDistantSilhouettes(worldW, worldH, silhouetteColor);
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
    count: 5,
    yMin: 90,
    yMax: 430,
    widthMin: 180,
    widthMax: 360,
    alphaMin: 0.07,
    alphaMax: 0.16,
    speedMin: 3,
    speedMax: 8,
  });
  worldLayer.addChild(bgClouds.container);

  const skytestCloudVolume = createCloudVolume(CLOUD_VOLUME_WORLD_WIDTH, CLOUD_VOLUME_WORLD_HEIGHT);
  worldLayer.addChild(skytestCloudVolume.backContainer);

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
    yMin: 210,
    yMax: 650,
    widthMin: 360,
    widthMax: 680,
    alphaMin: 0.1,
    alphaMax: 0.24,
    speedMin: 6,
    speedMax: 13,
    useSoft: true,
  });
  worldLayer.addChild(fgClouds.container);

  worldLayer.addChild(skytestCloudVolume.frontContainer);

  const cloudSea = createCloudSea({
    count: 22,
    yTop: WORLD_HEIGHT * 0.74,
    span: 2200,
    widthMin: 440,
    widthMax: 760,
    alphaMin: 0.36,
    alphaMax: 0.64,
    driftSpeed: 8,
  });
  worldLayer.addChild(cloudSea.container);

  function syncAtmosphereLayers() {
    const showAtmosphere = runMode !== 'menu' && runMode !== 'skytest';
    bgClouds.container.visible = showAtmosphere;
    fgClouds.container.visible = showAtmosphere;
    cloudSea.container.visible = showAtmosphere;
    skytestCloudVolume.backContainer.visible = runMode === 'skytest' || runMode === 'arena' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot';
    skytestCloudVolume.frontContainer.visible = runMode === 'skytest' || runMode === 'arena' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot';
  }
  syncAtmosphereLayers();

  const bullets = new BulletPool(bulletLayer);
  const bombSprites = new BombPool(fxLayer);
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
  const audio = createGameAudio();

  function emitGunfeelShotVfx(
    x: number,
    y: number,
    heading: number,
    ownerFaction: 'player' | 'enemy',
    isHeavy: boolean = false,
  ) {
    audio.playGunshot(isHeavy, ownerFaction === 'player');
    const shotFeel = resolveGunfeelShot({
      ownerFaction,
      headingRad: heading,
      isHeavy,
    });
    muzzleFlashes.spawn(x, y, heading, {
      scale: shotFeel.flashScale,
      duration: shotFeel.flashDuration,
    });
    for (let i = 0; i < shotFeel.casingCount; i++) {
      damageFx.addCasing({ x, y }, heading);
    }
    if (shotFeel.sparkCount > 0) {
      damageFx.addSparks({ x, y }, shotFeel.sparkCount);
    }
    for (let i = 0; i < (isHeavy ? 5 : 3); i++) {
      tracers.emit({
        id: -1000 - i,
        ownerId: ownerFaction === 'player' ? state.player.id : 0,
        ownerFaction,
        position: {
          x: x + Math.cos(heading) * (i * 78),
          y: y + Math.sin(heading) * (i * 78),
        },
        velocity: {
          x: Math.cos(heading) * 1200,
          y: Math.sin(heading) * 1200,
        },
        lifetime: 0.2,
        damage: 0,
        alive: true,
        isHeavy,
      }, {
        scale: shotFeel.tracerScale,
        duration: shotFeel.tracerDuration,
      });
    }
    if (ownerFaction === 'player') {
      const cameraFeel = runMode === 'arena' ? 0.35 : 1;
      camera.shake(shotFeel.cameraShake * cameraFeel);
      camera.punch(shotFeel.recoil.x, shotFeel.recoil.y, shotFeel.cameraPunch * cameraFeel);
      camera.zoomPunch(1 + (shotFeel.zoomPunch - 1) * cameraFeel, shotFeel.flashDuration);
      screenFx.flash(isHeavy ? 0xffb24a : 0xffd98a, isHeavy ? 0.08 : 0.045, shotFeel.flashDuration);
    }
  }

  const uiLayer = new Container();
  app.stage.addChild(uiLayer);
  const arenaWeather = createArenaWeather(app.screen.width, app.screen.height);
  arenaWeather.container.visible = false;
  uiLayer.addChild(arenaWeather.container);
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

  const arenaStatus = new Text({
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
  arenaStatus.visible = false;
  uiLayer.addChild(arenaStatus);

  const flightLabStatus = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 24,
      fill: 0xfff0b8,
      fontWeight: 'bold',
      stroke: { color: 0x0a1220, width: 5 },
      align: 'center',
    }),
  });
  flightLabStatus.visible = false;
  uiLayer.addChild(flightLabStatus);

  function layoutCaravanGauge(w: number, h: number) {
    const missionLayout = getMissionUiLayout(w, h);
    caravanGauge.x = missionLayout.caravanGaugeX;
    caravanGauge.y = missionLayout.caravanGaugeY;
    missionObjective.x = missionLayout.objectiveX;
    missionObjective.y = missionLayout.objectiveY;
    missionObjective.style.fontSize = missionLayout.objectiveFontSize;
    if (arenaStatus.visible) {
      arenaStatus.x = Math.max(12, (w - arenaStatus.width) / 2);
      arenaStatus.y = 12;
    }
    if (flightLabStatus.visible) {
      flightLabStatus.x = Math.max(12, (w - flightLabStatus.width) / 2);
      flightLabStatus.y = 58;
    }
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
  function drawMissionObjective(text: string) {
    if (!missionObjective.visible) return;
    missionObjective.text = text;
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
  let firstSortieFiredOnce = false;
  let firstSortieWasStalling = false;
  let firstSortieRecoveredFromStall = false;
  let firstSortieUpgradeBriefingShown = false;
  const scriptedEnemyIds = new Set<number>();
  const missionOne = createMissionOneController();

  const dialogueOverlay = createDialogueOverlay(app.screen.width, app.screen.height);
  uiLayer.addChild(dialogueOverlay.container);

  const radioPopup = createRadioPopup(app.screen.width, app.screen.height);
  uiLayer.addChild(radioPopup.container);

  const startScreen = createStartScreen(app.screen.width, app.screen.height, (action) => {
    audio.unlock();
    audio.playUiSelect();
    if (action === 'flightLab') {
      startFlightLab();
      return;
    }
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
    audio.playUpgradePick();
    state = applyUpgrade(state, id as UpgradeId);
    levelUpScreen.hide();
    choicesShowing = false;
    updateArenaDirector();
  });
  uiLayer.addChild(levelUpScreen.container);

  let arenaShownStage = 0;
  let arenaRound = 1;
  let arenaRoundPhase: ArenaRoundPhase = 'takeoff';
  let arenaRoundStartScore = 0;
  let arenaDuelEnemyId: number | null = null;
  let arenaUpgradeDelaySec = 0;
  let arenaVictoryFlightSec = 0;

  function currentArenaStage() {
    return Math.min(ARENA_TOTAL_STAGES, Math.max(1, arenaRound));
  }

  function updateArenaStatusText() {
    if (runMode !== 'arena') {
      arenaStatus.visible = false;
      return;
    }
    const stage = currentArenaStage();
    const location = ARENA_LOCATION_THEMES[Math.max(0, stage - 1)] ?? ARENA_LOCATION_THEMES[0]!;
    const phaseText =
      arenaRoundPhase === 'takeoff' ? 'ВЗЛЕТ' :
      arenaRoundPhase === 'upgradeDelay' ? `ТРОФЕИ ${Math.max(0, 3 - arenaUpgradeDelaySec).toFixed(1)}С` :
      arenaRoundPhase === 'victoryFlight' ? `ЧИСТЫЙ ПОЛЕТ ${Math.max(0, 3 - arenaVictoryFlightSec).toFixed(1)}С` :
      arenaRoundPhase === 'upgrade' ? 'ДОРАБОТКА' :
      state.enemies.some(e => e.isBoss && e.alive) ? 'ШРАМ' :
      'БОЙ';
    arenaStatus.text = `РАУНД ${arenaRound}  ${phaseText}  ЧИКО ${state.playerScore} : ${state.enemyScore} ВРАГ  ${location.name}`;
    arenaStatus.x = Math.max(12, (app.screen.width - arenaStatus.width) / 2);
    arenaStatus.y = 12;
    arenaStatus.visible = true;
  }

  function setArenaStageTheme(stage: number) {
    const location = ARENA_LOCATION_THEMES[Math.max(0, Math.min(ARENA_LOCATION_THEMES.length - 1, stage - 1))]!;
    setSkyTheme(location.sky, location.background);
    arenaWeather.setPreset(location.weather);
    syncAtmosphereLayers();
  }

  function spawnArenaRoundEnemy() {
    if (runMode !== 'arena' || arenaRoundPhase !== 'takeoff') return;
    if (!state.player.alive || state.player.state !== 'flying') return;
    if (!shouldStartArenaDuelAfterTakeoff({
      playerY: state.player.kinematic.position.y,
      playerG: state.player.kinematic.g,
      playerState: state.player.state,
      worldHeight: ARENA_WORLD_HEIGHT,
    })) return;
    if (arenaDuelEnemyId !== null) return;

    arenaRoundPhase = 'duel';
    arenaRoundStartScore = state.playerScore;
    arenaUpgradeDelaySec = 0;
    arenaVictoryFlightSec = 0;
    state.disableAutoEnemySpawn = true;
    state.difficulty = arenaDifficultyForRound(arenaRound);
    const nextEnemyCount = arenaEnemyCountForRound(arenaRound);
    const finalBossReady = shouldSpawnArenaFinalBossForRound({
      playerScore: state.playerScore,
      finalBossScore: ARENA_FINAL_BOSS_SCORE,
      playerWinScore: PLAYER_SCORE_TO_WIN,
      roundEnemyCount: nextEnemyCount,
      bossAlreadySpawned: state.enemies.some(e => e.isBoss),
      gameOver: state.gameOver,
      pendingLevelUp: state.pendingLevelUp,
      choicesShowing,
    });
    const enemies = finalBossReady
      ? [makeArenaScarBoss(state.nextEntityId, state.player, arenaRound)]
      : Array.from({ length: nextEnemyCount }, (_, lane) =>
        makeArenaRoundEnemy(state.nextEntityId + lane, state.player, arenaRound, lane)
      );
    arenaDuelEnemyId = enemies[0]?.id ?? null;
    state.nextEntityId += enemies.length;
    state.enemies = enemies;
    state.pilots = state.pilots.filter(p => p.faction !== 'enemy');
    state.enemyAiStates.clear();
    state.prevEnemyHp.clear();
    screenFx.flash(0xffd27a, 0.24, 0.18);
  }

  function resetArenaPlayerForNextTakeoff() {
    arenaRoundPhase = 'takeoff';
    arenaRoundStartScore = state.playerScore;
    arenaDuelEnemyId = null;
    arenaUpgradeDelaySec = 0;
    arenaVictoryFlightSec = 0;
    state = {
      ...state,
      difficulty: arenaDifficultyForRound(arenaRound),
      disableAutoEnemySpawn: true,
      pendingLevelUp: false,
      gameOver: false,
      player: makeArenaRunwayPlayer(state.player),
      enemies: [],
      bullets: [],
      bombs: [],
      rockets: [],
      pilots: state.pilots.filter(p => p.faction !== 'enemy'),
      enemyAiStates: new Map(),
      prevEnemyHp: new Map(),
    };
    bullets.sync([]);
    bombSprites.sync([]);
    tracers.update(10);
    groundFx.clear();
    screenFx.disableDeathTint();
    screenFx.setVignette(0);
    setArenaStageTheme(currentArenaStage());
    const focus = resolveArenaCameraFocus({
      playerX: state.player.kinematic.position.x,
      playerY: state.player.kinematic.position.y,
      facing: state.player.kinematic.facing,
    });
    camera.setFocus(focus.x, focus.y, cameraZoom(focus.zoom));
    camera.snap();
  }

  function showArenaRoundUpgrade() {
    const rng = createRng((state.rngState ^ (arenaRound * 0x9e3779b9) ^ state.tickCount) >>> 0);
    const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
    arenaRoundPhase = 'upgrade';
    state = { ...state, pendingLevelUp: false };
    if (choices.length > 0) {
      choicesShowing = true;
      levelUpScreen.show(choices);
    } else {
      choicesShowing = false;
    }
  }

  function updateArenaDirector(elapsedSec = TICK_DT) {
    if (runMode !== 'arena') {
      arenaStatus.visible = false;
      return;
    }

    state = { ...state, disableAutoEnemySpawn: true, pendingLevelUp: false };

    const stage = currentArenaStage();
    if (stage !== arenaShownStage) {
      arenaShownStage = stage;
      setArenaStageTheme(stage);
      if (stage > 1) {
        screenFx.flash(0xffd27a, 0.28, 0.2);
      }
    }

    if (state.gameOver && state.player.alive && state.playerScore < PLAYER_SCORE_TO_WIN) {
      state = { ...state, gameOver: false };
    }

    spawnArenaRoundEnemy();

    const aliveEnemies = countUnresolvedArenaEnemies(state.enemies);
    const playerPilotActive = findPilot(state.pilots, 'player') !== undefined;
    if (
      arenaRoundPhase === 'upgradeDelay'
      && state.player.alive
      && state.player.state === 'flying'
      && aliveEnemies === 0
      && !playerPilotActive
    ) {
      arenaUpgradeDelaySec += elapsedSec;
    }
    if (
      arenaRoundPhase === 'victoryFlight'
      && state.player.alive
      && state.player.state === 'flying'
      && aliveEnemies === 0
      && !playerPilotActive
    ) {
      arenaVictoryFlightSec += elapsedSec;
    }
    const flow = resolveArenaDuelFlow({
      phase: arenaRoundPhase,
      round: arenaRound,
      previousScore: arenaRoundStartScore,
      currentScore: state.playerScore,
      enemyAliveCount: aliveEnemies,
      playerPilotActive,
      choicesShowing,
      gameOver: state.gameOver,
      upgradeDelaySec: arenaUpgradeDelaySec,
      requiredUpgradeDelaySec: 3,
      victoryFlightSec: arenaVictoryFlightSec,
      requiredVictoryFlightSec: 3,
    });

    if (flow.shouldStartVictoryFlight) {
      if (flow.phase === 'upgradeDelay') {
        arenaUpgradeDelaySec = 0;
      } else {
        arenaVictoryFlightSec = 0;
      }
      audio.playUpgradeOpen();
      screenFx.flash(0xb8f0ff, 0.18, 0.16);
    }

    arenaRoundPhase = flow.phase;
    arenaRound = flow.round;

    if (flow.shouldShowUpgrade) {
      showArenaRoundUpgrade();
    } else if (flow.shouldLaunchNextRound) {
      resetArenaPlayerForNextTakeoff();
    }

    updateArenaStatusText();
  }

  function openLevelUpChoices() {
    if (!state.pendingLevelUp || choicesShowing) return;
    const rng = createRng((state.rngState ^ (state.level * 0x9e3779b9) ^ state.tickCount) >>> 0);
    const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng);
    if (choices.length > 0) {
      if (shouldShowFirstUpgradeBriefing({
        runMode,
        pendingLevelUp: state.pendingLevelUp,
        choicesShowing,
        alreadyShown: firstSortieUpgradeBriefingShown,
      })) {
        firstSortieUpgradeBriefingShown = true;
        radioPopup.show({
          speaker: 'Мира',
          text: 'Первый трофей! Выбери доработку: сейчас начинается твой билд.',
        }, 3.2);
      }
      choicesShowing = true;
      audio.playUpgradeOpen();
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

  function mobileViewport() {
    return getMobileViewportInfo(app.screen.width, app.screen.height);
  }

  function cameraZoom(baseZoom: number) {
    return fitMobileZoom(baseZoom, mobileViewport());
  }

  function currentCommand(): PlayerCommand {
    const k = kb.current();
    const t = touch.current();
    return {
      rotate: (k.rotate || t.rotate) as -1 | 0 | 1,
      fire: k.fire || t.fire,
      bomb: k.bomb || t.bomb,
      boost: k.boost || t.boost,
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
    prevExplosionEventCount = state.explosionEvents.length;
    bullets.sync([]);
    bombSprites.sync([]);
    groundFx.clear();
    screenFx.setVignette(0);
    screenFx.disableDeathTint();
    levelUpScreen.hide();
    deathScreen.hide();
    radioPopup.hide();
    dialogueOverlay.hide();
    hud.hideEnemyArrows();
    arenaStatus.visible = false;
    flightLabStatus.visible = false;
    shownChicoFirstKillRadio = false;
    gunfeelLabShotWasActive = false;
  }

  function startArena() {
    runMode = 'arena';
    arenaShownStage = 0;
    arenaRound = Math.max(1, DEBUG_ARENA_SCORE + 1);
    arenaRoundPhase = 'takeoff';
    arenaRoundStartScore = DEBUG_ARENA_SCORE;
    arenaDuelEnemyId = null;
    arenaUpgradeDelaySec = 0;
    arenaVictoryFlightSec = 0;
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState(arenaDifficultyForRound(arenaRound) as Difficulty, makeArenaRunwayPlayer());
    state.worldWidth = ARENA_WORLD_WIDTH;
    state.worldHeight = ARENA_WORLD_HEIGHT;
    state.disableAutoEnemySpawn = true;
    if (DEBUG_ARENA_SCORE > 0) {
      state = {
        ...state,
        playerScore: DEBUG_ARENA_SCORE,
        xpCollected: DEBUG_ARENA_SCORE * 5,
        level: Math.min(PLAYER_SCORE_TO_WIN, DEBUG_ARENA_SCORE + 1),
        pendingLevelUp: false,
      };
    }
    setArenaStageTheme(currentArenaStage());
    syncAtmosphereLayers();
    camera.setWorldSize(ARENA_WORLD_WIDTH, ARENA_WORLD_HEIGHT);
    layoutWorld();
    {
      const focus = resolveArenaCameraFocus({
        playerX: state.player.kinematic.position.x,
        playerY: state.player.kinematic.position.y,
        facing: state.player.kinematic.facing,
      });
      camera.setFocus(focus.x, focus.y, cameraZoom(focus.zoom));
    }
    camera.snap();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = true;
    hud.container.visible = true;
    hud.hideEnemyArrows();
    debugText.visible = false;
    updateArenaDirector();
    gameRunning = true;
  }

  function startSkyTest() {
    runMode = 'skytest';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('hard' as Difficulty, makeSkyTestPlayer());
    state.worldWidth = SKY_TEST_WORLD_WIDTH;
    state.worldHeight = SKY_TEST_WORLD_HEIGHT;
    state.softFloor = true;
    state.disableAutoEnemySpawn = true;
    state.enemies = [makeSkyTestBoss(state.nextEntityId)];
    state.nextEntityId += 1;
    state.appliedUpgradeIds = ['damage_plus_25', 'fire_rate_plus_25'];
    state.damageMultiplier = 1.25;
    state.fireRateMultiplier = 1.25;
    setSkyTheme('noon');
    syncAtmosphereLayers();
    camera.setWorldSize(SKY_TEST_WORLD_WIDTH, SKY_TEST_WORLD_HEIGHT);
    layoutWorld();
    camera.setFocus(state.player.kinematic.position.x + 220, state.player.kinematic.position.y - 60, cameraZoom(1.0));
    camera.snap();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = false;
    hud.container.visible = true;
    hud.hideEnemyArrows();
    debugText.visible = false;
    gameRunning = true;
  }

  function startGunfeelLab() {
    runMode = 'gunfeelLab';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('hard' as Difficulty, makeGunfeelLabPlayer());
    state.worldWidth = SKY_TEST_WORLD_WIDTH;
    state.worldHeight = SKY_TEST_WORLD_HEIGHT;
    state.softFloor = true;
    state.disableAutoEnemySpawn = true;
    state.enemies = [];
    state.bullets = [];
    state.appliedUpgradeIds = ['damage_plus_25', 'fire_rate_plus_25'];
    state.damageMultiplier = 1.25;
    state.fireRateMultiplier = 1.25;
    setSkyTheme('noon');
    syncAtmosphereLayers();
    camera.setWorldSize(SKY_TEST_WORLD_WIDTH, SKY_TEST_WORLD_HEIGHT);
    layoutWorld();
    camera.setFocus(state.player.kinematic.position.x + 260, state.player.kinematic.position.y - 50, cameraZoom(1.08));
    camera.snap();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = false;
    hud.container.visible = false;
    hud.hideEnemyArrows();
    debugText.visible = false;
    gameRunning = true;
  }

  function startFlightLab() {
    runMode = 'flightLab';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('easy' as Difficulty, makeFlightLabPlayer());
    state.worldWidth = SKY_TEST_WORLD_WIDTH;
    state.worldHeight = SKY_TEST_WORLD_HEIGHT;
    state.softFloor = true;
    state.disableAutoEnemySpawn = true;
    state.enemies = [];
    state.bullets = [];
    state.appliedUpgradeIds = ['damage_plus_25'];
    state.damageMultiplier = 1.25;
    state.fireRateMultiplier = 1;
    flightLabRecoveredFromStall = false;
    flightLabWasStalling = false;
    flightLabFiredAfterRecovery = false;
    setSkyTheme('noon');
    syncAtmosphereLayers();
    camera.setWorldSize(SKY_TEST_WORLD_WIDTH, SKY_TEST_WORLD_HEIGHT);
    layoutWorld();
    camera.setFocus(state.player.kinematic.position.x + 220, state.player.kinematic.position.y - 60, cameraZoom(1.0));
    camera.snap();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = false;
    hud.container.visible = true;
    hud.hideEnemyArrows();
    flightLabStatus.visible = true;
    debugText.visible = false;
    gameRunning = true;
  }

  function startOilShot() {
    runMode = 'oilshot';
    storyCompleted = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('hard' as Difficulty, makeGunfeelLabPlayer());
    state.worldWidth = SKY_TEST_WORLD_WIDTH;
    state.worldHeight = SKY_TEST_WORLD_HEIGHT;
    state.softFloor = true;
    state.disableAutoEnemySpawn = true;
    state.enemies = [];
    state.bullets = [];
    state.player.hp = state.player.maxHp * 0.38;
    state.appliedUpgradeIds = ['damage_plus_25', 'fire_rate_plus_25'];
    state.damageMultiplier = 1.25;
    state.fireRateMultiplier = 1.25;
    setSkyTheme('noon');
    syncAtmosphereLayers();
    camera.setWorldSize(SKY_TEST_WORLD_WIDTH, SKY_TEST_WORLD_HEIGHT);
    layoutWorld();
    camera.setFocus(state.player.kinematic.position.x + 260, state.player.kinematic.position.y - 50, cameraZoom(1.08));
    camera.snap();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = false;
    hud.container.visible = false;
    hud.hideEnemyArrows();
    debugText.visible = false;
    gameRunning = true;
    screenFx.triggerHitGlitch();
    screenFx.triggerOilSplatter();
    screenFx.triggerOilSplatter();
    screenFx.flash(0x2b1208, 0.16, 0.28);
  }

  function startStoryMissionOne() {
    runMode = 'story';
    storyCompleted = false;
    firstSortieFiredOnce = false;
    firstSortieWasStalling = false;
    firstSortieRecoveredFromStall = false;
    firstSortieUpgradeBriefingShown = false;
    scriptedEnemyIds.clear();
    missionOne.reset();
    storyScene.reset();
    resetRunState('medium' as Difficulty, makeCarrierLaunchPlayer());

    // Setup scrolling world width and scaling
    state.worldWidth = MISSION_ONE_WORLD_WIDTH;
    // Campaign has no lethal ground — the bottom turns the plane back like the ceiling.
    state.softFloor = true;
    camera.setWorldSize(MISSION_ONE_WORLD_WIDTH, WORLD_HEIGHT);
    layoutWorld();
    // Start the camera already framed close on the carrier launch (no zoom-in pop).
    camera.setFocus(state.player.kinematic.position.x + 90, WORLD_HEIGHT * 0.52, mobileViewport().storyZoom);
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
    syncAtmosphereLayers();
    startScreen.hide();
    menuBackdrop.hide();
    worldLayer.visible = true;
    arenaWeather.container.visible = false;
    hud.container.visible = true;
    caravanGauge.visible = true;
    missionObjective.visible = true;
    drawCaravanGauge(1);
    drawMissionObjective(resolveFirstSortieGuidance({
      phase: missionOne.phase,
      timeSec: missionOne.timeSec,
      playerStalling: false,
      recoveredFromStall: false,
      firedOnce: false,
      playerScore: state.playerScore,
      pendingLevelUp: state.pendingLevelUp,
      choicesShowing,
      boostActive: state.player.boostActive ?? false,
      boostHeat: state.player.boostHeat ?? 0,
      noThrottleSec: state.player.noThrottleSec ?? 0,
    }));
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
  let prevExplosionEventCount = state.explosionEvents.length;
  let gunfeelLabShotWasActive = false;
  let flightLabWasStalling = false;
  let flightLabRecoveredFromStall = false;
  let flightLabFiredAfterRecovery = false;
  let lastPublishedDebugState = '';
  let arenaThunderTimer = 3.5;
  function publishDebugState() {
    if (!DEBUG_HUD_ON_BOOT) return;
    const arenaStage = runMode === 'arena' ? currentArenaStage() : 0;
    const arenaLocation = runMode === 'arena'
      ? ARENA_LOCATION_THEMES[Math.max(0, arenaStage - 1)] ?? ARENA_LOCATION_THEMES[0]!
      : null;
    const snapshot = {
      runMode,
      gameRunning,
      playerScore: state.playerScore,
      level: state.level,
      pendingLevelUp: state.pendingLevelUp,
      gameOver: state.gameOver,
      enemyCount: state.enemies.filter(e => e.alive && e.state !== 'crashed').length,
      arenaRound,
      arenaRoundPhase,
      arenaDuelEnemyId,
      arenaStage,
      arenaLocationName: arenaLocation?.name ?? null,
      arenaWeather: arenaLocation?.weather ?? null,
    };
    (globalThis as unknown as { __biplanesDebugState?: unknown }).__biplanesDebugState = snapshot;
    const serialized = JSON.stringify(snapshot);
    if (serialized !== lastPublishedDebugState) {
      lastPublishedDebugState = serialized;
      console.log(`[biplanes-debug] ${serialized}`);
    }
  }

  app.ticker.add((ticker) => {
    const realDt = ticker.deltaMS / 1000;
    const dt = clock.tick(realDt);
    renderTimeSec += dt;

    lightning.update(dt);
    const cloudFocusX = runMode === 'story' ? camera.currentFocusX : state.player.kinematic.position.x;
    if (bgClouds.container.visible) bgClouds.update(dt, cloudFocusX);
    if (fgClouds.container.visible) fgClouds.update(dt, cloudFocusX);
    if (cloudSea.container.visible) {
      cloudSea.update(dt, cloudFocusX);
    }
    if ((runMode === 'skytest' || runMode === 'arena' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot') && skytestCloudVolume.backContainer.visible) {
      const cloudPlanes: CloudVolumePlane[] = [
        {
          x: state.player.kinematic.position.x,
          y: state.player.kinematic.position.y,
          vx: state.player.kinematic.velocity.x,
          vy: state.player.kinematic.velocity.y,
          active: state.player.alive,
        },
        ...state.enemies.map((enemy) => ({
          x: enemy.kinematic.position.x,
          y: enemy.kinematic.position.y,
          vx: enemy.kinematic.velocity.x,
          vy: enemy.kinematic.velocity.y,
          active: enemy.alive && enemy.state !== 'crashed',
        })),
      ];
      skytestCloudVolume.update(
        dt,
        renderTimeSec,
        state.player.kinematic.position.x,
        state.player.kinematic.position.y,
        cloudPlanes,
      );
    }
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
    touchGuide.setActive(runMode !== 'skytest' && runMode !== 'gunfeelLab' && runMode !== 'oilshot' && gameRunning && !choicesShowing && !state.gameOver);
    publishDebugState();

    if (!gameRunning) {
      audio.updateFlight(dt, state, false, choicesShowing);
      return;
    }
    if (runMode === 'arena') {
      const location = ARENA_LOCATION_THEMES[Math.max(0, currentArenaStage() - 1)] ?? ARENA_LOCATION_THEMES[0]!;
      if (location.weather === 'thunder' || location.weather === 'storm') {
        arenaThunderTimer -= dt;
        if (arenaThunderTimer <= 0) {
          audio.playThunder();
          if (location.weather === 'thunder') {
            screenFx.flash(0xdceeff, 0.12, 0.16);
          }
          arenaThunderTimer = 4.5 + Math.random() * 8.5;
        }
      } else {
        arenaThunderTimer = 3.5;
      }
    }
    const frameGate = runMode === 'arena'
      ? (choicesShowing ? 'pause' : 'tick')
      : resolveMissionOneFrameGate({
        choicesShowing,
        pendingLevelUp: state.pendingLevelUp,
      });
    if (frameGate === 'open-upgrade') {
      openLevelUpChoices();
      audio.updateFlight(dt, state, gameRunning, true);
      return;
    }
    if (frameGate === 'pause') {
      audio.updateFlight(dt, state, gameRunning, choicesShowing);
      return;
    }
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

    if (runMode === 'story') {
      const stallingNow = isStalling(state.player.kinematic);
      if (inputCmd.fire) {
        firstSortieFiredOnce = true;
      }
      if (stallingNow) {
        firstSortieWasStalling = true;
      }
      if (firstSortieWasStalling && !stallingNow && state.player.kinematic.g > G_MAX_LEVEL * 0.62) {
        firstSortieRecoveredFromStall = true;
      }
      drawMissionObjective(resolveFirstSortieGuidance({
        phase: missionOne.phase,
        timeSec: missionOne.timeSec,
        playerStalling: stallingNow,
        recoveredFromStall: firstSortieRecoveredFromStall,
        firedOnce: firstSortieFiredOnce,
        playerScore: state.playerScore,
        pendingLevelUp: state.pendingLevelUp,
        choicesShowing,
        boostActive: state.player.boostActive ?? false,
        boostHeat: state.player.boostHeat ?? 0,
        noThrottleSec: state.player.noThrottleSec ?? 0,
      }));
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
      drawMissionObjective(resolveFirstSortieGuidance({
        phase: missionOne.phase,
        timeSec: missionOne.timeSec,
        playerStalling: isStalling(state.player.kinematic),
        recoveredFromStall: firstSortieRecoveredFromStall,
        firedOnce: firstSortieFiredOnce,
        playerScore: state.playerScore,
        pendingLevelUp: state.pendingLevelUp,
        choicesShowing,
        boostActive: state.player.boostActive ?? false,
        boostHeat: state.player.boostHeat ?? 0,
        noThrottleSec: state.player.noThrottleSec ?? 0,
      }));

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
        camera.setFocus(px + 90, WORLD_HEIGHT * 0.52, mobileViewport().storyZoom);
      } else if (tSec < 8.0) {
        // Launch → escort transition: ease zoom back to cover while panning to player.
        const u = (tSec - 2.5) / 5.5;
        const cx = state.caravan ? state.caravan.position.x : px;
        const cy = state.caravan ? state.caravan.position.y : py;
        const midX = (px + cx) / 2;
        const midY = (py + cy) / 2;
        const fx = px + (midX - px) * u;
        const fy = WORLD_HEIGHT * 0.52 + (midY - WORLD_HEIGHT * 0.52) * u;
        const zoom = Math.max(cameraZoom(1.0), mobileViewport().storyZoom - u * 0.5);
        camera.setFocus(fx, fy, zoom);
      } else if (tSec >= 246 && tSec < 249) {
        // Boss entrance — frame Scar and the player together.
        const boss = state.enemies.find(e => e.id === missionOne.bossId);
        const bx = boss ? boss.kinematic.position.x : 10000;
        const by = boss ? boss.kinematic.position.y : WORLD_HEIGHT * 0.24;
        camera.setFocus((bx + px) * 0.5, (by + py) * 0.5, cameraZoom(1.18));
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
        camera.setFocus(focus.x, focus.y, cameraZoom(focus.zoom));
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
        audio.playDefeat();
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_FAILURE_CARAVAN_LINES, resetToMenu);
      } else if (missionOutcome === 'pilot-lost' && !dialogueOverlay.container.visible) {
        storyCompleted = true;
        gameRunning = false;
        audio.playDefeat();
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_FAILURE_PILOT_LINES, resetToMenu);
      }

      if (missionOutcome === 'victory' && !dialogueOverlay.container.visible) {
        missionOne.markVictory();
        storyCompleted = true;
        gameRunning = false;
        audio.playVictory();
        screenFx.flash(0xffe2a2, 0.55, 0.35);
        radioPopup.hide();
        camera.resetFocus();
        dialogueOverlay.show(STORY_VICTORY_LINES, resetToMenu);
      }
    } else {
      storyScene.update(dt, renderTimeSec, false, 0, 1, 'briefing', 0, false);
    }

    if (runMode === 'arena') {
      const boss = state.enemies.find(e => e.isBoss && e.alive && e.state !== 'crashed');
      if (boss && boss.alive && boss.state !== 'crashed') {
        bossMarker.visible = true;
        bossMarker.x = boss.kinematic.position.x;
        bossMarker.y = boss.kinematic.position.y - 70 + Math.sin(renderTimeSec * 4) * 3;
      } else {
        bossMarker.visible = false;
      }
    } else if (runMode !== 'story') {
      bossMarker.visible = false;
    }

    // Plane-vs-plane collision VFX (Phase 5).
    // Only react when a NEW game tick has produced new events. Without this guard,
    // render frames during slow-mo / hit-pause re-read the same events buffer and
    // re-trigger shake + hit-pause every frame — the screen "shakes forever".
    if (state.tickCount !== prevTickCount) {
      if (state.explosionEvents.length > prevExplosionEventCount) {
        for (const pos of state.explosionEvents.slice(prevExplosionEventCount)) {
          damageFx.addExplosion(pos);
          damageFx.addShockwave(pos);
          audio.playExplosion();
          camera.shake(runMode === 'arena' ? 16 : 12);
          camera.zoomPunch(1.025, 0.18);
          screenFx.flash(0xffb35c, 0.24, 0.18);
        }
        prevExplosionEventCount = state.explosionEvents.length;
      }
      for (const ev of state.planeCollisionEvents) {
        damageFx.addSparks({ x: ev.posX, y: ev.posY }, 36);
        damageFx.addImpactFlash({ x: ev.posX, y: ev.posY });
        const anyDied = ev.aDied || ev.bDied;
        audio.playImpact(anyDied);
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

    if (runMode === 'arena') {
      updateArenaDirector(realDt);
    } else {
      openLevelUpChoices();
      updateArenaDirector();
    }

    if (runMode === 'arena') {
      const playerPilot = findPilot(state.pilots, 'player');
      const focus = resolveArenaCameraFocus({
        playerX: playerPilot?.position.x ?? state.player.kinematic.position.x,
        playerY: playerPilot?.position.y ?? state.player.kinematic.position.y,
        facing: playerPilot?.facing ?? state.player.kinematic.facing,
      });
      camera.setFocus(focus.x, focus.y, cameraZoom(focus.zoom));
    } else if (runMode === 'skytest' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot') {
      camera.setFocus(
        state.player.kinematic.position.x + state.player.kinematic.facing * 220,
        state.player.kinematic.position.y - 60,
        cameraZoom(1.0)
      );
    }

    if (runMode === 'flightLab') {
      const stallingNow = isStalling(state.player.kinematic);
      if (stallingNow) {
        flightLabWasStalling = true;
      }
      if (flightLabWasStalling && !stallingNow && state.player.kinematic.g > G_MAX_LEVEL * 0.62) {
        flightLabRecoveredFromStall = true;
      }
      if (flightLabRecoveredFromStall && inputCmd.fire) {
        flightLabFiredAfterRecovery = true;
      }
      flightLabStatus.text = resolveFlightLabCue({
        planeState: state.player.state,
        throttleLevel: state.player.kinematic.throttleLevel,
        speed: state.player.kinematic.g,
        isStalling: stallingNow,
        recoveredFromStall: flightLabRecoveredFromStall,
        firedAfterRecovery: flightLabFiredAfterRecovery,
      });
      flightLabStatus.x = Math.max(12, (app.screen.width - flightLabStatus.width) / 2);
      flightLabStatus.y = 58;
      flightLabStatus.visible = true;
    } else {
      flightLabStatus.visible = false;
    }

    if (state.gameOver && !deathScreen.container.visible) {
      audio.playDefeat();
      deathScreen.show(state);
    }

    if (state.playerScore > prevPlayerScore) {
      screenFx.flash(0xffffff, 0.25, 0.12);
    }
    if (state.level > prevLevel) {
      screenFx.flash(0xffc24a, 0.4, 0.22);
    }
    const playerPilotActive = findPilot(state.pilots, 'player') !== undefined;
    if (prevPlayerAlive && !state.player.alive && !playerPilotActive) {
      audio.playExplosion();
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
    prevExplosionEventCount = state.explosionEvents.length;

    const hpFrac = state.player.hp / state.player.maxHp;
    const vignette = hpFrac <= LOW_HP_VIGNETTE_THRESHOLD
      ? 1 - (hpFrac / LOW_HP_VIGNETTE_THRESHOLD)
      : 0;
    screenFx.setVignette(vignette * 0.6);

    if (runMode === 'gunfeelLab') {
      const labShot = getGunfeelLabShotAt(renderTimeSec);
      if (labShot.fire && !gunfeelLabShotWasActive) {
        const heading = state.player.kinematic.heading;
        const noseX = state.player.kinematic.position.x + Math.cos(heading) * 34;
        const noseY = state.player.kinematic.position.y + Math.sin(heading) * 34;
        emitGunfeelShotVfx(noseX, noseY, heading, 'player', labShot.heavy);
        if (labShot.heavy) {
          damageFx.addShockwave({ x: noseX + Math.cos(heading) * 24, y: noseY + Math.sin(heading) * 24 });
        }
      }
      gunfeelLabShotWasActive = labShot.fire;
    }

    const seenBulletIds = new Set<number>();
    for (const b of state.bullets) {
      seenBulletIds.add(b.id);
      if (!prevBulletIds.has(b.id)) {
        const heading = Math.atan2(b.velocity.y, b.velocity.x);
        emitGunfeelShotVfx(b.position.x, b.position.y, heading, b.ownerFaction, b.isHeavy);
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

    // Off-screen arrows for enemy planes outside the viewport.
    {
      const offscreenEnemies = state.enemies
        .filter(e => e.alive && e.state !== 'crashed')
        .map(e => {
          const sx = worldLayer.x + e.kinematic.position.x * worldLayer.scale.x;
          const sy = worldLayer.y + e.kinematic.position.y * worldLayer.scale.y;
          return { x: sx, y: sy };
        })
        .filter(p => p.x < 0 || p.x > app.screen.width || p.y < 0 || p.y > app.screen.height);
      hud.showEnemyArrows(offscreenEnemies);
    }

    bullets.sync(state.bullets);
    bombSprites.sync(state.bombs);
    for (const b of state.bullets) {
      const heading = Math.atan2(b.velocity.y, b.velocity.x);
      const shotFeel = resolveGunfeelShot({
        ownerFaction: b.ownerFaction,
        headingRad: heading,
        isHeavy: b.isHeavy,
      });
      tracers.emit(b, {
        scale: shotFeel.tracerScale,
        duration: shotFeel.tracerDuration,
      });
    }
    tracers.update(dt);
    damageFx.update(dt);
    groundFx.update(dt, (x, y) => damageFx.addSmokeTrail({ x, y }, 1));
    muzzleFlashes.update(dt);
    screenFx.update(dt, renderTimeSec, worldLayer);
    arenaWeather.update(dt, renderTimeSec);
    hud.update(state);
    audio.updateFlight(dt, state, gameRunning, choicesShowing);
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
        debugText.text = `${runMode.toUpperCase()}  t=${state.timeSec.toFixed(1)}  enemies=${state.enemies.length}  hp=${state.player.hp.toFixed(0)}  score=${state.playerScore}`;
      }
    }

    publishDebugState();
  });

  function resetToMenu() {
    runMode = 'menu';
    arenaRound = 1;
    arenaRoundPhase = 'takeoff';
    arenaRoundStartScore = 0;
    arenaDuelEnemyId = null;
    arenaUpgradeDelaySec = 0;
    arenaVictoryFlightSec = 0;
    storyCompleted = false;
    firstSortieFiredOnce = false;
    firstSortieWasStalling = false;
    firstSortieRecoveredFromStall = false;
    firstSortieUpgradeBriefingShown = false;
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
    bombSprites.sync([]);
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
    arenaWeather.container.visible = false;
    hud.container.visible = false;
    hud.hideEnemyArrows();
    flightLabStatus.visible = false;
    caravanGauge.visible = false;
    missionObjective.visible = false;
    menuBackdrop.show();
    startScreen.show();
    shownChicoFirstKillRadio = false;
    camera.resetFocus();
    camera.setWorldSize(WORLD_WIDTH, WORLD_HEIGHT);
    layoutWorld();
    rollSkyTheme(); // Roll a new gorgeous environment style for the next run
    syncAtmosphereLayers();
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
  if (AUTO_OIL_SHOT) {
    requestAnimationFrame(() => startOilShot());
  } else if (AUTO_FLIGHT_LAB) {
    requestAnimationFrame(() => startFlightLab());
  } else if (AUTO_GUNFEEL_LAB) {
    requestAnimationFrame(() => startGunfeelLab());
  } else if (AUTO_SKY_TEST) {
    requestAnimationFrame(() => startSkyTest());
  } else if (AUTO_STORY) {
    requestAnimationFrame(() => startStoryMissionOne());
  } else if (AUTO_ARENA) {
    requestAnimationFrame(() => startArena());
  }

  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    layoutWorld();
    camera.setScreen(w, h);
    hud.resize(w, h);
    arenaWeather.resize(w, h);
    screenFx.resize(w, h);
    touch.updateZones(w, h);
    touchGuide.layout(w, h);
    startScreen.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
    dialogueOverlay.resize(w, h);
    radioPopup.resize(w, h);
    layoutCaravanGauge(w, h);
  };
  window.addEventListener('resize', onResize);
}
