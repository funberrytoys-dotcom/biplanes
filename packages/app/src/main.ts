import { Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
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
  SALVO_COOLDOWN,
  MAG_SIZE,
  JACKAL_MAG_SIZE,
  JACKAL_RELOAD_SEC,
  JACKAL_BOOST_HEAT_MULT,
  RELOAD_SEC,
  GROUND_Y,
  SUPPLY_BALLOON_HP,
  SUPPLY_BALLOON_DRIFT,
  type PlayerCommand,
} from '@biplanes/shared';
import {
  createWorldState, tick,
  applyUpgrade,
  createRng,
  rollUpgradeChoices,
  ARENA_FINAL_BOSS_SCORE,
  wingRocketCapacity,
  type WorldState,
  type Plane,
  type Difficulty,
  type UpgradeId,
  type SupplyBalloon,
  isStalling,
  findPilot,
  // === «Забег» run engine (Plan 1) ===
  createRunState,
  recordPick,
  recordReroll,
  recordSkip,
  rollRunPickChoices,
  factionUpgradePool,
  buildRunSummary,
  isBossWave,
  runEnemyCountForWave,
  runEnemyHpMultiplierForWave,
  RUN_WAVE_COUNT,
  type RunState,
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
  RocketPool,
  SupplyPool,
  PickupPool,
  SupplyFx,
  createCamera,
  createHud,
  createRenderClock,
  createGlowLayer,
  DamageFx,
  MuzzleFlashes,
  BulletTracers,
  FloatingNumbers,
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
import { createRunSummaryScreen } from './screens/run-summary-screen.js';
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
import { ARENA_BACKGROUND_URLS, ARENA_LOCATION_THEMES, weatherGameplay, type WeatherGameplay, type WeatherIcon } from './arena-locations.js';
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

// One combined, compressed file (video + its own audio track) — the old split
// mp4+mp3 drifted out of sync and the 7.5 MB video loaded slowly (often blank).
const MENU_VIDEO_URL = assetUrl('assets/menu/intro2av.mp4');
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

const HUD_ICON_URLS = {
  fire: assetUrl('assets/biplanes/hud/icons/icon_fire.png'),
  salvo: assetUrl('assets/biplanes/hud/icons/icon_salvo.png'),
  boost: assetUrl('assets/biplanes/hud/icons/icon_boost.png'),
  eject: assetUrl('assets/biplanes/hud/icons/icon_eject.png'),
};

// Soft cloud sprites for the drifting screen-space sky strata (Path B).
const SKY_CLOUD_URLS = [
  assetUrl('assets/biplanes/arena/day/clouds/cloud_cumulus_01.png'),
  assetUrl('assets/biplanes/arena/day/clouds/cloud_cumulus_02.png'),
  assetUrl('assets/biplanes/arena/day/clouds/cloud_cumulus_03.png'),
  assetUrl('assets/biplanes/arena/day/clouds/cloud_cumulus_04.png'),
  assetUrl('assets/biplanes/arena/day/clouds/cloud_cumulus_05.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_01.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_03.png'),
  assetUrl('assets/biplanes/arena/day/cirrus/cloud_cirrus_05.png'),
];

const VISUAL_ASSET_URLS = [
  SKY_TEST_IMAGE_URL,
  ...Object.values(ARENA_BACKGROUND_URLS),
  ...Object.values(HUD_ICON_URLS),
  ...SKY_CLOUD_URLS,
  ...SKY_TEST_LAYER_ASSET_URLS,
  assetUrl('assets/biplanes/sky_noon.jpg'),
  assetUrl('assets/biplanes/sky_sunset.jpg'),
  assetUrl('assets/biplanes/sky_twilight.jpg'),
  assetUrl('assets/biplanes/sky_night.jpg'),
  assetUrl('assets/biplanes/plane_chico_blue.png'),
  assetUrl('assets/biplanes/supply_balloon_chest.png'),
  assetUrl('assets/biplanes/supply_balloon_chest_red.png'),
  assetUrl('assets/biplanes/hud/lever_knob.png'),
  assetUrl('assets/hud/throttle_jackal.png'),
  // «Забег» branch emblems (shown on the run-summary screen).
  assetUrl('assets/run/emblem_assault.png'),
  assetUrl('assets/run/emblem_bombardier.png'),
  assetUrl('assets/run/emblem_commander.png'),
  assetUrl('assets/run/emblem_hull.png'),
  // Pixi v8 Sprite.from(url) only renders PRELOADED textures — the throttle-lever
  // handle and the gauge needle must be loaded here or they show up invisible.
  assetUrl('assets/biplanes/hud/lever_knob.png'),
  assetUrl('assets/biplanes/hud/needle.png'),
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
  // Must start muted — muted autoplay is the only kind browsers allow before a
  // gesture. The audio now lives IN this file, so it can never drift from the video.
  video.muted = true;
  video.volume = 0.45;
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

  let musicEnabled = (() => {
    try { return localStorage.getItem('biplanes.music') !== 'off'; } catch { return true; }
  })();
  // The app boots into the menu, so the backdrop starts "visible". A game start
  // (menuBackdrop.hide()) flips this off; returning to the menu (show()) flips it on.
  let menuVisible = true;
  let gestured = false; // a user gesture has happened → unmuting is allowed

  const persistMusic = () => {
    try { localStorage.setItem('biplanes.music', musicEnabled ? 'on' : 'off'); } catch { /* ignore */ }
  };
  // Sound = the video's own track. We just (un)mute it; it's always in sync.
  const applyAudioState = () => {
    video.muted = !(musicEnabled && menuVisible && gestured);
  };
  const applyMusicEnabled = (on: boolean) => {
    musicEnabled = on;
    persistMusic();
    applyAudioState();
  };

  const onGesture = () => {
    gestured = true;
    applyAudioState();
    if (menuVisible) void video.play().catch(() => undefined);
  };
  for (const ev of ['pointerdown', 'touchstart', 'click', 'keydown']) {
    window.addEventListener(ev, onGesture, { passive: true });
  }

  return {
    show() {
      menuVisible = true;
      video.style.display = 'block';
      applyAudioState();
      void video.play().catch(() => undefined);
    },
    hide() {
      // Entering a game session: stop the menu video (its audio stops with it).
      menuVisible = false;
      video.style.display = 'none';
      video.pause();
      applyAudioState();
    },
    isMusicEnabled() { return musicEnabled; },
    setMusicEnabled(on: boolean) { applyMusicEnabled(on); },
    toggleMusic() { applyMusicEnabled(!musicEnabled); return musicEnabled; },
  };
}

function createTouchGuide(touch: ReturnType<typeof createTouchController>) {
  const c = new Container();
  const rings = {
    stick: new Graphics(),
    stickKnob: new Graphics(),
    fire: new Graphics(),
    special: new Graphics(),
    specialArc: new Graphics(),
    boost: new Graphics(),
    eject: new Graphics(),
    throttleTrack: new Graphics(),
    throttleFill: new Graphics(),
    throttleKnob: new Graphics(),
  };
  const labelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    fill: 0xffffff,
    stroke: { color: 0x000000, width: 3 },
  });
  const labels = {
    throttle: new Text({ text: 'ГАЗ', style: labelStyle }),
  };
  // Art-based dieselpunk glyphs (chroma-keyed PNGs) on the action buttons.
  const icons = {
    fire: Sprite.from(HUD_ICON_URLS.fire),
    special: Sprite.from(HUD_ICON_URLS.salvo),
    boost: Sprite.from(HUD_ICON_URLS.boost),
    eject: Sprite.from(HUD_ICON_URLS.eject),
  };
  for (const sp of Object.values(icons)) sp.anchor.set(0.5);
  // Dieselpunk throttle handle art (slides along the lever track).
  const leverKnob = Sprite.from(assetUrl('assets/biplanes/hud/lever_knob.png'));
  leverKnob.anchor.set(0.5, 0.5);
  c.addChild(
    rings.throttleTrack, rings.throttleFill, rings.throttleKnob, leverKnob,
    rings.stick, rings.stickKnob, rings.fire, rings.special, rings.specialArc, rings.boost, rings.eject,
    icons.fire, icons.special, icons.boost, icons.eject, labels.throttle
  );
  let active = false;
  let touchLikely = false;

  function placeIcon(sp: Sprite, zone: { x: number; y: number; r: number }, frac: number) {
    sp.x = zone.x;
    sp.y = zone.y;
    sp.width = sp.height = zone.r * frac;
  }

  function drawIcons() {
    const z = touch.zones;
    // ~20% smaller than before, sized uniformly across the 2x2 grid
    // (frac compensates for each button's differing hit radius).
    placeIcon(icons.fire, z.fire, 1.36);
    placeIcon(icons.special, z.special, 1.6);
    placeIcon(icons.boost, z.boost, 1.6);
    placeIcon(icons.eject, z.eject, 1.78);
    for (const sp of Object.values(icons)) sp.alpha = ICON_IDLE_ALPHA;
  }

  function drawRing(g: Graphics, x: number, y: number, r: number, color: number, activeRing = false, dim = false) {
    const baseAlpha = dim ? 0.05 : 0.12;
    g.clear()
      .circle(x, y, r)
      .fill({ color, alpha: activeRing ? 0.3 : baseAlpha })
      .stroke({ color, width: activeRing ? 4 : 2.5, alpha: dim ? 0.28 : (activeRing ? 0.95 : 0.6) })
      .circle(x, y, r * 0.58)
      .stroke({ color: 0xffffff, width: activeRing ? 2 : 1.4, alpha: activeRing ? 0.55 : 0.22 });
  }

  function drawStick(base: Graphics, x: number, y: number, r: number, mul: number) {
    base.clear()
      .circle(x, y, r)
      .fill({ color: 0x1fb7ff, alpha: 0.08 * mul })
      .stroke({ color: 0x57ddff, width: 3, alpha: 0.52 * mul })
      .circle(x, y, r * 0.72)
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.18 * mul })
      .moveTo(x, y - r * 0.62).lineTo(x, y + r * 0.62)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.18 * mul })
      .moveTo(x - r * 0.62, y).lineTo(x + r * 0.62, y)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.12 * mul });
  }

  function drawLever(value: number) {
    const s = touch.zones.throttle;
    const left = s.x - s.w / 2;
    const span = s.yBottom - s.yTop;
    const fillTopY = s.yBottom - value * span;
    const gasColor = value > 0.66 ? 0x7cff8f : value > 0.33 ? 0xffd34a : 0xff8c5a;
    rings.throttleTrack.clear()
      .roundRect(left, s.yTop, s.w, span, s.w / 2)
      .fill({ color: 0x081523, alpha: 0.5 })
      .stroke({ color: 0x57ddff, width: 2.5, alpha: 0.5 });
    rings.throttleFill.clear()
      .roundRect(left + 3, fillTopY, s.w - 6, s.yBottom - fillTopY, Math.max(2, (s.w - 6) / 2))
      .fill({ color: gasColor, alpha: 0.42 });
    rings.throttleKnob.clear();
    // Art knob slides along the track to the current throttle position. Uses the texture's
    // own aspect so the С.О.В. brass handle AND the Jackal skull grip both sit right.
    const knobW = s.w * 2.6;
    const tex = leverKnob.texture;
    const aspect = tex && tex.height > 2 ? tex.height / tex.width : 667 / 718;
    leverKnob.width = knobW;
    leverKnob.height = knobW * aspect;
    leverKnob.x = s.x;
    leverKnob.y = fillTopY;
  }

  function updateStickKnob() {
    if (!touchLikely) return;
    const z = touch.zones.joystick;
    if (touch.joystickActive()) {
      // Floating stick: base snaps to where the thumb landed, knob follows.
      const o = touch.joystickOrigin();
      const p = touch.joystickKnob();
      drawStick(rings.stick, o.x, o.y, z.r, 1);
      rings.stickKnob.clear()
        .circle(p.x, p.y, z.r * 0.34)
        .fill({ color: 0x9fe8ff, alpha: 0.4 })
        .stroke({ color: 0xffffff, width: 2.5, alpha: 0.7 });
    } else {
      // Idle: a faint hint at the rest spot so the thumb knows where to land.
      drawStick(rings.stick, z.x, z.y, z.r, 0.5);
      rings.stickKnob.clear()
        .circle(z.x, z.y, z.r * 0.3)
        .fill({ color: 0xf6fbff, alpha: 0.12 })
        .stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
    }
  }

  const ICON_IDLE_ALPHA = 0.66;

  function updateButtonFeedback(specialCdRatio: number) {
    if (!touchLikely) return;
    const command = touch.current();
    const ready = specialCdRatio <= 0.001;
    // No rings — just the art glyphs: muted at rest, bright when pressed.
    // The salvo glyph also dims while it's reloading.
    icons.fire.alpha = command.fire ? 1 : ICON_IDLE_ALPHA;
    icons.boost.alpha = command.boost === true ? 1 : ICON_IDLE_ALPHA;
    icons.eject.alpha = command.eject ? 1 : ICON_IDLE_ALPHA;
    icons.special.alpha = command.special === true ? 1 : ICON_IDLE_ALPHA * (ready ? 1 : 0.45);
    drawLever(touch.throttleValue());
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
    updateStickKnob();
    drawLever(touch.throttleValue());
    drawIcons();
    placeLabel(labels.throttle, z.throttle.x, z.throttle.yTop - 14);
  }

  function setActive(nextActive: boolean) {
    active = nextActive;
    c.visible = active && touchLikely;
  }

  return {
    container: c,
    layout,
    setActive,
    /** Swap the throttle handle art per faction (С.О.В. brass / Jackal skull grip). */
    setThrottleKnob(url: string) { leverKnob.texture = Texture.from(url); },
    isTouchLikely() { return touchLikely; },
    update(specialCdRatio: number = 0) {
      updateStickKnob();
      updateButtonFeedback(specialCdRatio);
    },
  };
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

