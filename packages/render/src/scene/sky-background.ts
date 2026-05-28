import { Container, Graphics, Sprite, TilingSprite, Texture, Text, TextStyle } from 'pixi.js';
import {
  GROUND_Y,
  CEILING_Y,
  PLAYER_HANGAR_X,
  ENEMY_HANGAR_X,
} from '@biplanes/shared';

export type SkyThemeId = 'noon' | 'sunset' | 'twilight' | 'night';

export interface SkyBackgroundHandle {
  container: Container;
  update: (dt: number, timeSec: number, playerX: number, playerY: number, lightningActive?: boolean) => void;
}

interface ThemeConfig {
  skyTop: number;
  skyMid: number;
  skyLow: number;
  cloudColor: number;
  cloudAlpha: number;
  godRayColor: number;
  godRayAlpha: number;
  groundColor: number;
  grassColor: number;
  runwayDashColor: number;
  runwayDashAlpha: number;
  hangarWallColor: number;
  hangarRoofColor: number;
  enemyHangarWallColor: number;
  enemyHangarRoofColor: number;
  islandFarColor: number;
  islandMidColor: number;
}

const THEMES: Record<SkyThemeId, ThemeConfig> = {
  noon: {
    skyTop: 0x16345c,
    skyMid: 0x2b639e,
    skyLow: 0xd8985c,
    cloudColor: 0xffffff,
    cloudAlpha: 0.28,
    godRayColor: 0xfff4b3,
    godRayAlpha: 0.14,
    groundColor: 0x3d2914,
    grassColor: 0x4a6b2f,
    runwayDashColor: 0xeeeeee,
    runwayDashAlpha: 0.55,
    hangarWallColor: 0xb84a2a,
    hangarRoofColor: 0x6e2a15,
    enemyHangarWallColor: 0x3d5c7a,
    enemyHangarRoofColor: 0x1f3148,
    islandFarColor: 0x224975,
    islandMidColor: 0x1a385c,
  },
  sunset: {
    skyTop: 0x2b0d36,
    skyMid: 0x7c1f4e,
    skyLow: 0xe05624,
    cloudColor: 0xffb894,
    cloudAlpha: 0.32,
    godRayColor: 0xff944d,
    godRayAlpha: 0.16,
    groundColor: 0x241108,
    grassColor: 0x542315,
    runwayDashColor: 0xffddaa,
    runwayDashAlpha: 0.6,
    hangarWallColor: 0x8a2b21,
    hangarRoofColor: 0x511710,
    enemyHangarWallColor: 0x243b55,
    enemyHangarRoofColor: 0x142030,
    islandFarColor: 0x561841,
    islandMidColor: 0x3b0f2c,
  },
  twilight: {
    skyTop: 0x090518,
    skyMid: 0x1f143d,
    skyLow: 0x4a2a5e,
    cloudColor: 0xc19ee0,
    cloudAlpha: 0.25,
    godRayColor: 0xa877d9,
    godRayAlpha: 0.08,
    groundColor: 0x12081c,
    grassColor: 0x2c1a3b,
    runwayDashColor: 0xd8c8f0,
    runwayDashAlpha: 0.45,
    hangarWallColor: 0x5c1b26,
    hangarRoofColor: 0x330b12,
    enemyHangarWallColor: 0x162c3d,
    enemyHangarRoofColor: 0x0a141f,
    islandFarColor: 0x170f30,
    islandMidColor: 0x0f0921,
  },
  night: {
    skyTop: 0x020208,
    skyMid: 0x050817,
    skyLow: 0x0f1530,
    cloudColor: 0x313f5c,
    cloudAlpha: 0.2,
    godRayColor: 0x809eff, // used for searchlight tint
    godRayAlpha: 0.12,
    groundColor: 0x050512,
    grassColor: 0x0d1c16,
    runwayDashColor: 0x4df3ff, // glowing cyan runway dashes
    runwayDashAlpha: 0.7,
    hangarWallColor: 0x381717,
    hangarRoofColor: 0x210c0c,
    enemyHangarWallColor: 0x0e1c2b,
    enemyHangarRoofColor: 0x060f17,
    islandFarColor: 0x06091c,
    islandMidColor: 0x020512,
  },
};

const SKY_IMAGE_BY_THEME: Record<SkyThemeId, string> = {
  noon: '/assets/biplanes/sky_noon.jpg',
  sunset: '/assets/biplanes/sky_sunset.jpg',
  twilight: '/assets/biplanes/sky_twilight.jpg',
  night: '/assets/biplanes/sky_night.jpg',
};

function colorToRgb(color: number) {
  return {
    r: (color >> 16) & 255,
    g: (color >> 8) & 255,
    b: color & 255,
  };
}

