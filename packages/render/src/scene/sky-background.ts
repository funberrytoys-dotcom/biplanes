import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  GROUND_Y,
  CEILING_Y,
  PLAYER_HANGAR_X,
  ENEMY_HANGAR_X,
} from '@biplanes/shared';

export type SkyThemeId = 'noon' | 'sunset' | 'twilight' | 'night';

export interface SkyBackgroundHandle {
  container: Container;
  update: (dt: number, timeSec: number, playerX: number, playerY: number) => void;
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
): SkyBackgroundHandle {
  const c = new Container();
  const cfg = THEMES[themeId];

  // 1. Sky Gradient Layers
  const skyTop = new Graphics().rect(0, 0, width, height * 0.35).fill(cfg.skyTop);
  const skyMid = new Graphics().rect(0, height * 0.35, width, height * 0.35).fill(cfg.skyMid);
  const skyLow = new Graphics().rect(0, height * 0.7, width, GROUND_Y - height * 0.7).fill(cfg.skyLow);
  c.addChild(skyTop, skyMid, skyLow);

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

  // 3. Far Parallax Floating Islands
  const farIslandsContainer = new Container();
  c.addChild(farIslandsContainer);
  
  interface IslandData {
    x: number;
    y: number;
    w: number;
    h: number;
    vines: { length: number; segmentCount: number; xOffset: number; phase: number }[];
    g: Graphics;
    vinesG?: Graphics;
    beacon: Graphics | null;
  }

  const farIslands: IslandData[] = [];
  const farIslandConfigs = [
    { x: width * 0.15, y: height * 0.22, w: 110, h: 45 },
    { x: width * 0.52, y: height * 0.16, w: 140, h: 55 },
    { x: width * 0.82, y: height * 0.28, w: 95,  h: 40 },
  ];

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

    island.x = iconf.x;
    island.y = iconf.y;
    farIslandsContainer.addChild(island);
    farIslands.push({ x: iconf.x, y: iconf.y, w: iconf.w, h: iconf.h, vines: [], g: body, beacon });
  }

  // 4. God Rays / Searchlights
  const godRaysContainer = new Container();
  c.addChild(godRaysContainer);
  const rays: { g: Graphics; baseAlpha: number; speed: number; phase: number; baseAngle: number }[] = [];

  if (themeId !== 'night') {
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
  } else {
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
  c.addChild(midIslandsContainer);
  const midIslands: IslandData[] = [];
  const midIslandConfigs = [
    { x: width * 0.32, y: height * 0.38, w: 180, h: 75 },
    { x: width * 0.74, y: height * 0.44, w: 210, h: 90 },
  ];

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

    island.x = iconf.x;
    island.y = iconf.y;
    midIslandsContainer.addChild(island);
    midIslands.push({ x: iconf.x, y: iconf.y, w: iconf.w, h: iconf.h, vines, g: body, vinesG, beacon });
  }

  // 6. Clouds Layer (cream cloud puffs with darker underbellies)
  const cloudsContainer = new Container();
  c.addChild(cloudsContainer);
  const clouds: { container: Container; baseAlpha: number; speed: number; x: number; y: number }[] = [];
  
  for (let i = 0; i < 6; i++) {
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

  // Runway lights
  const runwayLights: Graphics[] = [];
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

  const towerBeacon = new Graphics()
    .circle(towerX + 18, GROUND_Y - towerH - 50, 4)
    .fill(0xff2222);
  c.addChild(towerBeacon);

  return {
    container: c,
    update(dt: number, timeSec: number, playerX: number, playerY: number) {
      // Slow continuous clouds drift
      for (const cloud of clouds) {
        cloud.x -= cloud.speed * dt;
        if (cloud.x < -150) {
          cloud.x = width + 150;
        }
        cloud.container.x = cloud.x;
      }

      // Parallax calculations based on player position
      // The player range is from X: 0 to WORLD_WIDTH (1920).
      // Calculate a shift delta from the center of the world
      const shiftX = playerX - width / 2;
      const shiftY = playerY - height / 2;

      // Apply subtle horizontal/vertical shift to parallax containers
      // Far islands move very slightly
      farIslandsContainer.x = -shiftX * 0.03;
      farIslandsContainer.y = -shiftY * 0.01;

      // Mid islands move slightly more
      midIslandsContainer.x = -shiftX * 0.08;
      midIslandsContainer.y = -shiftY * 0.035;

      // Pulse stars
      for (const star of stars) {
        star.g.alpha = star.baseAlpha * (0.6 + 0.4 * Math.sin(timeSec * star.speed + star.phase));
      }

      // Animate blinking island and tower beacons
      towerBeacon.alpha = 0.2 + 0.8 * Math.abs(Math.sin(timeSec * 5));
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
    },
  };
}