// 1-3 supply balloons per round, scattered around the player at shootable
// altitudes with a gentle drift. (App-side Math.random, like the rest of arena
// spawning; the deterministic tick handles pops/drops via the seeded RNG.)
function makeArenaSupplyBalloons(startId: number, player: Plane, count: number): SupplyBalloon[] {
  const out: SupplyBalloon[] = [];
  for (let i = 0; i < count; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = player.kinematic.position.x + side * (440 + Math.random() * 1200);
    // Spread across the combat band (a bit above the player's typical altitude),
    // clamped so pickups have room to fall and balloons aren't on the deck.
    const y = Math.min(
      ARENA_WORLD_HEIGHT * 0.6,
      Math.max(280, player.kinematic.position.y - 700 + Math.random() * 1100),
    );
    const drift = (Math.random() < 0.5 ? -1 : 1) * SUPPLY_BALLOON_DRIFT * (0.6 + Math.random() * 0.9);
    out.push({
      id: startId + i,
      position: { x, y },
      velocity: { x: drift, y: 0 },
      bobPhase: Math.random() * Math.PI * 2,
      hp: SUPPLY_BALLOON_HP,
      alive: true,
    });
  }
  return out;
}

function makeArenaRoundEnemy(id: number, player: Plane, round: number, lane: number = 0, isRun = false): Plane {
  const role = arenaEnemyRoleForRound(round, lane);
  const roleTuning = arenaEnemyRoleTuning(role);
  // «Забег» uses a chunkier base HP + gentle curve over 15 waves; arena keeps its own.
  const hpMul = isRun ? runEnemyHpMultiplierForWave(round) : arenaEnemyHpMultiplierForRound(round);
  const baseHp = isRun ? RUN_ENEMY_BASE_HP : ENEMY_INITIAL_HP_LIGHT;
  const hp = Math.round(baseHp * hpMul * roleTuning.hpScale);
  const speed = G_MAX_LEVEL * Math.min(1.2, (0.92 + round * 0.03) * roleTuning.speedScale);
  const fromRight = player.kinematic.position.x < ARENA_WORLD_WIDTH * 0.55;
  const heading = fromRight ? Math.PI : 0;
  const x = fromRight
    ? Math.min(ARENA_WORLD_WIDTH - 900, player.kinematic.position.x + 1350 + lane * 180)
    : Math.max(900, player.kinematic.position.x - 1350 - lane * 180);
  const laneOffset = (lane % 2 === 0 ? -1 : 1) * (220 + Math.floor(lane / 2) * 160);
  const y = Math.max(360, Math.min(ARENA_WORLD_HEIGHT - 560, player.kinematic.position.y + laneOffset));
  // A subset of late-wave aces carry rockets — a dangerous minority, not every plane,
  // so the sky isn't a constant rocket storm. Staggered first-launch delay per lane.
  const firesRockets = role === 'ace' && round >= (isRun ? 5 : 4) && lane % 3 === 1;
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
    firesRockets,
    rocketCooldown: firesRockets ? 2.0 + lane * 0.4 : undefined,
  };
}

function makeArenaScarBoss(id: number, player: Plane, round: number, isRun = false, faction: 'sov' | 'jackals' = 'sov'): Plane {
  const roleTuning = arenaEnemyRoleTuning('boss');
  const hpMul = isRun ? runEnemyHpMultiplierForWave(round) : arenaEnemyHpMultiplierForRound(round);
  // С.О.В. fight «Шрам» (the Baron). Алые Шакалы fight CHICO — the С.О.В. hero, an even
  // tougher (~1.2×) wall you must out-build. The boss renders in the OTHER faction's
  // colour automatically (it's an enemy sprite, which uses the inverted visual scheme):
  // blue Chico for the Jackals, red Шрам for С.О.В.
  const isChico = faction === 'jackals';
  // The run boss is a fixed, build-gated HP pool; the arena boss keeps its scaling formula.
  const hp = isRun
    ? Math.round(RUN_BOSS_HP * (isChico ? 1.2 : 1))
    : Math.round(ENEMY_INITIAL_HP_HEAVY * hpMul * 3.2 * roleTuning.hpScale);
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
    bossName: isChico ? 'ЧИКО' : 'ШРАМ',
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
const AUTO_RUN = URL_PARAMS.has('run');
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

/**
 * Load every visual asset, but NEVER let one failure block the game. `Assets.load`
 * on an array rejects if ANY url fails — on a phone / flaky connection that means a
 * single heavy image (or a slow request) blanks the whole app with a load error.
 * Here each asset loads independently; failures are skipped + logged, and the game
 * still starts (a missing cloud just renders empty — far better than a black screen).
 */
async function loadVisualAssetsResilient(urls: readonly string[]): Promise<void> {
  const results = await Promise.allSettled(urls.map((url) => Assets.load(url)));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? urls[i]! : null))
    .filter((u): u is string => u !== null);
  if (failed.length > 0) {
    console.warn(
      `[assets] ${failed.length}/${urls.length} visual assets failed to load — continuing without them:`,
      failed,
    );
  }
}

// «Забег» player power (balance-council tune). Still a predator from wave 1, but
// trimmed from 260→180 HP so late waves can actually threaten — headroom now comes
// from enemy scaling + Hull picks, not a huge base. Keep the damage/fire buffs.
const RUN_PLAYER_MAX_HP = 180;
const RUN_PLAYER_DAMAGE_MULT = 1.5;
const RUN_PLAYER_FIRE_RATE_MULT = 0.12 / 0.085; // ≈1.41
// Алые Шакалы run modifiers: HEAVY BRAWLER (KillZone-style) — tougher hull, twice the
// per-shot punch but a much slower gun (mag/recoil/slow-slug feel live in the core via
// state.playerFaction). С.О.В. stays the light rapid baseline. All tunable.
const RUN_JACKAL_HP_MULT = 240 / 180;       // ≈1.33 → 240 HP, tankier
const RUN_JACKAL_DAMAGE_MULT = 2.0;          // 30 dmg/shot sledgehammer
const RUN_JACKAL_FIRE_RATE_MULT = 0.085 / 0.150; // ≈0.567 → fire interval 0.085s→0.150s
const RUN_JACKAL_INCOMING_DMG_MULT = 0.8;    // armored: takes 20% less incoming damage
const RUN_JACKAL_SPEED_MULT = 0.9;           // heavier airframe: ~10% slower top speed
// Boss «Шрам» HP for the run. Big jump from the old ~2100 (which a built-up player
// melted in seconds) → a real, build-gated fight. PLAYTEST-TUNE THIS knob: if the boss
// dies too fast, raise it; if it's a slog, lower it.
const RUN_BOSS_HP = 11000;
// Run enemies are chunkier than the arena's light pirate (30 HP) so even wave-1 enemies
// take a short burst (~3 hits), not a single shot. Scaled per wave on top of this.
const RUN_ENEMY_BASE_HP = 55;