function makeStorySkySoftener(width: number, height: number, cfg: ThemeConfig): Sprite | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const mid = colorToRgb(cfg.skyMid);
  const low = colorToRgb(cfg.skyLow);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.28, `rgba(${mid.r},${mid.g},${mid.b},0.04)`);
  gradient.addColorStop(0.5, `rgba(${mid.r},${mid.g},${mid.b},0.14)`);
  gradient.addColorStop(0.68, `rgba(${low.r},${low.g},${low.b},0.34)`);
  gradient.addColorStop(0.86, `rgba(${low.r},${low.g},${low.b},0.52)`);
  gradient.addColorStop(1, `rgba(${low.r},${low.g},${low.b},0.68)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sprite = new Sprite(Texture.from(canvas));
  sprite.width = width;
  sprite.height = height;
  sprite.alpha = 0.86;
  return sprite;
}

interface ScenicAssetConfig {
  url: string;
  sourceW: number;
  sourceH: number;
  x: number;
  y: number;
  width: number;
  parallax: number;
  alpha: number;
  driftX: number;
  driftY: number;
  sway: number;
  speed: number;
  phase: number;
  flipX?: boolean;
  lighthouse?: {
    x: number;
    y: number;
    beamLength: number;
    beamWidth: number;
    phase: number;
  };
  lights?: { x: number; y: number; size: number; phase: number }[];
}

interface BattleGroup {
  ship: Sprite;
  beam: Graphics;
  baseX: number;
  baseY: number;
  drift: number;
  speed: number;
  phase: number;
  scale: number;
  flipX: boolean;
  dots: { g: Graphics; radius: number; speed: number; phase: number; side: 1 | -1 }[];
}

interface BattleShot {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface BattleFlash {
  g: Graphics;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

const SCENIC_ASSETS: ScenicAssetConfig[] = [
  {
    url: '/assets/biplanes/airship_2.png',
    sourceW: 760,
    sourceH: 506,
    x: 0.12,
    y: 0.19,
    width: 230,
    parallax: 0,
    alpha: 0.34,
    driftX: 20,
    driftY: 5,
    sway: 0.006,
    speed: 0.12,
    phase: 0.2,
    flipX: true,
  },
  {
    url: '/assets/biplanes/airship_1.png',
    sourceW: 1200,
    sourceH: 725,
    x: 0.83,
    y: 0.18,
    width: 370,
    parallax: 0,
    alpha: 0.38,
    driftX: 28,
    driftY: 6,
    sway: 0.005,
    speed: 0.1,
    phase: 1.7,
  },
  {
    url: '/assets/biplanes/island_factory.png',
    sourceW: 1400,
    sourceH: 1174,
    x: 0.24,
    y: 0.44,
    width: 285,
    parallax: 0,
    alpha: 0.82,
    driftX: 10,
    driftY: 9,
    sway: 0.018,
    speed: 0.44,
    phase: 2.1,
    lights: [
      { x: 0.44, y: 0.17, size: 3, phase: 0.2 },
      { x: 0.49, y: 0.17, size: 2.6, phase: 1.4 },
      { x: 0.56, y: 0.2, size: 2.5, phase: 2.1 },
    ],
  },
  {
    url: '/assets/biplanes/island_player.png',
    sourceW: 1400,
    sourceH: 807,
    x: 0.58,
    y: 0.47,
    width: 345,
    parallax: 0,
    alpha: 0.74,
    driftX: 13,
    driftY: 10,
    sway: 0.017,
    speed: 0.39,
    phase: 0.9,
    lighthouse: { x: 0.72, y: 0.23, beamLength: 210, beamWidth: 58, phase: 0.8 },
    lights: [
      { x: 0.71, y: 0.22, size: 4, phase: 0.4 },
      { x: 0.44, y: 0.24, size: 2.5, phase: 1.6 },
      { x: 0.52, y: 0.25, size: 2.4, phase: 2.7 },
    ],
  },
  {
    url: '/assets/biplanes/island_industrial.png',
    sourceW: 1400,
    sourceH: 723,
    x: 0.78,
    y: 0.52,
    width: 275,
    parallax: 0,
    alpha: 0.68,
    driftX: 12,
    driftY: 12,
    sway: 0.02,
    speed: 0.46,
    phase: 3.4,
    lighthouse: { x: 0.78, y: 0.26, beamLength: 180, beamWidth: 48, phase: 2.2 },
    lights: [
      { x: 0.78, y: 0.25, size: 3.8, phase: 0.9 },
      { x: 0.63, y: 0.24, size: 2.3, phase: 1.9 },
      { x: 0.69, y: 0.25, size: 2.2, phase: 2.9 },
    ],
  },
];

function drawHangar(
  c: Container,
  hangarX: number,
  opts: {
    wallColor: number;
    roofColor: number;
    label: string;
    labelColor: number;
  },
): void {
  const phW = 150;
  const phH = 95;
  const phTop = GROUND_Y - phH;
  const phLeft = hangarX - phW / 2;
  
  const wall = new Graphics()
    .rect(phLeft, phTop, phW, phH)
    .fill(opts.wallColor)
    .stroke({ color: 0x000000, width: 2 });
    
  // Door
  const doorW = 56;
  const doorH = 62;
  const door = new Graphics()
    .rect(phLeft + (phW - doorW) / 2, GROUND_Y - doorH, doorW, doorH)
    .fill(0x13100c)
    .stroke({ color: 0x3a332a, width: 2 });
    
  // Roof triangle
  const roof = new Graphics()
    .moveTo(phLeft - 10, phTop)
    .lineTo(phLeft + phW / 2, phTop - 32)
    .lineTo(phLeft + phW + 10, phTop)
    .closePath()
    .fill(opts.roofColor)
    .stroke({ color: 0x000000, width: 2 });
    
  c.addChild(wall, roof, door);

  const labelStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 36,
    fill: opts.labelColor,
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 3 },
  });
  const label = new Text({ text: opts.label, style: labelStyle });
  label.x = hangarX - label.width / 2;
  label.y = phTop + 6;
  c.addChild(label);
}

export function createSkyBackground(
  width: number,
  height: number,
  themeId: SkyThemeId = 'noon',
  hideGround: boolean = false,
): SkyBackgroundHandle {
  const c = new Container();
  const cfg = THEMES[themeId];

  // 1. Sky Gradient Layers
  const skyTop = new Graphics().rect(0, 0, width, height * 0.35).fill(cfg.skyTop);
  const skyMid = new Graphics().rect(0, height * 0.35, width, height * 0.35).fill(cfg.skyMid);
  const skyLow = new Graphics().rect(0, height * 0.7, width, GROUND_Y - height * 0.7).fill(cfg.skyLow);
  c.addChild(skyTop, skyMid, skyLow);

  const skyImage = new TilingSprite({
    texture: Texture.from(SKY_IMAGE_BY_THEME[themeId]),
    width: width,
    height: height,
  });
  c.addChild(skyImage);

  const storySkySoftener = hideGround ? makeStorySkySoftener(width, height, cfg) : null;
  if (storySkySoftener) c.addChild(storySkySoftener);

  // Faint ceiling hint
  const ceiling = new Graphics()
    .rect(0, CEILING_Y, width, 18)
    .fill({ color: themeId === 'night' ? 0x00ffff : 0xff5555, alpha: 0.15 });
  c.addChild(ceiling);

  // 2. Stars (for twilight and night)
  const starsContainer = new Container();
  c.addChild(starsContainer);
  const stars: { g: Graphics; baseAlpha: number; speed: number; phase: number }[] = [];
  
  if (themeId === 'twilight' || themeId === 'night') {
    const starCount = themeId === 'night' ? 60 : 25;
    for (let i = 0; i < starCount; i++) {
      const g = new Graphics()
        .circle(0, 0, 1.2 + Math.random() * 1.5)
        .fill(0xffffff);
      g.x = Math.random() * width;
      g.y = Math.random() * height * 0.6;
      const baseAlpha = 0.3 + Math.random() * 0.7;
      g.alpha = baseAlpha;
      starsContainer.addChild(g);
      stars.push({
        g,
        baseAlpha,
        speed: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  const scenicContainer = new Container();
  scenicContainer.visible = !hideGround;
  c.addChild(scenicContainer);
  const scenicSprites = SCENIC_ASSETS.map((asset) => {
    const sprite = Sprite.from(asset.url);
    const lightsG = new Graphics();
    const beamG = new Graphics();
    sprite.anchor.set(0.5);
    const scale = asset.width / asset.sourceW;
    sprite.scale.set(asset.flipX ? -scale : scale, scale);
    sprite.alpha = asset.alpha;
    sprite.x = asset.x * width;
    sprite.y = asset.y * height;
    beamG.blendMode = 'add';
    lightsG.blendMode = 'add';
    scenicContainer.addChild(sprite, beamG, lightsG);
    return {
      ...asset,
      sprite,
      beamG,
      lightsG,
      displayH: asset.sourceH * scale,
      baseX: asset.x * width,
      baseY: asset.y * height,
    };
  });

  const battleContainer = new Container();
  battleContainer.alpha = themeId === 'night' ? 0.7 : 0.58;
  battleContainer.visible = !hideGround;
  c.addChild(battleContainer);
  const battleBeamContainer = new Container();
  battleContainer.addChild(battleBeamContainer);
  const battleGroups: BattleGroup[] = [
    {
      ship: Sprite.from('/assets/biplanes/enemy_airship_2.png'),
      beam: new Graphics(),
      baseX: width * 0.34,
      baseY: height * 0.23,
      drift: 18,
      speed: 0.08,
      phase: 0.4,
      scale: 0.28,
      flipX: true,
      dots: [],
    },
    {
      ship: Sprite.from('/assets/biplanes/enemy_airship_1.png'),
      beam: new Graphics(),
      baseX: width * 0.64,
      baseY: height * 0.29,
      drift: 24,
      speed: 0.06,
      phase: 2.2,
      scale: 0.16,
      flipX: true,
      dots: [],
    },
  ];

  for (let i = 0; i < battleGroups.length; i++) {
    const group = battleGroups[i]!;
    group.ship.anchor.set(0.5);
    group.ship.alpha = i === 0 ? 0.42 : 0.34;
    group.ship.scale.set(group.flipX ? -group.scale : group.scale, group.scale);
    group.beam.blendMode = 'add';
    battleBeamContainer.addChild(group.beam);
    battleContainer.addChild(group.ship);

    for (let k = 0; k < 10; k++) {
      const dot = new Graphics()
        .moveTo(-3, 0).lineTo(3, 0).stroke({ color: k % 2 === 0 ? 0x101826 : 0x7b1b1b, width: 1.4 })
        .rect(-1.5, -1, 3, 2).fill(k % 2 === 0 ? 0x182844 : 0x8e2424);
      dot.alpha = 0.86;
      battleContainer.addChild(dot);
      group.dots.push({
        g: dot,
        radius: 50 + (k % 5) * 15,
        speed: 0.5 + (k % 5) * 0.09,
        phase: k * 0.78 + i,
        side: k % 2 === 0 ? 1 : -1,
      });
    }
  }

  const battleShots: BattleShot[] = [];
  const battleFlashes: BattleFlash[] = [];
  let nextBattleShot = 0.4;
  let nextBattleFlash = 1.1;

  // 3. Far Parallax Floating Islands
  const farIslandsContainer = new Container();
  farIslandsContainer.alpha = 0.16;
  c.addChild(farIslandsContainer);
  
  interface IslandData {
    x: number;
    y: number;
    w: number;
    h: number;
    vines: { length: number; segmentCount: number; xOffset: number; phase: number }[];
    g: Graphics;
    vinesG?: Graphics;
    rimG?: Graphics;
    beacon: Graphics | null;
  }

  const farIslands: IslandData[] = [];
  const farIslandConfigs: { x: number; y: number; w: number; h: number }[] = [];

  for (const iconf of farIslandConfigs) {
    const island = new Container();
    const body = new Graphics();
    
    // Draw rocky silhouette
    body.moveTo(-iconf.w / 2, 0);
    // Flat/organic bumpy top
    body.bezierCurveTo(-iconf.w / 3, -8, -iconf.w / 6, 4, 0, -5);
    body.bezierCurveTo(iconf.w / 6, -10, iconf.w / 3, 2, iconf.w / 2, 0);
    // Root pointing down
    body.bezierCurveTo(iconf.w / 3, iconf.h / 3, iconf.w / 5, iconf.h, 0, iconf.h);
    body.bezierCurveTo(-iconf.w / 5, iconf.h, -iconf.w / 3, iconf.h / 3, -iconf.w / 2, 0);
    body.closePath().fill(cfg.islandFarColor);
    island.addChild(body);

    // Blinking beacon on far island peaks
    let beacon: Graphics | null = null;
    if (Math.random() > 0.3) {
      beacon = new Graphics().circle(0, -8, 2.5).fill(0xff3333);
      island.addChild(beacon);
    }

    const rimG = new Graphics()
      .moveTo(-iconf.w / 2, 0)
      .bezierCurveTo(-iconf.w / 3, -8, -iconf.w / 6, 4, 0, -5)
      .bezierCurveTo(iconf.w / 6, -10, iconf.w / 3, 2, iconf.w / 2, 0)
      .stroke({ color: 0xccf5ff, width: 1.5, alpha: 0.85 });
    rimG.blendMode = 'add';
    rimG.visible = false;
    island.addChild(rimG);

    island.x = iconf.x;
    island.y = iconf.y;
    farIslandsContainer.addChild(island);
    farIslands.push({ x: iconf.x, y: iconf.y, w: iconf.w, h: iconf.h, vines: [], g: body, rimG, beacon });
  }

  // 4. God Rays / Searchlights
  const godRaysContainer = new Container();
  c.addChild(godRaysContainer);
  const rays: { g: Graphics; baseAlpha: number; speed: number; phase: number; baseAngle: number }[] = [];
  const enableProceduralRays = false;

  if (enableProceduralRays && themeId !== 'night') {
    // Elegant pulsing god rays
    const rayCount = 4;
    const raySourceX = width * 0.2;
    const raySourceY = -50;
    
    for (let i = 0; i < rayCount; i++) {
      const g = new Graphics();
      const baseAlpha = cfg.godRayAlpha * (0.6 + Math.random() * 0.5);
      
      const widthFar = 160 + Math.random() * 120;
      const angleRad = (38 + i * 15 + Math.random() * 6) * (Math.PI / 180);
      const length = 1100;
      
      const targetX = raySourceX + Math.cos(angleRad) * length;
      const targetY = raySourceY + Math.sin(angleRad) * length;
      
      const perpX = -Math.sin(angleRad) * (widthFar / 2);
      const perpY = Math.cos(angleRad) * (widthFar / 2);
      
      g.moveTo(raySourceX, raySourceY)
       .lineTo(targetX + perpX, targetY + perpY)
       .lineTo(targetX - perpX, targetY - perpY)
       .closePath()
       .fill({ color: cfg.godRayColor, alpha: baseAlpha });
      
      godRaysContainer.addChild(g);
      rays.push({
        g,
        baseAlpha,
        speed: 0.5 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        baseAngle: angleRad,
      });
    }
  } else if (enableProceduralRays) {
    // Night Ambush sweeping searchlight beams
    const searchlightCount = 2;
    const slPositions = [PLAYER_HANGAR_X + 120, ENEMY_HANGAR_X - 120];
    
    for (let i = 0; i < searchlightCount; i++) {
      const g = new Graphics();
      const baseAlpha = cfg.godRayAlpha;
      godRaysContainer.addChild(g);
      rays.push({
        g,
        baseAlpha,
        speed: 0.8 + i * 0.4,
        phase: i * Math.PI * 0.5,
        baseAngle: slPositions[i] ?? 0, // abuse variable to store origin X coordinate
      });
    }
  }

  // 5. Mid Parallax Floating Islands (richer, vines wave)
  const midIslandsContainer = new Container();
  midIslandsContainer.alpha = 0.2;
  c.addChild(midIslandsContainer);
  const midIslands: IslandData[] = [];
  const midIslandConfigs: { x: number; y: number; w: number; h: number }[] = [];

  for (const iconf of midIslandConfigs) {
    const island = new Container();
    const body = new Graphics();
    
    body.moveTo(-iconf.w / 2, 0);
    body.bezierCurveTo(-iconf.w / 3, -12, -iconf.w / 6, 6, 0, -8);
    body.bezierCurveTo(iconf.w / 6, -14, iconf.w / 3, 4, iconf.w / 2, 0);
    body.bezierCurveTo(iconf.w / 3.5, iconf.h / 3, iconf.w / 4, iconf.h, 0, iconf.h);
    body.bezierCurveTo(-iconf.w / 4, iconf.h, -iconf.w / 3.5, iconf.h / 3, -iconf.w / 2, 0);
    body.closePath().fill(cfg.islandMidColor);
    island.addChild(body);

    const vinesG = new Graphics();
    island.addChild(vinesG);

    // Blinking peak beacon
    const beacon = new Graphics().circle(0, -12, 3.5).fill(0xff3333);
    island.addChild(beacon);

    // Setup 3 waving vines hanging from each mid island
    const vines: IslandData['vines'] = [];
    const vineOffsets = [-iconf.w / 3, 0, iconf.w / 3.5];
    for (let k = 0; k < 3; k++) {
      vines.push({
        length: 22 + Math.random() * 26,
        segmentCount: 4,
        xOffset: vineOffsets[k] ?? 0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const rimG = new Graphics()
      .moveTo(-iconf.w / 2, 0)
      .bezierCurveTo(-iconf.w / 3, -12, -iconf.w / 6, 6, 0, -8)
      .bezierCurveTo(iconf.w / 6, -14, iconf.w / 3, 4, iconf.w / 2, 0)
      .stroke({ color: 0xccf5ff, width: 2.2, alpha: 0.85 });
    rimG.blendMode = 'add';
    rimG.visible = false;
    island.addChild(rimG);

    island.x = iconf.x;
    island.y = iconf.y;
    midIslandsContainer.addChild(island);
    midIslands.push({ x: iconf.x, y: iconf.y, w: iconf.w, h: iconf.h, vines, g: body, vinesG, rimG, beacon });
  }

  // 6. Clouds Layer (cream cloud puffs with darker underbellies)
  const cloudsContainer = new Container();
  c.addChild(cloudsContainer);
  const clouds: { container: Container; baseAlpha: number; speed: number; x: number; y: number }[] = [];
  
  for (let i = 0; i < 0; i++) {
    const cloud = new Container();
    const cloudW = 100 + (i * 23) % 60;
    const cloudH = 24 + (i * 7) % 15;
    
    // Draw cloud with warm underbelly
    const shadow = new Graphics()
      .ellipse(0, 4, cloudW, cloudH)
      .fill({ color: themeId === 'noon' ? 0xd0c0a5 : cfg.skyMid, alpha: cfg.cloudAlpha });
    
    const puff = new Graphics()
      .ellipse(0, 0, cloudW - 4, cloudH - 2)
      .ellipse(-15, -4, cloudW * 0.6, cloudH * 0.8)
      .ellipse(15, -6, cloudW * 0.5, cloudH * 0.7)
      .fill({ color: cfg.cloudColor, alpha: cfg.cloudAlpha });
      
    cloud.addChild(shadow, puff);
    cloud.x = (i * width) / 6 + 40;
    cloud.y = height * 0.16 + (i % 2) * 55;
    cloudsContainer.addChild(cloud);
    
    clouds.push({
      container: cloud,
      baseAlpha: cfg.cloudAlpha,
      speed: 8 + (i * 3) % 12, // drift speed in px/sec
      x: cloud.x,
      y: cloud.y,
    });
  }

  // Runway lights
  const runwayLights: Graphics[] = [];
  let towerBeacon: Graphics | null = null;

  if (!hideGround) {
    // 7. Ground Strip
    const groundStrip = new Graphics()
      .rect(0, GROUND_Y, width, height - GROUND_Y)
      .fill(cfg.groundColor)
      .stroke({ color: 0x000000, width: 2 });
    c.addChild(groundStrip);

    const grass = new Graphics()
      .rect(0, GROUND_Y, width, 8)
      .fill(cfg.grassColor)
      .stroke({ color: 0x000000, width: 1.5 });
    c.addChild(grass);

    // 8. Runway Dashes
    const runwayY = GROUND_Y + (height - GROUND_Y) * 0.6;
    const dashLen = 60;
    const dashGap = 40;
    
    // Neon edge guides for runway in Night Ambush
    if (themeId === 'night') {
      const edgeGuide = new Graphics()
        .rect(0, runwayY - 8, width, 1.5)
        .rect(0, runwayY + 8, width, 1.5)
        .fill({ color: 0x117766, alpha: 0.25 });
      c.addChild(edgeGuide);
    }

    for (let x = 20; x < width - 20; x += dashLen + dashGap) {
      const seg = new Graphics()
        .rect(x, runwayY - 2, dashLen, 4)
        .fill({ color: cfg.runwayDashColor, alpha: cfg.runwayDashAlpha });
      c.addChild(seg);
    }

    const lightCount = 12;
    const lightSpacing = width / (lightCount - 1);
    for (let i = 0; i < lightCount; i++) {
      const rx = i * lightSpacing;
      const ry = GROUND_Y + 1;
      // Alternate green landing entry, yellow centers, red end
      let color = 0xffdf55; // Warm yellow
      if (i <= 1) color = 0x27ae60; // Green entry
      else if (i >= lightCount - 2) color = 0xc0392b; // Red stop
      
      const bulb = new Graphics()
        .circle(0, 0, 3)
        .fill(color);
      bulb.x = rx;
      bulb.y = ry;
      c.addChild(bulb);
      runwayLights.push(bulb);
    }

    // 9. Background silhouette buildings
    const hangarSpots = [
      { x: width * 0.36, w: 90,  h: 42 },
      { x: width * 0.62, w: 130, h: 58 },
    ];
    for (const h of hangarSpots) {
      const top = GROUND_Y - h.h;
      const body = new Graphics().rect(h.x, top, h.w, h.h).fill(cfg.islandMidColor);
      const roof = new Graphics()
        .moveTo(h.x - 6, top)
        .lineTo(h.x + h.w / 2, top - 22)
        .lineTo(h.x + h.w + 6, top)
        .closePath()
        .fill(cfg.islandFarColor);
      c.addChild(body, roof);
    }

    // 10. Core Hangar Silhouettes
    // Player hangar — warm red/orange, white "H".
    drawHangar(c, PLAYER_HANGAR_X, {
      wallColor: cfg.hangarWallColor,
      roofColor: cfg.hangarRoofColor,
      label: 'H',
      labelColor: 0xffffff,
    });

    // Enemy hangar — cold steel blue with darker roof and red "X".
    drawHangar(c, ENEMY_HANGAR_X, {
      wallColor: cfg.enemyHangarWallColor,
      roofColor: cfg.enemyHangarRoofColor,
      label: 'X',
      labelColor: 0xff4040,
    });

    // 11. Control tower with blinking red beacon
    const towerX = width * 0.5 - 18;
    const towerH = 110;
    
    const tower = new Graphics()
      .rect(towerX, GROUND_Y - towerH, 36, towerH)
      .fill(cfg.islandMidColor);
      
    const cabin = new Graphics()
      .rect(towerX - 8, GROUND_Y - towerH - 24, 52, 24)
      .fill(cfg.islandFarColor);
      
    const antenna = new Graphics()
      .rect(towerX + 16, GROUND_Y - towerH - 50, 4, 28)
      .fill(0x05050a);
      
    c.addChild(tower, cabin, antenna);

    towerBeacon = new Graphics()
      .circle(towerX + 18, GROUND_Y - towerH - 50, 4)
      .fill(0xff2222);
    c.addChild(towerBeacon);
  }

  // 11. Foliage container for falling leaves (Phase 4.2)
  const foliageContainer = new Container();
  c.addChild(foliageContainer);

  interface Leaf {
    g: Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    phase: number;
    rotSpeed: number;
  }
  const leaves: Leaf[] = [];

  return {
    container: c,
    update(dt: number, timeSec: number, playerX: number, playerY: number, lightningActive?: boolean) {
      // 1. Position and tile the seamless sky TilingSprite
      skyImage.x = playerX - width / 2;
      if (storySkySoftener) storySkySoftener.x = skyImage.x;
      
      // Adapt tile scale once the texture is loaded. Fit Y to the full height
      // (so the horizon/sun aren't cropped) and cover the full sprite width on X
      // — a non-panoramic (e.g. square) sky would otherwise repeat and show a
      // vertical tiling seam mid-screen. The 1.02 gives a hair of overscan so
      // the wrap sits just past the right edge.
      if (skyImage.texture.width > 1) {
        const scaleY = height / skyImage.texture.height;
        const scaleX = Math.max(scaleY, (width * 1.02) / skyImage.texture.width);
        if (
          Math.abs(skyImage.tileScale.x - scaleX) > 0.001
          || Math.abs(skyImage.tileScale.y - scaleY) > 0.001
        ) {
          skyImage.tileScale.set(scaleX, scaleY);
        }
      }

      // Smooth horizontal parallax scrolling for the tiled sky
      if (hideGround) {
        skyImage.tilePosition.x = 0;
      } else {
        const skyParallaxFactor = 0.03; // Very slow scrolling for distant sky elements
        skyImage.tilePosition.x = -playerX * (1 - skyParallaxFactor);
      }

      // Keep the faint ceiling hint centered relative to the camera viewport
      ceiling.x = playerX - width / 2;

      // Slow continuous clouds drift
      for (const cloud of clouds) {
        cloud.x -= cloud.speed * dt;
        if (cloud.x < -150) {
          cloud.x = width + 150;
        }
        cloud.container.x = cloud.x;
      }

      // Parallax calculations based on camera/player position
      // Calculate a shift delta from the center of the viewport/world
      const shiftX = playerX - width / 2;
      const shiftY = playerY - 1080 / 2;

      // Apply subtle horizontal/vertical shift to parallax containers
      // Far islands move very slightly
      farIslandsContainer.x = -shiftX * 0.03;
      farIslandsContainer.y = -shiftY * 0.01;

      // Mid islands move slightly more
      midIslandsContainer.x = -shiftX * 0.08;
      midIslandsContainer.y = -shiftY * 0.035;

      if (!hideGround) {
        for (const asset of scenicSprites) {
        const bob = Math.sin(timeSec * asset.speed + asset.phase);
        const slowBob = Math.sin(timeSec * asset.speed * 0.63 + asset.phase * 1.7);
        asset.sprite.x = asset.baseX - shiftX * asset.parallax + bob * asset.driftX;
        asset.sprite.y = asset.baseY - shiftY * asset.parallax * 0.45 + slowBob * asset.driftY;
        asset.sprite.rotation = bob * asset.sway;
        asset.sprite.tint = themeId === 'night' && asset.url.includes('/island_') ? 0x2f3b4d : 0xffffff;

        const decorX = asset.sprite.x;
        const decorY = asset.sprite.y;
        const decorRot = asset.sprite.rotation;
        asset.beamG.x = decorX;
        asset.beamG.y = decorY;
        asset.beamG.rotation = decorRot;
        asset.lightsG.x = decorX;
        asset.lightsG.y = decorY;
        asset.lightsG.rotation = decorRot;

        asset.beamG.clear();
        if (asset.lighthouse) {
          const localX = (asset.lighthouse.x - 0.5) * asset.width;
          const localY = (asset.lighthouse.y - 0.5) * asset.displayH;
          const sweep = Math.sin(timeSec * 0.95 + asset.lighthouse.phase);
          const dir = sweep >= 0 ? 1 : -1;
          const visibility = 0.25 + 0.75 * Math.abs(sweep);
          const length = asset.lighthouse.beamLength;
          const beamWidth = asset.lighthouse.beamWidth * (0.65 + 0.35 * visibility);
          const beamAlpha = themeId === 'night' ? 0.22 : 0.1;
          const tipX = localX + dir * length;
          asset.beamG
            .moveTo(localX, localY)
            .lineTo(tipX, localY - beamWidth * 0.5)
            .lineTo(tipX, localY + beamWidth * 0.5)
            .closePath()
            .fill({ color: themeId === 'night' ? 0xffd27a : 0xfff1c0, alpha: beamAlpha * visibility });
        }

        asset.lightsG.clear();
        if (themeId === 'night' && asset.lights) {
          for (const light of asset.lights) {
            const lx = (light.x - 0.5) * asset.width;
            const ly = (light.y - 0.5) * asset.displayH;
            const pulse = 0.55 + 0.45 * Math.sin(timeSec * 2.4 + light.phase);
            asset.lightsG
              .circle(lx, ly, light.size * 2.7).fill({ color: 0xff9f36, alpha: 0.16 * pulse })
              .circle(lx, ly, light.size).fill({ color: 0xffd477, alpha: 0.8 * pulse });
          }
        }
      }

      for (const group of battleGroups) {
        const glide = Math.sin(timeSec * group.speed + group.phase);
        const shipX = group.baseX + glide * group.drift;
        const shipY = group.baseY + Math.sin(timeSec * group.speed * 1.7 + group.phase) * 5;
        group.ship.x = shipX;
        group.ship.y = shipY;
        group.ship.rotation = Math.sin(timeSec * group.speed * 1.2 + group.phase) * 0.004;

        group.beam.clear();
        if (themeId === 'night') {
          const sweep = Math.sin(timeSec * 0.42 + group.phase) * 0.72;
          const originX = shipX + (group.flipX ? 95 : -95) * group.scale * 2.8;
          const originY = shipY - 24;
          const length = 620;
          const angle = -Math.PI * 0.5 + sweep;
          const tipX = originX + Math.cos(angle) * length;
          const tipY = originY + Math.sin(angle) * length;
          const widthFar = 120;
          const perpX = -Math.sin(angle) * widthFar * 0.5;
          const perpY = Math.cos(angle) * widthFar * 0.5;
          group.beam.moveTo(originX, originY)
            .lineTo(tipX + perpX, tipY + perpY)
            .lineTo(tipX - perpX, tipY - perpY)
            .closePath()
            .fill({ color: 0xb8d7ff, alpha: 0.1 + 0.035 * Math.sin(timeSec * 2 + group.phase) });
        }

        for (const dot of group.dots) {
          const a = timeSec * dot.speed * dot.side + dot.phase;
          dot.g.x = shipX + Math.cos(a) * dot.radius * 1.55;
          dot.g.y = shipY + Math.sin(a * 1.3) * dot.radius * 0.62;
          dot.g.alpha = 0.48 + 0.28 * Math.sin(timeSec * 2.2 + dot.phase);
          dot.g.rotation = a * dot.side;
        }
      }

      nextBattleShot -= dt;
      if (nextBattleShot <= 0 && battleGroups.length > 0) {
        const group = battleGroups[Math.floor(timeSec * 10) % battleGroups.length]!;
        const burstCount = 2 + Math.floor(Math.random() * 2);
        for (let n = 0; n < burstCount; n++) {
          const dir = Math.sin(timeSec * 1.7 + n) > 0 ? 1 : -1;
          const shot = new Graphics()
            .moveTo(-5, 0).lineTo(5, 0).stroke({ color: 0xffd37a, width: 1.4 })
            .circle(0, 0, 1.8).fill(0xfff0ae);
          shot.alpha = 0.9;
          battleContainer.addChild(shot);
          battleShots.push({
            g: shot,
            x: group.ship.x + dir * (60 + n * 8),
            y: group.ship.y + 10 + n * 8,
            vx: dir * (110 + 30 * Math.sin(timeSec + n)),
            vy: -16 + 28 * Math.sin(timeSec * 0.7 + n),
            life: 1.35,
            maxLife: 1.35,
          });
        }
        nextBattleShot = 0.18 + Math.random() * 0.22;
      }

      for (let i = battleShots.length - 1; i >= 0; i--) {
        const shot = battleShots[i]!;
        shot.life -= dt;
        if (shot.life <= 0) {
          if (shot.g.parent) shot.g.parent.removeChild(shot.g);
          battleShots.splice(i, 1);
          continue;
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.g.x = shot.x;
        shot.g.y = shot.y;
        shot.g.rotation = Math.atan2(shot.vy, shot.vx);
        shot.g.alpha = 0.82 * (shot.life / shot.maxLife);
      }

      nextBattleFlash -= dt;
      if (nextBattleFlash <= 0 && battleGroups.length > 0) {
        const group = battleGroups[Math.floor(timeSec * 7 + 1) % battleGroups.length]!;
        const flash = new Graphics();
        battleContainer.addChild(flash);
        battleFlashes.push({
          g: flash,
          x: group.ship.x + (Math.random() - 0.5) * 150,
          y: group.ship.y + (Math.random() - 0.5) * 80,
          life: 0.42,
          maxLife: 0.42,
        });
        nextBattleFlash = 0.55 + Math.random() * 0.85;
      }

      for (let i = battleFlashes.length - 1; i >= 0; i--) {
        const flash = battleFlashes[i]!;
        flash.life -= dt;
        if (flash.life <= 0) {
          if (flash.g.parent) flash.g.parent.removeChild(flash.g);
          battleFlashes.splice(i, 1);
          continue;
        }
        const t = flash.life / flash.maxLife;
        const r = 18 * (1 - t) + 4;
        flash.g.clear()
          .circle(flash.x, flash.y, r * 0.45).fill({ color: 0xfff0b0, alpha: 0.5 * t })
          .circle(flash.x, flash.y, r).fill({ color: 0xff5a2e, alpha: 0.18 * t });
      }
      } // End of if (!hideGround)

      // Pulse and wrap stars to keep them within the camera viewport
      const screenLeft = playerX - width / 2;
      for (const star of stars) {
        let localX = star.g.x - screenLeft;
        localX = ((localX % width) + width) % width;
        star.g.x = screenLeft + localX;
        star.g.alpha = star.baseAlpha * (0.6 + 0.4 * Math.sin(timeSec * star.speed + star.phase));
      }

      // Animate blinking island and tower beacons
      if (towerBeacon) {
        towerBeacon.alpha = 0.2 + 0.8 * Math.abs(Math.sin(timeSec * 5));
      }
      for (const island of farIslands) {
        if (island.beacon) {
          island.beacon.alpha = 0.1 + 0.9 * Math.abs(Math.sin(timeSec * 4 + island.x));
        }
      }
      for (const island of midIslands) {
        if (island.beacon) {
          island.beacon.alpha = 0.1 + 0.9 * Math.abs(Math.sin(timeSec * 4.5 + island.x));
        }
      }

      // Wave hanging roots and vines dynamically on mid islands
      for (const island of midIslands) {
        if (!island.vinesG) continue;
        // Clear and redraw ONLY the vines! The rock body (island.g) remains static and cached.
        const vg = island.vinesG;
        vg.clear();

        // Draw waving vines!
        for (const vine of island.vines) {
          // Vine roots start at vine.xOffset, and trail down vine.length
          const startX = vine.xOffset;
          const startY = island.h * 0.3; // part way down the rock
          
          vg.moveTo(startX, startY);
          
          // Draw wave using Bezier segments
          // Simple snake outline waving in wind
          const waveAmp = 4 * Math.sin(timeSec * 1.5 + vine.phase);
          const cp1x = startX + waveAmp;
          const cp1y = startY + vine.length * 0.35;
          const cp2x = startX - waveAmp * 0.8;
          const cp2y = startY + vine.length * 0.7;
          const endX = startX + waveAmp * 0.4;
          const endY = startY + vine.length;
          
          vg.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
          vg.stroke({ color: cfg.islandFarColor, width: 1.8 });
        }
      }

      // 12. Breathe God Rays or Sweep Searchlights
      if (themeId !== 'night') {
        for (const ray of rays) {
          ray.g.alpha = ray.baseAlpha * (0.75 + 0.25 * Math.sin(timeSec * ray.speed + ray.phase));
        }
      } else {
        // Night Ambush sweeping searchlight beams
        for (let i = 0; i < rays.length; i++) {
          const ray = rays[i];
          if (!ray) continue;
          const originX = ray.baseAngle; // stored coordinate
          const originY = GROUND_Y;
          
          ray.g.clear();
          
          // Calculate sweep angle dynamically
          const sweepAngle = Math.sin(timeSec * 0.3 + ray.phase) * 0.55; // range ~-31 to +31 degrees
          const angleRad = Math.PI * 1.5 + sweepAngle; // pointing straight up plus sweep
          const length = 1200;
          const widthFar = 110;
          
          const targetX = originX + Math.cos(angleRad) * length;
          const targetY = originY + Math.sin(angleRad) * length;
          
          const perpX = -Math.sin(angleRad) * (widthFar / 2);
          const perpY = Math.cos(angleRad) * (widthFar / 2);
          
          // Draw searchlight beam polygon with alpha gradient (drawn as poly)
          ray.g.moveTo(originX, originY)
               .lineTo(targetX + perpX, targetY + perpY)
               .lineTo(targetX - perpX, targetY - perpY)
               .closePath()
               .fill({ color: cfg.godRayColor, alpha: ray.baseAlpha * (0.8 + 0.2 * Math.abs(Math.sin(timeSec * 3 + i))) });
        }
      }

      // Runway light breathing
      const bulbAlpha = 0.55 + 0.45 * Math.sin(timeSec * 2.2);
      for (const bulb of runwayLights) {
        bulb.alpha = bulbAlpha;
      }

      // Lightning flash Rim Lighting on floating islands (Phase 4.1)
      const rimVisible = !!lightningActive;
      const rimAlpha = rimVisible ? 0.45 + 0.55 * Math.random() : 0;
      for (const island of farIslands) {
        if (island.rimG) {
          island.rimG.visible = rimVisible;
          if (rimVisible) island.rimG.alpha = rimAlpha;
        }
      }
      for (const island of midIslands) {
        if (island.rimG) {
          island.rimG.visible = rimVisible;
          if (rimVisible) island.rimG.alpha = rimAlpha;
        }
      }

      // Leaf drift foliage particle system (Phase 4.2)
      if (themeId !== 'night' && Math.random() < 0.04 && midIslands.length > 0) {
        const island = midIslands[Math.floor(Math.random() * midIslands.length)]!;
        const leaf = new Graphics();
        const leafColor = themeId === 'sunset' ? 0xe67e22 : 0x7cb342;
        leaf.ellipse(0, 0, 3.2, 1.6).fill(leafColor);
        leaf.x = island.x + (Math.random() - 0.5) * island.w * 0.65;
        leaf.y = island.y + island.h * 0.35;
        foliageContainer.addChild(leaf);
        
        leaves.push({
          g: leaf,
          x: leaf.x,
          y: leaf.y,
          vx: -24 - Math.random() * 26,
          vy: 8 + Math.random() * 14,
          life: 5.2,
          maxLife: 5.2,
          phase: Math.random() * Math.PI * 2,
          rotSpeed: 1.5 + Math.random() * 3.5
        });
      }

      for (let i = leaves.length - 1; i >= 0; i--) {
        const leaf = leaves[i]!;
        leaf.life -= dt;
        if (leaf.life <= 0) {
          if (leaf.g.parent) leaf.g.parent.removeChild(leaf.g);
          leaves.splice(i, 1);
          continue;
        }

        leaf.x += leaf.vx * dt;
        leaf.y += leaf.vy * dt;

        // Apply sinusoidal sway (leaves planning in Y/X wind plane)
        leaf.g.x = leaf.x + Math.sin(timeSec * 2.8 + leaf.phase) * 12;
        leaf.g.y = leaf.y;
        leaf.g.rotation += leaf.rotSpeed * dt;
        leaf.g.alpha = Math.min(1, leaf.life / 0.8);
      }
    },
  };
}