export async function startGame(container: HTMLElement) {
  await loadVisualAssetsResilient(VISUAL_ASSET_URLS);
  const menuBackdrop = createMenuBackdrop(container);

  const app = await createPixiApp(container);
  const clock = createRenderClock();

  const worldLayer = new Container();
  app.stage.addChild(worldLayer);
  worldLayer.visible = false;

  // === Screen-space far backdrop ===
  // The scenic panorama renders here, sized to the viewport (downsampled from the
  // source → sharp) with a gentle parallax drift — instead of being stretched onto
  // the huge world and magnified by the camera (which made it blurry).
  const backdropLayer = new Container();
  app.stage.addChildAt(backdropLayer, 0); // behind the world
  // Opaque sky backstop — guarantees the (transparent-background) canvas is never
  // see-through to the page color, even if the photo doesn't perfectly cover.
  const backdropBackstop = new Graphics();
  backdropLayer.addChild(backdropBackstop);
  const backdropSprite = new Sprite();
  backdropSprite.anchor.set(0.5);
  backdropLayer.addChild(backdropSprite);
  backdropLayer.visible = false;
  let backdropUrl: string | null = null;
  let backstopColor = 0x141a30;
  const BACKDROP_OVER = 1.3; // oversize so parallax drift never reveals an edge
  function fitBackdrop() {
    backdropBackstop.clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: backstopColor });
    const tex = backdropSprite.texture;
    if (!backdropUrl || !tex || tex.width < 2) return;
    const sw = app.screen.width, sh = app.screen.height;
    const scale = Math.max((sw * BACKDROP_OVER) / tex.width, (sh * BACKDROP_OVER) / tex.height);
    backdropSprite.scale.set(scale);
    backdropSprite.x = sw / 2;
    backdropSprite.y = sh / 2;
  }
  function setBackdrop(url: string | null, color?: number) {
    if (typeof color === 'number') backstopColor = color;
    backdropLayer.visible = url !== null;
    if (!url) { backdropUrl = null; fitBackdrop(); return; }
    if (url !== backdropUrl) {
      backdropUrl = url;
      backdropSprite.texture = Texture.from(url);
    }
    fitBackdrop();
  }

  // === Drifting sky strata (Path B) — living, layered distant clouds ===
  // Two bands of soft clouds cross the screen at different speeds/depths, just in
  // front of the photo backdrop and behind the world. Always alive regardless of
  // where the plane is in the world.
  interface SkyCloud { sprite: Sprite; speed: number; baseY: number; depth: number; }
  const skyClouds: SkyCloud[] = [];
  const SKY_STRATA = [
    { count: 4, scaleMin: 0.55, scaleMax: 0.95, alpha: 0.16, speed: 5, yMin: 0.04, yMax: 0.5, depth: 0.03 },
    { count: 5, scaleMin: 0.35, scaleMax: 0.6, alpha: 0.26, speed: 13, yMin: 0.08, yMax: 0.62, depth: 0.06 },
  ];
  function buildSkyStrata() {
    for (const c of skyClouds) backdropLayer.removeChild(c.sprite);
    skyClouds.length = 0;
    const sw = app.screen.width, sh = app.screen.height;
    for (const s of SKY_STRATA) {
      for (let i = 0; i < s.count; i++) {
        const url = SKY_CLOUD_URLS[Math.floor(Math.random() * SKY_CLOUD_URLS.length)]!;
        const sp = new Sprite(Texture.from(url));
        sp.anchor.set(0.5);
        sp.alpha = s.alpha;
        const targetW = sw * (s.scaleMin + Math.random() * (s.scaleMax - s.scaleMin));
        sp.width = targetW;
        sp.scale.y = Math.abs(sp.scale.x);
        sp.x = Math.random() * (sw * 1.4) - sw * 0.2;
        sp.y = sh * (s.yMin + Math.random() * (s.yMax - s.yMin));
        // place mid band in front of far band
        backdropLayer.addChild(sp);
        skyClouds.push({ sprite: sp, speed: s.speed, baseY: sp.y, depth: s.depth });
      }
    }
  }
  function updateSkyStrata(dt: number, focusX: number, focusY: number) {
    if (!backdropLayer.visible || skyClouds.length === 0) return;
    const sw = app.screen.width, sh = app.screen.height;
    const pY = (focusY / ARENA_WORLD_HEIGHT - 0.5);
    const pX = (focusX / ARENA_WORLD_WIDTH - 0.5);
    for (const c of skyClouds) {
      c.sprite.x -= c.speed * dt;
      const halfW = c.sprite.width * 0.5;
      if (c.sprite.x < -halfW) c.sprite.x = sw + halfW + Math.random() * sw * 0.3;
      c.sprite.y = c.baseY - pY * sh * c.depth * 2.4;
      c.sprite.x -= pX * sw * c.depth; // subtle horizontal parallax
    }
  }
  buildSkyStrata();

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
    // Arena: the scenic photo goes to the sharp screen-space backdrop, and the
    // world sky uses a transparent base + parallax decor (no giant stretched photo).
    const isArena = runMode === 'arena';
    sky = createSkyBackground(
      worldW,
      worldH,
      themeId,
      runMode === 'story' || runMode === 'skytest' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot',
      isArena ? undefined : ((runMode === 'skytest' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot') ? SKY_TEST_IMAGE_URL : imageUrl),
      (runMode === 'skytest' || runMode === 'arena' || runMode === 'gunfeelLab' || runMode === 'flightLab' || runMode === 'oilshot')
        ? { mode: 'layeredArena', transparentBase: isArena }
        : undefined,
    );
    // Backstop tone roughly matches each sky so any uncovered edge reads as sky, not page bg.
    const backstop =
      themeId === 'night' ? 0x0b1430 :
      themeId === 'twilight' ? 0x231a3c :
      themeId === 'sunset' ? 0x3a2238 :
      0x224a68; // noon
    setBackdrop(isArena ? (imageUrl ?? null) : null, backstop);
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
  const supplyLayer = new Container(); // balloons + dropped pickups (behind planes)
  const groundShadowLayer = new Container(); // plane ground shadows (below the planes)
  worldLayer.addChild(bulletLayer, fxLayer, glowLayer.container, groundFxLayer, supplyLayer, groundShadowLayer, planeLayer);
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
  const rocketSprites = new RocketPool(fxLayer);
  let prevEnemyRocketCount = 0; // to detect new enemy rocket launches for the audio cue
  // Wing-rocket rack drawn under the player plane (live = red, spent = dim).
  const wingRocketMount = new Graphics();
  planeLayer.addChild(wingRocketMount);
  const supplyBalloons = new SupplyPool(supplyLayer, assetUrl('assets/biplanes/supply_balloon_chest.png'));
  const supplyPickups = new PickupPool(supplyLayer);
  const supplyFx = new SupplyFx(fxLayer);
  const damageFx = new DamageFx(fxLayer, glowLayer.container);
  const muzzleFlashes = new MuzzleFlashes(glowLayer.container);
  const tracers = new BulletTracers(glowLayer.container);
  const floatingNumbers = new FloatingNumbers(fxLayer);

  let prevBulletIds = new Set<number>();
  // === Faction (С.О.В. vs Алые Шакалы) ===
  // Picked before a mode starts (default С.О.В.). The chosen faction inverts plane
  // colours — you fly your faction's colour, the enemies wear the other — and swaps
  // the HUD throttle grip. `?faction=jackals` forces it for testing.
  let chosenFaction: 'sov' | 'jackals' =
    URL_PARAMS.get('faction') === 'jackals' ? 'jackals' : 'sov';
  const playerVisual = (): 'player' | 'enemy' => (chosenFaction === 'jackals' ? 'enemy' : 'player');
  const enemyVisual = (): 'player' | 'enemy' => (chosenFaction === 'jackals' ? 'player' : 'enemy');

  let playerSprite = createPlaneSprite('player', playerVisual());
  planeLayer.addChild(playerSprite.container, playerSprite.hpBar);
  groundShadowLayer.addChild(playerSprite.shadow);

  function rebuildPlayerSpriteForFaction() {
    // Player flies their faction's colour — re-create the sprite with the right scheme.
    // The `playerSprite` var is reassigned; every caller reads it live (no captured copy).
    planeLayer.removeChild(playerSprite.container);
    planeLayer.removeChild(playerSprite.hpBar);
    groundShadowLayer.removeChild(playerSprite.shadow);
    playerSprite = createPlaneSprite('player', playerVisual());
    planeLayer.addChild(playerSprite.container, playerSprite.hpBar);
    groundShadowLayer.addChild(playerSprite.shadow);
  }

  // Wingman drone sprites — small brass dieselpunk drones that trail the plane.
  const droneSprites: { c: Container; prop: Graphics }[] = [];
  for (let i = 0; i < 5; i++) { // up to 5 for the Jackal «Ведомый» swarm (wingman ×4 + base)
    const c = new Container();
    const body = new Graphics();
    body.ellipse(0, 0, 12, 7).fill({ color: 0xc8922e }).stroke({ color: 0x2a1a0e, width: 1.6 });
    body.ellipse(2, -1.5, 6, 3).fill({ color: 0xffe9b0, alpha: 0.5 });
    body.circle(6, 0, 2.6).fill({ color: 0x9fe8ff }).stroke({ color: 0x2a1a0e, width: 1 }); // sensor eye
    body.rect(-15, -1.6, 7, 3.2).fill({ color: 0x6b7790 }).stroke({ color: 0x2a1a0e, width: 1 }); // rear gun
    const prop = new Graphics();
    prop.rect(-1.4, -9, 2.8, 18).fill({ color: 0xdfe6ee, alpha: 0.7 });
    prop.x = 12;
    c.addChild(body, prop);
    c.visible = false;
    planeLayer.addChild(c);
    droneSprites.push({ c, prop });
  }

  const enemySprites = new Map<number, ReturnType<typeof createPlaneSprite>>();

  // Pilot sprites — keyed by pilot.id like enemy planes. Faction baked in at creation.
  const pilotSprites = new Map<number, ReturnType<typeof createPilotSprite>>();

  const camera = createCamera(worldLayer, app.screen.width, app.screen.height);
  const audio = createGameAudio();

  // Airframe recoil buck (render-only): each player shot nudges the plane sprite
  // back along the nose; it decays fast so it reads as a per-shot jolt, not drift.
  const playerBodyKick = { x: 0, y: 0 };

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
      // Arena/run dampens camera motion (busy screen) — but less than before, and the
      // airframe buck below is NOT dampened, so each shot still reads as a hard "бах".
      const cameraFeel = runMode === 'arena' ? 0.6 : 1;
      playerBodyKick.x = Math.max(-8, Math.min(8, playerBodyKick.x + shotFeel.bodyKick.x));
      playerBodyKick.y = Math.max(-8, Math.min(8, playerBodyKick.y + shotFeel.bodyKick.y));
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

  // === Ammo counter — compact, bottom-right under the action icons ====
  const AMMO_PANEL_W = 104;
  const AMMO_PANEL_H = 38;
  const ammoHud = new Container();
  const ammoBg = new Graphics();
  const ammoIcon = new Graphics();
  const ammoBar = new Graphics();
  const ammoText = new Text({ text: '', style: new TextStyle({ fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x05080e, width: 4 } }) });
  ammoHud.addChild(ammoBg, ammoBar, ammoIcon, ammoText);
  ammoHud.visible = false;
  uiLayer.addChild(ammoHud);

  // Re-create the player plane in the chosen faction's colour at each mode start (only
  // when the scheme actually changed). `setFaction` (the select screen) routes through here.
  let currentPlayerVisual: 'player' | 'enemy' = playerVisual();
  function applyFactionForMode() {
    const want = playerVisual();
    if (want !== currentPlayerVisual) {
      rebuildPlayerSpriteForFaction();
      currentPlayerVisual = want;
    }
    // Jackal supply balloons are crimson; С.О.В. blue.
    supplyBalloons.setFaction(
      chosenFaction === 'jackals' ? 'jackals' : 'sov',
      chosenFaction === 'jackals'
        ? assetUrl('assets/biplanes/supply_balloon_chest_red.png')
        : assetUrl('assets/biplanes/supply_balloon_chest.png'),
    );
    // The ГАЗ throttle handle ITSELF becomes the Jackal skull grip (С.О.В. keep the brass one).
    touchGuide.setThrottleKnob(
      chosenFaction === 'jackals'
        ? assetUrl('assets/hud/throttle_jackal.png')
        : assetUrl('assets/biplanes/hud/lever_knob.png'),
    );
  }
  function setFaction(f: 'sov' | 'jackals') {
    chosenFaction = f;
    applyFactionForMode();
  }
  void setFaction; // wired to the faction-select screen (next)

  function layoutAmmoHud(w: number, h: number) {
    // Bottom-right corner, just left of the far-right throttle lever.
    ammoHud.x = Math.round(w - AMMO_PANEL_W - Math.max(94, w * 0.14));
    ammoHud.y = Math.round(h - AMMO_PANEL_H - 10);
    ammoBg.clear()
      .roundRect(0, 0, AMMO_PANEL_W, AMMO_PANEL_H, 9)
      .fill({ color: 0x0a1422, alpha: 0.58 })
      .stroke({ color: 0x3f5e8c, width: 1.4, alpha: 0.6 });
    // small brass cartridge glyph
    const cy = AMMO_PANEL_H / 2 - 3;
    ammoIcon.clear()
      .roundRect(12, cy - 8, 8, 16, 1.6).fill({ color: 0xd8a93f })
      .moveTo(20, cy - 8).lineTo(26, cy).lineTo(20, cy + 8).closePath().fill({ color: 0xb9892b })
      .rect(12, cy - 8, 8, 3).fill({ color: 0xf1d27a });
    ammoText.x = 34;
    ammoText.y = 5;
  }

  function updateAmmoHud(state: WorldState) {
    const jkMag = chosenFaction === 'jackals';
    const mag = jkMag ? JACKAL_MAG_SIZE : MAG_SIZE;
    const reloadFull = jkMag ? JACKAL_RELOAD_SEC : RELOAD_SEC;
    const ammo = state.player.ammo ?? mag;
    const reloadLeft = state.player.reloadTimer ?? 0;
    const barX = 12, barY = AMMO_PANEL_H - 8, barW = AMMO_PANEL_W - 24, barH = 4;
    ammoBar.clear().roundRect(barX, barY, barW, barH, 2).fill({ color: 0x05080e, alpha: 0.6 });
    if (reloadLeft > 0) {
      ammoText.text = `${Math.ceil(reloadLeft)}с`;
      ammoText.tint = 0xffb15a;
      const frac = Math.max(0, Math.min(1, 1 - reloadLeft / reloadFull));
      if (frac > 0) ammoBar.roundRect(barX, barY, barW * frac, barH, 2).fill({ color: 0xff9a4a });
    } else {
      const low = ammo <= 15;
      ammoText.text = `${ammo}`;
      ammoText.tint = low ? 0xff5a4a : 0xffe08a;
      const frac = Math.max(0, Math.min(1, ammo / mag));
      if (frac > 0) ammoBar.roundRect(barX, barY, barW * frac, barH, 2).fill({ color: low ? 0xff5a4a : 0x7cff8f });
    }
  }
  layoutAmmoHud(app.screen.width, app.screen.height);

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

  // === Weather indicator (top-right): icon + name + hazard warning ===
  const weatherPanel = new Container();
  const weatherBg = new Graphics();
  const weatherIcon = new Graphics();
  const weatherLabel = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
      fill: 0xeaf4ff, stroke: { color: 0x05080e, width: 3 },
    }),
  });
  const weatherHazard = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold',
      fill: 0xffd27a, stroke: { color: 0x05080e, width: 3 },
    }),
  });
  weatherPanel.addChild(weatherBg, weatherIcon, weatherLabel, weatherHazard);
  weatherPanel.visible = false;
  uiLayer.addChild(weatherPanel);

  function drawWeatherIcon(g: Graphics, icon: WeatherIcon, cx: number, cy: number, r: number) {
    g.clear();
    if (icon === 'sun') {
      g.circle(cx, cy, r * 0.55).fill({ color: 0xffd86a });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75)
          .lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
          .stroke({ color: 0xffd86a, width: 2, alpha: 0.9 });
      }
    } else if (icon === 'night') {
      g.circle(cx, cy, r * 0.6).fill({ color: 0xcfe0ff });
      g.circle(cx + r * 0.28, cy - r * 0.18, r * 0.5).fill({ color: 0x0c1530 });
    } else if (icon === 'fog') {
      for (let i = 0; i < 4; i++) {
        const y = cy - r * 0.5 + i * r * 0.36;
        g.moveTo(cx - r, y).lineTo(cx + r, y).stroke({ color: 0xc7d6e6, width: 2.4, alpha: 0.85 });
      }
    } else {
      // cloud base for rain/snow/storm
      g.circle(cx - r * 0.4, cy - r * 0.1, r * 0.42)
        .circle(cx + r * 0.4, cy - r * 0.1, r * 0.46)
        .circle(cx, cy - r * 0.35, r * 0.5)
        .rect(cx - r * 0.8, cy - r * 0.12, r * 1.6, r * 0.5)
        .fill({ color: icon === 'storm' ? 0x6b7790 : 0xb9c6d6 });
      if (icon === 'rain' || icon === 'storm') {
        for (let i = -1; i <= 1; i++) {
          g.moveTo(cx + i * r * 0.42, cy + r * 0.35)
            .lineTo(cx + i * r * 0.42 - r * 0.16, cy + r * 0.78)
            .stroke({ color: 0x8ec8ff, width: 2, alpha: 0.95 });
        }
      }
      if (icon === 'snow') {
        for (let i = -1; i <= 1; i++) {
          g.circle(cx + i * r * 0.42, cy + r * 0.55, r * 0.1).fill({ color: 0xffffff });
        }
      }
      if (icon === 'storm') {
        g.poly([cx + r * 0.1, cy + r * 0.2, cx - r * 0.2, cy + r * 0.6, cx + r * 0.05, cy + r * 0.6, cx - r * 0.15, cy + r * 1.0])
          .stroke({ color: 0xffe14a, width: 3 });
      }
    }
  }

  function layoutWeatherIndicator(w: number, _h: number) {
    const pw = 204, ph = 54;
    // Sit well left of the throttle lever ("ГАЗ") so the hazard line never spills
    // onto it, and below the status row.
    weatherPanel.x = Math.max(12, w - pw - Math.max(118, w * 0.12));
    weatherPanel.y = 40;
    weatherBg.clear()
      .roundRect(0, 0, pw, ph, 8)
      .fill({ color: 0x091522, alpha: 0.66 })
      .stroke({ color: 0x57ddff, width: 1.5, alpha: 0.5 });
    weatherLabel.x = 44; weatherLabel.y = 9;
    weatherHazard.x = 10; weatherHazard.y = 33;
  }

  let weatherIconKind: WeatherIcon | null = null;
  function updateWeatherIndicator(weather: WeatherGameplay, t: number) {
    weatherLabel.text = weather.label;
    if (weatherIconKind !== weather.icon) {
      weatherIconKind = weather.icon;
      drawWeatherIcon(weatherIcon, weather.icon, 24, 24, 13);
    }
    if (weather.hazard) {
      weatherHazard.text = weather.hazard;
      weatherHazard.alpha = 0.7 + 0.3 * Math.abs(Math.sin(t * 3));
      weatherHazard.visible = true;
    } else {
      weatherHazard.visible = false;
    }
  }

  const arenaToast = new Container();
  const arenaToastBg = new Graphics();
  const arenaToastTitle = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'Georgia, serif',
      fontSize: 30,
      fill: 0xffe4a8,
      fontWeight: 'bold',
      letterSpacing: 0,
      stroke: { color: 0x120804, width: 4 },
    }),
  });
  const arenaToastSub = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 13,
      fill: 0xcde7f4,
      fontWeight: 'bold',
      letterSpacing: 0,
      stroke: { color: 0x061019, width: 3 },
    }),
  });
  arenaToast.addChild(arenaToastBg, arenaToastTitle, arenaToastSub);
  arenaToast.visible = false;
  uiLayer.addChild(arenaToast);
  let arenaToastTimer = 0;
  let arenaToastDuration = 1;

  function layoutArenaToast(w: number, h: number) {
    const toastW = Math.min(460, Math.max(300, w * 0.46));
    const toastH = 82;
    arenaToast.x = (w - toastW) / 2;
    arenaToast.y = Math.max(64, h * 0.18);
    arenaToastBg.clear()
      .roundRect(0, 0, toastW, toastH, 8)
      .fill({ color: 0x091522, alpha: 0.74 })
      .stroke({ color: 0xffd27a, width: 2.5, alpha: 0.8 })
      .rect(18, 52, toastW - 36, 1)
      .fill({ color: 0x6fdcff, alpha: 0.4 });
    arenaToastTitle.style.fontSize = Math.max(21, Math.min(32, w * 0.032));
    arenaToastSub.style.fontSize = Math.max(10, Math.min(13, w * 0.014));
    arenaToastTitle.x = (toastW - arenaToastTitle.width) / 2;
    arenaToastTitle.y = 11;
    arenaToastSub.x = (toastW - arenaToastSub.width) / 2;
    arenaToastSub.y = 53;
  }

  function showArenaToast(titleText: string, subText: string, duration = 1.8) {
    arenaToastTitle.text = titleText;
    arenaToastSub.text = subText;
    arenaToastDuration = Math.max(0.2, duration);
    arenaToastTimer = arenaToastDuration;
    arenaToast.visible = true;
    layoutArenaToast(app.screen.width, app.screen.height);
  }

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
    if (arenaToast.visible) layoutArenaToast(w, h);
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
  // «Забег»: non-null while a run is active. The run reuses the arena pipeline;
  // every run-specific branch is gated on this being set, so arena/story are untouched.
  let runSession: RunState | null = null;
  let runOver = false;        // true once the run-summary screen is up (one-shot guard)
  let runBossSpawned = false; // boss (wave 15) has entered this run
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

  // === Faction-select overlay (DOM: two playing faction videos + info card + confirm) ===
  // Shown when the player picks Arena / Забег. On confirm → setFaction + start the mode.
  let pendingFactionMode: 'arena' | 'run' | null = null;
  const factionSelect = createFactionSelect(container, (f) => {
    setFaction(f);
    const mode = pendingFactionMode;
    pendingFactionMode = null;
    if (mode === 'run') startRun();
    else { runSession = null; startArena(); }
  });

  function createFactionSelect(host: HTMLElement, onConfirm: (f: 'sov' | 'jackals') => void) {
    const FACTIONS = {
      sov: {
        name: 'С.О.В.', sub: 'Содружество Объединённых Видов',
        tagline: '«Разные крылья — одно небо.»',
        desc: 'Когда-то до Великого Раскола виды враждовали. Потом устали — так родилось С.О.В., сотни видов под одним флагом. На советах спорят до хрипоты, а в небе прикрывают друг друга без вопросов. Сражаются не за то, чтобы править, а за то, чтобы каждый мог летать свободно.',
        pilot: 'Капитан Чико',
        pilotBio: 'Сын первого Аса, пропавшего без вести в бою. Спокойный, упрямый, своих не бросает — и готов отомстить за отца.',
        pocherk: 'Почерк: крепкие машины, верное звено, дроны-помощники. Сила — в том, что их много и они вместе.',
        video: assetUrl('assets/factions/faction_sov.mp4'), color: '#3a86d6', accent: '#ffcf45',
      },
      jackals: {
        name: 'АЛЫЕ ШАКАЛЫ', sub: 'Краснокрылая стая',
        tagline: '«Небо — сильным. Остальные потеснятся.»',
        desc: 'Шакалы не воруют по мелочи — они хотят само небо. Под алыми знамёнами Барона собрались те, кто уверовал, будто рождён править: один вид, один флаг, один порядок, а Содружество — «стая дворняг». Налетают с маршами и пафосом, забирают своё силой и зовут это «новым небом».',
        pilot: 'Барон Рудольф фон Клык',
        pilotBio: 'Говорит красиво и громко — про порядок, про величие. Кланяется перед атакой, извиняется после. Откуда взялся — никто так и не выяснил.',
        pocherk: 'Самолёт: мощная броня, огромная огневая мощь, медленная скорость. Тяжёлый бугай — бьёт редко, но как кувалда.',
        video: assetUrl('assets/factions/faction_jackals.mp4'), color: '#c0392b', accent: '#e8b04a',
      },
    } as const;
    let selected: 'sov' | 'jackals' = 'sov';
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;z-index:50;display:none;flex-direction:column;align-items:center;justify-content:flex-start;gap:1.2vh;background:rgba(4,6,12,0.93);font-family:monospace;padding:2vh 2vw 2.5vh;box-sizing:border-box;overflow-y:auto';
    const title = document.createElement('div');
    title.textContent = 'ВЫБЕРИ ФРАКЦИЮ';
    title.style.cssText = 'color:#f7d69a;font-size:clamp(18px,3vw,32px);font-weight:bold;letter-spacing:2px;text-shadow:0 2px 6px #000';
    // Layout: vertical video LEFT, description CENTER, vertical video RIGHT.
    const mainRow = document.createElement('div');
    mainRow.style.cssText = 'display:flex;gap:2.2vw;width:100%;max-width:1100px;justify-content:center;align-items:stretch;flex-wrap:wrap;flex:1 1 auto';
    const centerCol = document.createElement('div');
    centerCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vh;flex:1 1 200px;max-width:440px;min-width:190px;text-align:center';
    const info = document.createElement('div');
    info.style.cssText = 'color:#d6e2e7';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center';
    const back = document.createElement('button');
    back.textContent = '← Назад';
    back.style.cssText = 'pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:bold;font-size:clamp(12px,1.5vw,16px);color:#cdd6e0;background:#1a2433;border:2px solid #3a4658;border-radius:8px;padding:12px 20px';
    const confirm = document.createElement('button');
    confirm.textContent = 'ПОДТВЕРДИТЬ ВЫБОР';
    confirm.style.cssText = 'pointer-events:auto;cursor:pointer;font-family:monospace;font-weight:bold;font-size:clamp(13px,1.7vw,20px);letter-spacing:1px;color:#0d141a;background:#f7d69a;border:none;border-radius:8px;padding:14px 24px';
    row.appendChild(back); row.appendChild(confirm);
    centerCol.appendChild(info); centerCol.appendChild(row);
    root.appendChild(title); root.appendChild(mainRow);
    const panelEls: Record<string, HTMLElement> = {};
    (['sov', 'jackals'] as const).forEach((key) => {
      const f = FACTIONS[key];
      const panel = document.createElement('div');
      panel.style.cssText = 'position:relative;flex:1 1 0;max-width:260px;min-width:120px;aspect-ratio:9/16;max-height:66vh;align-self:center;border-radius:12px;overflow:hidden;cursor:pointer;border:4px solid transparent;transition:border-color .15s,transform .15s;background:#06101f';
      const vid = document.createElement('video');
      vid.src = f.video; vid.autoplay = true; vid.loop = true; vid.muted = true; vid.playsInline = true; vid.preload = 'auto';
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      const lbl = document.createElement('div');
      lbl.textContent = f.name;
      lbl.style.cssText = `position:absolute;left:0;right:0;bottom:0;padding:10px;text-align:center;font-weight:bold;font-size:clamp(13px,1.6vw,18px);color:#fff;background:linear-gradient(transparent, ${f.color}ee);text-shadow:0 2px 4px #000`;
      panel.appendChild(vid); panel.appendChild(lbl);
      const select = () => { selected = key; render(); };
      panel.addEventListener('click', select);
      panel.addEventListener('mouseenter', () => { if (!('ontouchstart' in window)) { selected = key; render(); } });
      panelEls[key] = panel;
    });
    mainRow.appendChild(panelEls.sov!); mainRow.appendChild(centerCol); mainRow.appendChild(panelEls.jackals!);
    function render() {
      (['sov', 'jackals'] as const).forEach((key) => {
        const on = key === selected;
        panelEls[key]!.style.borderColor = on ? FACTIONS[key].accent : 'transparent';
        panelEls[key]!.style.transform = on ? 'translateY(-4px)' : 'none';
      });
      const f = FACTIONS[selected];
      info.innerHTML = `<div style="font-size:clamp(15px,2.1vw,23px);font-weight:bold;color:${f.accent}">${f.name}</div>`
        + `<div style="opacity:.75;font-size:clamp(10px,1.2vw,13px);margin:2px 0 5px">${f.sub}</div>`
        + `<div style="font-style:italic;color:#fff;font-size:clamp(11px,1.3vw,15px);margin-bottom:6px">${f.tagline}</div>`
        + `<div style="font-size:clamp(11px,1.25vw,14px);line-height:1.4;margin-bottom:6px">${f.desc}</div>`
        + `<div style="font-size:clamp(10px,1.2vw,13.5px);line-height:1.35;margin-bottom:5px"><span style="color:${f.accent};font-weight:bold">✈ Пилот — ${f.pilot}.</span> ${f.pilotBio}</div>`
        + `<div style="font-size:clamp(10px,1.15vw,13px);line-height:1.35;color:${f.accent};opacity:.92">${f.pocherk}</div>`;
      confirm.style.background = f.accent;
      confirm.style.boxShadow = `0 4px 0 ${f.color}`;
    }
    const setVideos = (play: boolean) => {
      for (const k of ['sov', 'jackals'] as const) {
        const v = panelEls[k]!.querySelector('video') as HTMLVideoElement;
        if (play) void v.play().catch(() => undefined); else v.pause();
      }
    };
    let onBack: () => void = () => undefined;
    back.addEventListener('click', () => { audio.playUiSelect(); root.style.display = 'none'; setVideos(false); onBack(); });
    confirm.addEventListener('click', () => { audio.playUiSelect(); root.style.display = 'none'; setVideos(false); onConfirm(selected); });
    host.appendChild(root);
    return {
      show(back2: () => void) { onBack = back2; selected = chosenFaction; root.style.display = 'flex'; render(); setVideos(true); },
      hide() { root.style.display = 'none'; setVideos(false); },
    };
  }

  const startScreen = createStartScreen(
    app.screen.width,
    app.screen.height,
    (action) => {
      audio.unlock();
      audio.playUiSelect();
      if (action === 'flightLab') {
        startFlightLab();
        return;
      }
      if (action === 'arena') {
        pendingFactionMode = 'arena';
        factionSelect.show(() => undefined);
        return;
      }
      if (action === 'run') {
        pendingFactionMode = 'run';
        factionSelect.show(() => undefined);
        return;
      }
      if (action === 'story') {
        startStoryMissionOne();
        return;
      }
      if (action === 'exit') {
        // In a Telegram Mini App, close the webapp; in a plain browser tab, try to
        // close the window (works when the page was script-opened).
        const tg = (window as unknown as { Telegram?: { WebApp?: { close?: () => void } } }).Telegram?.WebApp;
        if (tg?.close) tg.close();
        else window.close();
        return;
      }
    },
    {
      musicEnabled: menuBackdrop.isMusicEnabled(),
      onMusicToggle: (on) => { menuBackdrop.setMusicEnabled(on); },
    },
  );
  uiLayer.addChild(startScreen.container);
  startScreen.show();

  const levelUpScreen = createLevelUpScreen(
    app.screen.width,
    app.screen.height,
    (id: string) => {
      audio.playUpgradePick();
      state = applyUpgrade(state, id as UpgradeId);
      if (runSession) runSession = recordPick(runSession, id as UpgradeId);
      levelUpScreen.hide();
      choicesShowing = false;
      updateArenaDirector();
    },
    {
      onReroll: () => {
        if (!runSession || runSession.rerollsRemaining <= 0) return;
        runSession = recordReroll(runSession);
        audio.playUpgradeOpen();
        showRunPickChoices();
      },
      onSkip: () => {
        if (!runSession) return;
        runSession = recordSkip(runSession);
        levelUpScreen.hide();
        choicesShowing = false;
        updateArenaDirector();
      },
      branchEmblems: {
        assault: Texture.from(assetUrl('assets/run/emblem_assault.png')),
        bombardier: Texture.from(assetUrl('assets/run/emblem_bombardier.png')),
        commander: Texture.from(assetUrl('assets/run/emblem_commander.png')),
        hull: Texture.from(assetUrl('assets/run/emblem_hull.png')),
      },
    },
  );
  uiLayer.addChild(levelUpScreen.container);

  let arenaShownStage = 0;
  let arenaRound = 1;
  let currentWeather: WeatherGameplay = weatherGameplay('clear');
  let weatherBaseWind = { x: 0, y: 0 };
  let lightningStrikeTimer = 4;
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
    const phaseText =
      arenaRoundPhase === 'takeoff' ? 'ВЗЛЕТ' :
      arenaRoundPhase === 'upgradeDelay' ? `ТРОФЕИ ${Math.max(0, 3 - arenaUpgradeDelaySec).toFixed(1)}С` :
      arenaRoundPhase === 'victoryFlight' ? `ЧИСТЫЙ ПОЛЕТ ${Math.max(0, 3 - arenaVictoryFlightSec).toFixed(1)}С` :
      arenaRoundPhase === 'upgrade' ? 'ДОРАБОТКА' :
      (state.enemies.find(e => e.isBoss && e.alive)?.bossName) ??
      'БОЙ';
    // Weather/location name lives in the dedicated weather panel — keep the status
    // bar short so it doesn't collide with the cockpit panel (left) or that panel (right).
    void location;
    // Weather/location name lives in the dedicated weather panel — keep the status
    // bar short so it doesn't collide with the cockpit panel (left) or that panel (right).
    arenaStatus.text = runSession
      ? `ЗАБЕГ • ВОЛНА ${Math.min(arenaRound, RUN_WAVE_COUNT)}/${RUN_WAVE_COUNT}  ${phaseText}  СБИТО ${state.playerScore}`
      : `РАУНД ${arenaRound}  ${phaseText}  ЧИКО ${state.playerScore} : ${state.enemyScore} ВРАГ`;
    arenaStatus.x = Math.max(12, (app.screen.width - arenaStatus.width) / 2);
    arenaStatus.y = 12;
    arenaStatus.visible = true;
  }

  function setArenaStageTheme(stage: number) {
    const location = ARENA_LOCATION_THEMES[Math.max(0, Math.min(ARENA_LOCATION_THEMES.length - 1, stage - 1))]!;
    setSkyTheme(location.sky, location.background);
    arenaWeather.setPreset(location.weather);
    currentWeather = weatherGameplay(location.weather);
    weatherBaseWind = { ...currentWeather.wind };
    lightningStrikeTimer = 4 + Math.random() * 4;
    weatherPanel.visible = runMode === 'arena';
    layoutWeatherIndicator(app.screen.width, app.screen.height);
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
    // «Забег» drives waves by round number (15 waves, boss on 15); arena keeps its
    // score-based escalation/boss.
    const nextEnemyCount = runSession
      ? runEnemyCountForWave(arenaRound)
      : arenaEnemyCountForRound(arenaRound);
    const finalBossReady = runSession
      ? isBossWave(arenaRound)
      : shouldSpawnArenaFinalBossForRound({
        playerScore: state.playerScore,
        finalBossScore: ARENA_FINAL_BOSS_SCORE,
        playerWinScore: PLAYER_SCORE_TO_WIN,
        roundEnemyCount: nextEnemyCount,
        bossAlreadySpawned: state.enemies.some(e => e.isBoss),
        gameOver: state.gameOver,
        pendingLevelUp: state.pendingLevelUp,
        choicesShowing,
      });
    if (runSession && finalBossReady) runBossSpawned = true;
    const isRun = runSession !== null;
    const enemies = finalBossReady
      ? [makeArenaScarBoss(state.nextEntityId, state.player, arenaRound, isRun, chosenFaction)]
      : Array.from({ length: nextEnemyCount }, (_, lane) =>
        makeArenaRoundEnemy(state.nextEntityId + lane, state.player, arenaRound, lane, isRun)
      );
    arenaDuelEnemyId = enemies[0]?.id ?? null;
    state.nextEntityId += enemies.length;
    state.enemies = enemies;
    state.pilots = state.pilots.filter(p => p.faction !== 'enemy');
    state.enemyAiStates.clear();
    state.prevEnemyHp.clear();
    // Drop 2-4 supply balloons for the player to shoot down this round (worth chasing:
    // ammo / repair / rapidfire / a bonus card pick).
    const balloonCount = 2 + Math.floor(Math.random() * 3);
    const balloons = makeArenaSupplyBalloons(state.nextEntityId, state.player, balloonCount);
    state.nextEntityId += balloons.length;
    state.balloons = balloons;
    state.pickups = [];
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
      player: { ...makeArenaRunwayPlayer(state.player), wingRockets: wingRocketCapacity(state.appliedUpgradeIds) },
      enemies: [],
      bullets: [],
      bombs: [],
      rockets: [],
      balloons: [],
      pickups: [],
      rapidFireSec: 0,
      pilots: state.pilots.filter(p => p.faction !== 'enemy'),
      enemyAiStates: new Map(),
      prevEnemyHp: new Map(),
    };
    bullets.sync([]);
    bombSprites.sync([]);
    rocketSprites.sync([]);
    supplyBalloons.sync([]);
    supplyPickups.sync([]);
    supplyFx.clear();
    touch.resetThrottle(); // each round starts at zero throttle — the player must throttle up
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

  function showRunPickChoices() {
    if (!runSession) return;
    // Child seed for the pick roll — never consumes the combat RNG stream (§13.6).
    // Salted by reroll budget so a reroll yields a different, replayable offer.
    const salt =
      ((arenaRound * 0x9e3779b9) ^ (runSession.picks.length * 0x85ebca6b) ^ (runSession.rerollsRemaining * 0xc2b2ae35)) >>> 0;
    const rng = createRng((state.rngState ^ salt ^ state.tickCount) >>> 0);
    const choices = rollRunPickChoices(state.appliedUpgradeIds, runSession.affinity, rng, factionUpgradePool(chosenFaction));
    arenaRoundPhase = 'upgrade';
    state = { ...state, pendingLevelUp: false };
    if (choices.length > 0) {
      choicesShowing = true;
      levelUpScreen.show(choices, { rerollsRemaining: runSession.rerollsRemaining });
    } else {
      choicesShowing = false;
    }
  }

  function showArenaRoundUpgrade() {
    if (runSession) {
      showRunPickChoices();
      return;
    }
    const rng = createRng((state.rngState ^ (arenaRound * 0x9e3779b9) ^ state.tickCount) >>> 0);
    const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng, factionUpgradePool(chosenFaction));
    arenaRoundPhase = 'upgrade';
    state = { ...state, pendingLevelUp: false };
    if (choices.length > 0) {
      choicesShowing = true;
      levelUpScreen.show(choices);
    } else {
      choicesShowing = false;
    }
  }

  // A balloon dropped a «КАРТА» pickup → grant a bonus card pick mid-round. Reuses the
  // level-up screen + its onPick (applies the upgrade, then resumes). `choicesShowing`
  // pauses the sim; we do NOT touch the round phase, so combat resumes cleanly after.
  function showBonusPick() {
    if (choicesShowing || !gameRunning || state.gameOver) return;
    if (!state.player.alive || state.player.state !== 'flying') return;
    const rng = createRng((state.rngState ^ 0x5a17b3 ^ (state.tickCount * 0x9e3779b9)) >>> 0);
    const pool = factionUpgradePool(chosenFaction);
    const choices = runSession
      ? rollRunPickChoices(state.appliedUpgradeIds, runSession.affinity, rng, pool)
      : rollUpgradeChoices(state.appliedUpgradeIds, rng, pool);
    if (choices.length === 0) return;
    choicesShowing = true;
    levelUpScreen.show(choices); // a clean bonus — no reroll/skip
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

    // Arena is forgiving (auto-clears gameOver to keep flying). «Забег» is one life:
    // never auto-clear — a destroyed plane ends the run (handled in the ticker).
    if (!runSession && state.gameOver && state.player.alive && state.playerScore < PLAYER_SCORE_TO_WIN) {
      state = { ...state, gameOver: false };
    }

    spawnArenaRoundEnemy();

    const aliveEnemies = countUnresolvedArenaEnemies(state.enemies);
    const playerPilotActive = findPilot(state.pilots, 'player') !== undefined;

    // «Забег» win: the wave-15 boss has entered and is now down.
    if (
      runSession
      && !runOver
      && runBossSpawned
      && isBossWave(arenaRound)
      && aliveEnemies === 0
      && state.player.alive
    ) {
      endRun('won');
      return;
    }
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
      audio.playWaveClear();
      screenFx.flash(0xb8f0ff, 0.18, 0.16);
      camera.zoomPunch(1.03, 0.3);
      showArenaToast('ВОЛНА ЗАЧИЩЕНА', 'Трофеи и доработка через 3 секунды', 2.2);
    }

    arenaRoundPhase = flow.phase;
    arenaRound = flow.round;

    if (flow.shouldShowUpgrade) {
      showArenaToast('ТРОФЕИ НА БОРТ', 'Выбери один модуль для следующей волны', 1.4);
      showArenaRoundUpgrade();
    } else if (flow.shouldLaunchNextRound) {
      resetArenaPlayerForNextTakeoff();
      showArenaToast(`ВОЛНА ${arenaRound}`, 'Разгоняйся и набирай высоту', 2.0);
    }

    updateArenaStatusText();
  }

  function openLevelUpChoices() {
    if (!state.pendingLevelUp || choicesShowing) return;
    const rng = createRng((state.rngState ^ (state.level * 0x9e3779b9) ^ state.tickCount) >>> 0);
    const choices = rollUpgradeChoices(state.appliedUpgradeIds, rng, factionUpgradePool(chosenFaction));
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

  const runSummaryScreen = createRunSummaryScreen(
    app.screen.width,
    app.screen.height,
    () => { startRun(); },       // ЗАНОВО — straight into a fresh run
    () => { resetToMenu(); },    // В АНГАР
  );
  uiLayer.addChild(runSummaryScreen.container);

  // In-game "exit to menu" button (top-left). Visible during a live game session;
  // hidden under modal overlays. Escape still works as a shortcut.
  const exitButton = new Container();
  exitButton.eventMode = 'static';
  exitButton.cursor = 'pointer';
  exitButton.visible = false;
  exitButton.x = 14;
  exitButton.y = 10;
  const EXIT_BTN_W = 132;
  const EXIT_BTN_H = 38;
  const exitBg = new Graphics();
  const exitLabel = new Text({
    text: '‹ В МЕНЮ',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 15, fill: 0xffd07a, fontWeight: 'bold', stroke: { color: 0x05080e, width: 3 } }),
  });
  const drawExit = (hover: boolean) => {
    exitBg.clear()
      .roundRect(0, 0, EXIT_BTN_W, EXIT_BTN_H, 8)
      .fill({ color: 0x0a1320, alpha: hover ? 0.92 : 0.74 })
      .stroke({ color: 0xffb44a, width: hover ? 2.5 : 1.8, alpha: hover ? 1 : 0.8 });
    exitLabel.x = (EXIT_BTN_W - exitLabel.width) / 2;
    exitLabel.y = (EXIT_BTN_H - exitLabel.height) / 2 - 1;
  };
  drawExit(false);
  exitButton.addChild(exitBg, exitLabel);
  exitButton.on('pointerover', () => drawExit(true));
  exitButton.on('pointerout', () => drawExit(false));
  exitButton.on('pointerdown', () => { audio.playUiSelect(); resetToMenu(); });
  uiLayer.addChild(exitButton);

  // End the current «Забег» and raise the debrief. One-shot via runOver.
  function endRun(outcome: 'won' | 'lost') {
    if (!runSession || runOver) return;
    runOver = true;
    const summary = buildRunSummary(
      { ...runSession, wave: arenaRound },
      outcome,
      { kills: state.playerScore, timeSec: state.timeSec },
    );
    gameRunning = false;
    choicesShowing = true; // pauses the sim while the debrief is up
    levelUpScreen.hide();
    if (outcome === 'won') audio.playVictory(); else audio.playDefeat();
    runSummaryScreen.show(summary);
  }

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
      special: k.special === true || t.special === true || k.bomb === true,
      boost: k.boost || t.boost,
      // The on-screen lever (touch) sets throttle absolutely; keyboard keeps the +/- delta.
      throttleTarget: t.throttleTarget != null ? t.throttleTarget : null,
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
    rocketSprites.sync([]);
    supplyBalloons.sync([]);
    supplyPickups.sync([]);
    supplyFx.clear();
    groundFx.clear();
    screenFx.setVignette(0);
    screenFx.disableDeathTint();
    levelUpScreen.hide();
    deathScreen.hide();
    radioPopup.hide();
    dialogueOverlay.hide();
    hud.hideEnemyArrows();
    arenaStatus.visible = false;
    arenaToast.visible = false;
    arenaToastTimer = 0;
    flightLabStatus.visible = false;
    shownChicoFirstKillRadio = false;
    gunfeelLabShotWasActive = false;
  }

  function startArena() {
    runMode = 'arena';
    applyFactionForMode(); // player flies the chosen faction's colour; show/hide the grip
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
    touch.resetThrottle(); // start the run sitting still — the player gives gas
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
    runSummaryScreen.hide();
    updateArenaDirector();
    gameRunning = true;
    if (runSession) {
      showArenaToast(`ЗАБЕГ • ВОЛНА ${arenaRound}/${RUN_WAVE_COUNT}`, 'Одна жизнь. Дойди до босса.', 2.4);
    } else {
      showArenaToast(`ВОЛНА ${arenaRound}`, 'Разгоняйся и набирай высоту', 2.0);
    }
  }

  // «Забег»: a fresh run on the arena pipeline, gated by runSession.
  function startRun() {
    runSession = createRunState();
    runOver = false;
    runBossSpawned = false;
    startArena();
    // «Забег» flips the balance toward the player from the start, using the Godot
    // build's numbers: 260 HP (vs 100), ~3.4× bullet damage (34 vs 10), ~1.4× fire
    // rate (0.085s vs 0.12s cooldown). Enemies keep our per-wave escalation, so the
    // run still ramps — but you START as the predator. maxHp carries across waves
    // (makeArenaRunwayPlayer preserves it); the multipliers persist on world state
    // and upgrades stack on top.
    // Алые Шакалы are GLASS: thinner hull (less HP) but a meaner caliber (more damage).
    // С.О.В. keep the balanced power-fantasy loadout. Their swarm («Ведомый») + aggressive
    // build pool is how the Jackals win — by numbers, not survivability.
    const isJackals = chosenFaction === 'jackals';
    const runMaxHp = Math.round(RUN_PLAYER_MAX_HP * (isJackals ? RUN_JACKAL_HP_MULT : 1));
    state = {
      ...state,
      playerFaction: isJackals ? 'jackals' : 'sov', // core reads this for the heavy gun
      player: {
        ...state.player,
        maxHp: runMaxHp, hp: runMaxHp,
        ammo: isJackals ? JACKAL_MAG_SIZE : MAG_SIZE, // 60-round Jackal magazine
        reloadTimer: 0,
        incomingDamageMultiplier: isJackals ? RUN_JACKAL_INCOMING_DMG_MULT : 1, // armor
        speedMultiplier: isJackals ? RUN_JACKAL_SPEED_MULT : 1,                  // heavier airframe
      },
      damageMultiplier: state.damageMultiplier * RUN_PLAYER_DAMAGE_MULT * (isJackals ? RUN_JACKAL_DAMAGE_MULT : 1),
      fireRateMultiplier: state.fireRateMultiplier * RUN_PLAYER_FIRE_RATE_MULT * (isJackals ? RUN_JACKAL_FIRE_RATE_MULT : 1),
      boostHeatMultiplier: state.boostHeatMultiplier * (isJackals ? JACKAL_BOOST_HEAT_MULT : 1), // overheats ~30% later
    };
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
  let flameTrailAcc = 0;
  let prevPlayerScore = state.playerScore;
  let prevLevel = state.level;
  let prevPlayerAlive = state.player.alive;
  let prevPlayerState = state.player.state;
  let prevTickCount = state.tickCount;
  let prevPlayerHp = state.player.hp;
  let prevExplosionEventCount = state.explosionEvents.length;
  let prevBoostActive = false;
  let prevSpecialCooldown = 0;
  let prevReloading = false;
  const enemyHpForFx = new Map<number, number>();
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

  // Self-healing frame guard. A single thrown frame must never permanently freeze
  // the game (Pixi keeps re-arming rAF, so a deterministic throw would lock the sim
  // while cosmetic animations keep ticking). We log it, surface it on-screen ONCE so
  // it can be reported from a screenshot, and let the next frame retry.
  let frameErrorCount = 0;
  let frameErrorBanner: HTMLDivElement | null = null;
  function handleFrameError(err: unknown) {
    frameErrorCount++;
    if (frameErrorCount <= 3 || frameErrorCount % 120 === 0) {
      console.error('[biplanes] frame error:', err);
    }
    const msg = err instanceof Error ? `${err.message}\n${(err.stack ?? '').split('\n').slice(0, 5).join('\n')}` : String(err);
    (window as unknown as { __biplanesFrameError?: string }).__biplanesFrameError = msg;
    try { localStorage.setItem('biplanes.lastError', msg); } catch { /* ignore */ }
    if (!frameErrorBanner) {
      // Top-CENTER, big and bright — the old bottom-left spot hid under the joystick.
      // Tap to dismiss so the player can keep going if the game still renders.
      frameErrorBanner = document.createElement('div');
      frameErrorBanner.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);max-width:92vw;z-index:99999;background:rgba(150,10,10,0.95);color:#fff;font:bold 13px monospace;padding:10px 14px;border:2px solid #ff6a6a;border-radius:8px;white-space:pre-wrap;box-shadow:0 4px 16px rgba(0,0,0,0.6);pointer-events:auto;cursor:pointer';
      frameErrorBanner.addEventListener('click', () => { if (frameErrorBanner) frameErrorBanner.style.display = 'none'; });
      document.body.appendChild(frameErrorBanner);
    }
    frameErrorBanner.style.display = 'block';
    frameErrorBanner.textContent = `⚠ ОШИБКА (#${frameErrorCount}) — пришли этот текст Claude:\n${msg}`;
  }
  // Also catch UNCAUGHT errors — e.g. a crash inside Pixi's own render pass (a bad filter
  // on some mobile GPUs) happens OUTSIDE the ticker try/catch and would otherwise freeze
  // the game with no banner. This guarantees the error always surfaces.
  window.addEventListener('error', (e) => handleFrameError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => handleFrameError(e.reason));

  app.ticker.add((ticker) => {
   try {
    // Heal any layout↔viewport desync — iOS Safari (and Telegram) settle the
    // viewport *after* boot and don't reliably fire resize/observer events, which
    // left the controls pinned to the boot-time width even when the canvas itself
    // had grown. Compare the live container box against what we last laid out at
    // (not just app.screen), so this catches both a stale renderer and stale HUD.
    // Cheap per-frame guard: a no-op once they agree.
    if (container.clientWidth !== laidOutW || container.clientHeight !== laidOutH) {
      resyncLayout();
    }
    // CLAMP the frame delta: finite + at most 100 ms. A mobile hitch / GC pause / tab
    // resume can make ticker.deltaMS huge (or NaN), and per-frame accumulator loops like
    // `while (flameTrailAcc >= 1/26)` would then spin thousands of times — or forever on
    // a non-finite value — hard-freezing the tab. This is the #1 freeze guard.
    const rawDt = ticker.deltaMS / 1000;
    const realDt = Number.isFinite(rawDt) ? Math.min(0.1, Math.max(0, rawDt)) : 1 / 60;
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
    runSummaryScreen.update(dt);
    radioPopup.update(dt);
    if (arenaToast.visible) {
      arenaToastTimer = Math.max(0, arenaToastTimer - dt);
      const t = arenaToastTimer / arenaToastDuration;
      arenaToast.alpha = Math.min(1, t * 1.8);
      arenaToast.scale.set(1 + (1 - t) * 0.025);
      if (arenaToastTimer <= 0) {
        arenaToast.visible = false;
        arenaToast.alpha = 1;
        arenaToast.scale.set(1);
      }
    }
    touchGuide.setActive(runMode !== 'skytest' && runMode !== 'gunfeelLab' && runMode !== 'oilshot' && gameRunning && !choicesShowing && !state.gameOver);
    // On real touch devices the lever owns the throttle; desktop keeps keyboard W/S.
    touch.setThrottleEngaged(navigator.maxTouchPoints > 0);
    touchGuide.update(Math.max(0, Math.min(1, (state.player.specialCooldown ?? 0) / SALVO_COOLDOWN)));
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
        if (boss.bossName && bossMarkerLabel.text !== boss.bossName) {
          bossMarkerLabel.text = boss.bossName; // «ЧИКО» vs «ШРАМ»
          bossMarkerLabel.x = -bossMarkerLabel.width / 2;
        }
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

      // Floating damage numbers — spawn when an enemy's HP drops between ticks.
      // Threshold avoids spam from continuous sources (flame trail ~0.8/frame).
      for (const e of state.enemies) {
        const prevHp = enemyHpForFx.get(e.id);
        if (prevHp !== undefined && e.alive && e.state === 'flying') {
          const dmg = prevHp - e.hp;
          if (dmg >= 4) {
            floatingNumbers.spawn(
              e.kinematic.position.x + (Math.random() - 0.5) * 18,
              e.kinematic.position.y - 26,
              dmg,
              true,
            );
          }
        }
        enemyHpForFx.set(e.id, e.hp);
      }
      for (const id of [...enemyHpForFx.keys()]) {
        if (!state.enemies.some(e => e.id === id)) enemyHpForFx.delete(id);
      }

      // Salvo launch VFX — specialCooldown jumps from ~0 back to full when fired.
      const specialCd = state.player.specialCooldown ?? 0;
      if (specialCd > prevSpecialCooldown + 0.5 && state.player.alive) {
        const h = state.player.kinematic.heading;
        const nx = state.player.kinematic.position.x + Math.cos(h) * 30;
        const ny = state.player.kinematic.position.y + Math.sin(h) * 30;
        muzzleFlashes.spawn(nx, ny, h, { scale: 1.7, duration: 0.16 });
        damageFx.addSmokeTrail({ x: nx, y: ny }, 10);
        audio.playSalvo();
        camera.shake(runMode === 'arena' ? 2.5 : 5);
        camera.punch(-Math.cos(h) * 7, -Math.sin(h) * 7, 7);
        screenFx.flash(0xbfe9ff, 0.07, 0.14);
      }
      prevSpecialCooldown = specialCd;

      prevTickCount = state.tickCount;
    }

    if (runMode === 'arena') {
      updateArenaDirector(realDt);
    } else {
      openLevelUpChoices();
      updateArenaDirector();
    }

    // === Weather gameplay: gusty wind + lightning strikes + HUD indicator ===
    if (runMode === 'arena') {
      weatherPanel.visible = gameRunning && !choicesShowing;
      // Gust ebbs and flows so wind is felt, not a constant pull.
      const gust = 0.5 + 0.5 * Math.abs(Math.sin(renderTimeSec * 0.7) * Math.cos(renderTimeSec * 0.23 + 1.3));
      state.wind = { x: weatherBaseWind.x * gust, y: weatherBaseWind.y * gust };
      updateWeatherIndicator(currentWeather, renderTimeSec);
      if (currentWeather.lightning && state.player.alive && state.player.state === 'flying' && !state.pendingLevelUp && !choicesShowing) {
        lightningStrikeTimer -= realDt;
        if (lightningStrikeTimer <= 0) {
          lightningStrikeTimer = 5 + Math.random() * 6;
          const highOpen = state.player.kinematic.position.y < ARENA_WORLD_HEIGHT * 0.42;
          screenFx.flash(0xeaf4ff, 0.6, 0.22);
          camera.shake(highOpen ? 15 : 6);
          audio.playThunder();
          if (highOpen) {
            state.player = { ...state.player, hp: Math.max(1, state.player.hp - 14) };
            damageFx.addSparks(state.player.kinematic.position, 22);
            screenFx.triggerHitGlitch();
          }
        }
      }
    } else {
      state.wind = undefined;
      weatherPanel.visible = false;
    }

    if (runMode === 'arena') {
      const playerPilot = findPilot(state.pilots, 'player');
      const focus = resolveArenaCameraFocus({
        playerX: playerPilot?.position.x ?? state.player.kinematic.position.x,
        playerY: playerPilot?.position.y ?? state.player.kinematic.position.y,
        facing: playerPilot?.facing ?? state.player.kinematic.facing,
      });
      camera.setFocus(focus.x, focus.y, cameraZoom(focus.zoom));
      // Gentle parallax on the screen-space backdrop (distant sky barely shifts).
      if (backdropLayer.visible) {
        const fx = focus.x / ARENA_WORLD_WIDTH - 0.5;
        const fy = focus.y / ARENA_WORLD_HEIGHT - 0.5;
        backdropSprite.x = app.screen.width / 2 - fx * app.screen.width * 0.09;
        backdropSprite.y = app.screen.height / 2 - fy * app.screen.height * 0.08;
        updateSkyStrata(realDt, focus.x, focus.y);
      }
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

    // Arena/story use the death telegram. «Забег» uses its own run-summary (below).
    if (state.gameOver && !deathScreen.container.visible && !runSession) {
      audio.playDefeat();
      deathScreen.show(state);
    }

    if (state.playerScore > prevPlayerScore) {
      // Kill confirmation — a brief lens kick on top of the explosion already firing.
      screenFx.flash(0xffffff, 0.25, 0.12);
      camera.zoomPunch(1.02, 0.16);
    }
    if (state.level > prevLevel) {
      // Level-up should feel like a power surge: gold flash + zoom + spark burst + chime.
      screenFx.flash(0xffd86a, 0.5, 0.32);
      camera.zoomPunch(1.05, 0.4);
      camera.shake(4);
      const lp = state.player.kinematic.position;
      damageFx.addSparks({ x: lp.x, y: lp.y }, 26);
      damageFx.addShockwave({ x: lp.x, y: lp.y });
      audio.playLevelUp();
    }
    const playerPilotActive = findPilot(state.pilots, 'player') !== undefined;
    if (prevPlayerAlive && !state.player.alive && !playerPilotActive) {
      audio.playExplosion();
      screenFx.flash(0xff5544, 0.5, 0.4);
      screenFx.enableDeathTint();
      clock.slowMo(SLOW_MO_SCALE, SLOW_MO_DURATION_SEC, SLOW_MO_RECOVERY_SEC);
    }
    // «Забег» is one life: the moment the player's plane is destroyed, the run ends.
    if (runSession && !runOver && prevPlayerAlive && !state.player.alive) {
      endRun('lost');
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
      // (Blue chunk debris on hit is emitted by the plane sprite's impact handler.)
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
        // Jackal heavy rounds get the HEAVY gun-feel: big nose-kick, deep BOOM sound, fat
        // muzzle flash (routed through the same isHeavy path as the heavy cannon).
        emitGunfeelShotVfx(b.position.x, b.position.y, heading, b.ownerFaction, b.isHeavy || !!b.heavyRound);
      }
    }
    prevBulletIds = seenBulletIds;

    // === Boost feel ===
    // Boost used to be invisible. Now: a kick on activation + a continuous afterburner
    // plume off the tail + a faint speed-line wash while held.
    const boosting = state.player.boostActive === true && state.player.alive && state.player.state === 'flying';
    if (boosting && !prevBoostActive) {
      camera.zoomPunch(1.06, 0.34);
      camera.shake(3);
      screenFx.flash(0x9fe6ff, 0.1, 0.18);
      audio.playBoostKick();
    }
    if (boosting) {
      // White vapor/speed-line plume (NOT fire — fire reads as "we got hit").
      const h = state.player.kinematic.heading;
      const pos = state.player.kinematic.position;
      const tail = { x: pos.x - Math.cos(h) * 26, y: pos.y - Math.sin(h) * 26 };
      const tail2 = { x: pos.x - Math.cos(h) * 66, y: pos.y - Math.sin(h) * 66 };
      damageFx.addVaporSegment(tail, tail2, 5.5);
      damageFx.addWindStreak(pos, h);
      if (Math.random() < 0.5) damageFx.addWindStreak(tail, h);
    }
    prevBoostActive = boosting;

    // Reload audio: rack on empty, ready-chime when the fresh mag seats.
    const reloadingNow = (state.player.reloadTimer ?? 0) > 0;
    if (reloadingNow && !prevReloading) audio.playReload();
    if (!reloadingNow && prevReloading) audio.playReloadReady();
    prevReloading = reloadingNow;

    floatingNumbers.update(dt);

    // Wingman drones follow behind the plane, orbiting (matches the core firing positions).
    {
      const dn = state.droneCount > 0 ? state.droneCount : (state.hasDrone ? 1 : 0);
      const pk = state.player.kinematic;
      const back = pk.heading + Math.PI;
      for (let i = 0; i < droneSprites.length; i++) {
        const ds = droneSprites[i]!;
        const show = i < dn && state.player.alive && state.player.state !== 'crashed';
        ds.c.visible = show;
        if (show) {
          const phase = renderTimeSec * 3 + (i * Math.PI * 2) / Math.max(1, dn);
          ds.c.x = pk.position.x + Math.cos(back) * 38 + Math.cos(phase) * 30;
          ds.c.y = pk.position.y + Math.sin(back) * 38 + Math.sin(phase) * 30;
          ds.c.rotation = pk.heading;
          ds.c.scale.x = pk.facing;
          ds.prop.rotation = renderTimeSec * 42;
        }
      }
    }

    const worldGroundY = (state.worldHeight ?? WORLD_HEIGHT) - 90;
    playerSprite.update(state.player, dt, damageFx, clock, camera, undefined, groundFx, { screenFx, groundY: worldGroundY });
    // Airframe recoil buck: decay fast, then nudge the plane sprite by the leftover.
    const bodyKickDecay = Math.min(1, dt * 22);
    playerBodyKick.x -= playerBodyKick.x * bodyKickDecay;
    playerBodyKick.y -= playerBodyKick.y * bodyKickDecay;
    if (state.player.alive) {
      playerSprite.container.x += playerBodyKick.x;
      playerSprite.container.y += playerBodyKick.y;
    }

    // Flame-trail upgrade — now actually shows the burning tail (it also scorches
    // enemies flying right behind you).
    if (state.hasFlameTrail && state.player.alive && state.player.state === 'flying') {
      flameTrailAcc += dt;
      const fcos = Math.cos(state.player.kinematic.heading);
      const fsin = Math.sin(state.player.kinematic.heading);
      while (flameTrailAcc >= 1 / 26) {
        const back = 16 + Math.random() * 64;
        damageFx.addFireTrail({
          x: state.player.kinematic.position.x - fcos * back,
          y: state.player.kinematic.position.y - fsin * back,
        }, 1.15);
        flameTrailAcc -= 1 / 26;
      }
    } else {
      flameTrailAcc = 0;
    }

    const seenEnemy = new Set<number>();
    for (const e of state.enemies) {
      seenEnemy.add(e.id);
      let s = enemySprites.get(e.id);
      if (!s) {
        s = createPlaneSprite('enemy', enemyVisual());
        planeLayer.addChild(s.container, s.hpBar);
        groundShadowLayer.addChild(s.shadow);
        enemySprites.set(e.id, s);
      }
      s.update(e, dt, damageFx, clock, camera, undefined, groundFx, { screenFx, groundY: worldGroundY });
    }
    for (const [id, s] of enemySprites) {
      if (!seenEnemy.has(id)) {
        planeLayer.removeChild(s.container);
        planeLayer.removeChild(s.hpBar);
        groundShadowLayer.removeChild(s.shadow);
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
    // Audio cue when an enemy fires a rocket (count of enemy-owned rockets rises).
    let enemyRocketCount = 0;
    for (const r of state.rockets) if (r.ownerFaction === 'enemy') enemyRocketCount++;
    if (enemyRocketCount > prevEnemyRocketCount) audio.playEnemyRocket();
    prevEnemyRocketCount = enemyRocketCount;
    rocketSprites.sync(state.rockets);
    // Wing rockets mounted under the player — deplete as you fire the special.
    const wrCount = state.player.wingRockets ?? 0;
    const wrCap = runMode === 'arena' ? wingRocketCapacity(state.appliedUpgradeIds) : 4;
    wingRocketMount.visible = runMode === 'arena' && state.player.alive && state.player.state === 'flying';
    if (wingRocketMount.visible) {
      const px = state.player.kinematic.position.x;
      const py = state.player.kinematic.position.y;
      const face = state.player.kinematic.facing >= 0 ? 1 : -1;
      wingRocketMount.clear();
      for (let i = 0; i < wrCap; i++) {
        const ox = px + (i - (wrCap - 1) / 2) * 13 * face;
        const oy = py + 22;
        const live = i < wrCount;
        wingRocketMount.roundRect(ox - 6, oy - 2.2, 12, 4.4, 1.6)
          .fill({ color: live ? 0xcf3b2a : 0x2f343d, alpha: live ? 0.95 : 0.4 });
        if (live) wingRocketMount.poly([ox + 6 * face, oy, ox + 2 * face, oy - 2.2, ox + 2 * face, oy + 2.2]).fill({ color: 0xffd24a });
      }
    }
    supplyBalloons.sync(state.balloons);
    supplyPickups.sync(state.pickups);
    for (const pos of state.balloonPopEvents) {
      supplyFx.pop(pos);
      audio.playImpact(false);
    }
    for (const ev of state.pickupCollectEvents) {
      supplyFx.collect(ev.position, ev.kind);
      if (ev.kind === 'ammo') audio.playUpgradePick();
      else if (ev.kind === 'repair') audio.playLevelUp();
      else if (ev.kind === 'level') { audio.playUpgradeOpen(); showBonusPick(); }
      else audio.playBoostKick();
    }
    supplyFx.update(dt);
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
    // Windshield oil density tracks the player's HP (clean when healthy → splattered low).
    screenFx.setDamageOil(state.player.alive ? state.player.hp / state.player.maxHp : 1);
    screenFx.update(dt, renderTimeSec, worldLayer);
    arenaWeather.update(dt, renderTimeSec);
    hud.setArenaRound(runMode === 'arena' ? arenaRound : null);
    hud.update(state);
    updateAmmoHud(state);
    ammoHud.visible = (runMode === 'arena' || runMode === 'story')
      && gameRunning && !choicesShowing && !state.gameOver && state.player.alive;
    // Exit-to-menu button: visible during a live game session, hidden under overlays.
    exitButton.visible = runMode !== 'menu' && gameRunning && !choicesShowing
      && !state.gameOver && !runSummaryScreen.container.visible && !deathScreen.container.visible;
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
   } catch (err) {
     handleFrameError(err);
   }
  });

  function resetToMenu() {
    runMode = 'menu';
    runSession = null;
    runOver = false;
    runBossSpawned = false;
    runSummaryScreen.hide();
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
      groundShadowLayer.removeChild(s.shadow);
    }
    enemySprites.clear();
    for (const [, s] of pilotSprites) {
      planeLayer.removeChild(s.container);
    }
    pilotSprites.clear();
    bullets.sync([]);
    bombSprites.sync([]);
    rocketSprites.sync([]);
    supplyBalloons.sync([]);
    supplyPickups.sync([]);
    supplyFx.clear();
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
  } else if (AUTO_RUN) {
    requestAnimationFrame(() => startRun());
  } else if (AUTO_ARENA) {
    requestAnimationFrame(() => startArena());
  }

  const onResize = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    layoutWorld();
    camera.setScreen(w, h);
    hud.resize(w, h);
    // Keep «В МЕНЮ» clear of the cockpit panel — the panel scales with the HUD (scale 1,
    // or 0.62 when compact: width<960||height<520), bottom ≈ 180×scale. Sit just below it.
    exitButton.y = Math.round(180 * ((w < 960 || h < 520) ? 0.62 : 1)) + 8;
    arenaWeather.resize(w, h);
    fitBackdrop();
    buildSkyStrata();
    layoutWeatherIndicator(w, h);
    layoutAmmoHud(w, h);
    screenFx.resize(w, h);
    touch.updateZones(w, h);
    touchGuide.layout(w, h);
    startScreen.resize(w, h);
    levelUpScreen.resize(w, h);
    deathScreen.resize(w, h);
    runSummaryScreen.resize(w, h);
    dialogueOverlay.resize(w, h);
    radioPopup.resize(w, h);
    layoutCaravanGauge(w, h);
  };
  // Re-sync the renderer to the real container box, then re-run the full layout.
  // Pixi's resizeTo / app.resize() does NOT reliably re-measure when the container
  // grows after boot (verified: container 932 but app.screen stuck at the 560 boot
  // size). Resize the renderer explicitly to the container's true CSS box so
  // app.screen — which every layout reads — always matches what's on screen.
  let laidOutW = -1;
  let laidOutH = -1;
  const resyncLayout = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    if (w !== app.screen.width || h !== app.screen.height) {
      app.renderer.resize(w, h);
    }
    onResize();
    laidOutW = w;
    laidOutH = h;
  };
  window.addEventListener('resize', resyncLayout);
  window.addEventListener('orientationchange', resyncLayout);
  window.visualViewport?.addEventListener('resize', resyncLayout);

  // iOS Safari resolves 100dvw/100dvh (and Telegram resolves its viewport) *after*
  // boot — the container grows to its true size without firing a window 'resize'.
  // The canvas then stretched to full width while the controls stayed pinned to the
  // tiny initial width (throttle stuck mid-screen, action buttons pushed off the
  // edge). Observe the real container box so layout can never disagree with it.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resyncLayout).observe(container);
  }
  // Belt-and-suspenders for the late settle: re-layout on the next frame and again
  // shortly after boot, in case the size lands without firing any of the above.
  requestAnimationFrame(resyncLayout);
  setTimeout(resyncLayout, 350);
}
