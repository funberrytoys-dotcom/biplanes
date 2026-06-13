import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@biplanes/shared';
import type { MissionOnePhase } from './mission-one-controller.js';
import { assetUrl } from '../asset-url.js';

export interface MissionOneSceneHandle {
  container: Container;
  reset: () => void;
  update: (
    dt: number,
    timeSec: number,
    active: boolean,
    routeProgress: number,
    caravanHp: number,
    phase: MissionOnePhase,
    revealAmount: number,
    bossAlive: boolean,
    caravanX?: number,
    cameraX?: number
  ) => void;
}

const ISLAND_FRAME_COUNT = 50;

export function createMissionOneScene(): MissionOneSceneHandle {
  const container = new Container();
  container.visible = false;

  const route = new Graphics();
  const beaconBeam = new Graphics();
  const carrierDeck = new Container();
  const carrierHull = Sprite.from(assetUrl('assets/campaign/airship_sov_large.png'));
  const carrierLights = new Graphics();
  const caravan = Sprite.from(assetUrl('assets/campaign/caravan_sov.png'));
  const farCaravan = Sprite.from(assetUrl('assets/campaign/airship_sov_variant_1.png'));
  const escortCaravan = Sprite.from(assetUrl('assets/campaign/airship_sov_variant_2.png'));
  const crimsonCarrier = Sprite.from(assetUrl('assets/biplanes/enemy_airship_1.png'));
  const secondIsland = Sprite.from(assetUrl('assets/biplanes/island_industrial.png'));
  const thirdIsland = Sprite.from(assetUrl('assets/biplanes/island_oilfield.png'));
  const farIsland = Sprite.from(assetUrl('assets/biplanes/island_player.png'));
  const bossAirship = Sprite.from(assetUrl('assets/biplanes/enemy_airship_2.png'));
  const scarPlane = Sprite.from(assetUrl('assets/campaign/plane_scar.png'));
  const smoke = new Graphics();
  const exitGlow = new Graphics();
  const routeDust = new Graphics();

  const frames = Array.from({ length: ISLAND_FRAME_COUNT }, (_, i) => {
    const frame = String(i + 1).padStart(4, '0');
    return Texture.from(assetUrl(`assets/campaign/island_brynn/frame_${frame}.png`));
  });
  const island = new AnimatedSprite(frames);
  island.animationSpeed = 0.25;
  island.loop = true;
  island.play();

  island.anchor.set(0.5);
  island.scale.set(0.82);
  island.x = WORLD_WIDTH * 0.82;
  island.y = WORLD_HEIGHT * 0.28;
  island.alpha = 0.86;

  caravan.anchor.set(0.5);
  caravan.scale.set(0.28);

  farCaravan.anchor.set(0.5);
  farCaravan.scale.set(0.14);
  farCaravan.alpha = 0.34;

  escortCaravan.anchor.set(0.5);
  escortCaravan.scale.set(0.12);
  escortCaravan.alpha = 0.28;

  crimsonCarrier.anchor.set(0.5);
  crimsonCarrier.scale.set(0.22);
  crimsonCarrier.alpha = 0.0;

  carrierHull.anchor.set(0.5);
  carrierHull.scale.set(0.64);
  carrierHull.x = 360;
  carrierHull.y = WORLD_HEIGHT * 0.54;
  carrierHull.alpha = 0.98;
  carrierDeck.addChild(carrierHull, carrierLights);

  secondIsland.anchor.set(0.5);
  secondIsland.scale.set(0.38);
  secondIsland.alpha = 0.58;

  thirdIsland.anchor.set(0.5);
  thirdIsland.scale.set(0.34);
  thirdIsland.alpha = 0.5;

  farIsland.anchor.set(0.5);
  farIsland.scale.set(0.25);
  farIsland.alpha = 0.26;

  bossAirship.anchor.set(0.5);
  bossAirship.scale.set(0.34);
  bossAirship.visible = false;

  scarPlane.anchor.set(0.5);
  scarPlane.scale.set(0.12);
  scarPlane.visible = false;

  beaconBeam.blendMode = 'add';
  exitGlow.blendMode = 'add';
  smoke.blendMode = 'normal';

  container.addChild(
    route,
    routeDust,
    exitGlow,
    farIsland,
    farCaravan,
    escortCaravan,
    secondIsland,
    thirdIsland,
    island,
    beaconBeam,
    crimsonCarrier,
    carrierDeck,
    caravan,
    bossAirship,
    scarPlane,
    smoke,
  );

  function reset() {
    caravan.alpha = 0.88;
    scarPlane.visible = false;
    bossAirship.visible = false;
    crimsonCarrier.alpha = 0;
    smoke.clear();
    routeDust.clear();
    container.visible = false;
  }

  function drawRoute(routeProgress: number) {
    route.clear()
      .moveTo(WORLD_WIDTH * 0.18, WORLD_HEIGHT * 0.27)
      .bezierCurveTo(WORLD_WIDTH * 0.38, WORLD_HEIGHT * 0.23, WORLD_WIDTH * 0.58, WORLD_HEIGHT * 0.31, WORLD_WIDTH * 0.82, WORLD_HEIGHT * 0.26)
      .stroke({ color: 0xfff4dc, width: 2, alpha: 0.08 });

    const markerX = WORLD_WIDTH * (0.18 + routeProgress * 0.64);
    route.circle(markerX, WORLD_HEIGHT * 0.27, 5).fill({ color: 0xffd173, alpha: 0.42 });
  }

  function updateCaravan(
    timeSec: number,
    routeProgress: number,
    caravanHp: number,
    revealAmount: number,
    caravanX?: number,
    cameraX?: number
  ) {
    const cX = caravanX !== undefined ? caravanX : (WORLD_WIDTH * 0.18 + (WORLD_WIDTH * 0.52) * routeProgress);
    const camX = cameraX !== undefined ? cameraX : WORLD_WIDTH / 2;

    caravan.x = cX;
    caravan.y = WORLD_HEIGHT * 0.31 + Math.sin(timeSec * 0.7) * 8;
    caravan.rotation = Math.sin(timeSec * 0.55) * 0.01;
    caravan.tint = caravanHp < 0.28 ? 0xffb6a0 : 0xffffff;
    caravan.alpha = (caravanHp < 0.16 ? 0.62 + Math.sin(timeSec * 9) * 0.18 : 0.9) * (0.35 + revealAmount * 0.65);

    // Far caravan (parallax)
    const absFarX = 3000 + (cX - 1200) * 0.62;
    farCaravan.x = cameraX !== undefined ? (camX + (absFarX - camX) * 0.25) : WORLD_WIDTH * (0.36 + routeProgress * 0.22);
    farCaravan.y = WORLD_HEIGHT * 0.18 + Math.sin(timeSec * 0.38) * 10;
    farCaravan.alpha = 0.22 + revealAmount * 0.18;
    farCaravan.rotation = Math.sin(timeSec * 0.32) * 0.008;

    escortCaravan.x = caravan.x - 170;
    escortCaravan.y = caravan.y + 64 + Math.sin(timeSec * 0.46) * 9;
    escortCaravan.rotation = Math.sin(timeSec * 0.28) * 0.006;
    escortCaravan.alpha = (0.18 + revealAmount * 0.22) * (caravanHp < 0.2 ? 0.72 : 1);
  }

  function updateSmoke(timeSec: number, caravanHp: number) {
    smoke.clear();
    if (caravanHp > 0.72) return;
    const smokeAlpha = caravanHp < 0.32 ? 0.33 : 0.18;
    const puffCount = caravanHp < 0.32 ? 7 : 4;
    for (let i = 0; i < puffCount; i++) {
      const t = (timeSec * 0.55 + i * 0.19) % 1;
      const x = caravan.x - 115 - t * 50 - i * 4;
      const y = caravan.y + 34 - Math.sin(t * Math.PI) * 28 + i * 2;
      const r = 8 + t * 17;
      smoke.circle(x, y, r).fill({ color: 0x2f3038, alpha: smokeAlpha * (1 - t) });
    }
  }

  function updateCarrier(timeSec: number, phase: MissionOnePhase, revealAmount: number) {
    const launchT = Math.max(0, Math.min(1, timeSec / 9));
    carrierDeck.x = 0;
    carrierDeck.y = Math.sin(timeSec * 0.7) * 6;
    carrierDeck.alpha = Math.max(0, 1 - revealAmount * 0.78);
    carrierHull.rotation = Math.sin(timeSec * 0.44) * 0.006;
    carrierLights.clear();
    const flash = phase === 'launch' ? 0.45 + Math.sin(timeSec * 12) * 0.35 : 0.18;
    carrierLights.circle(210, -86, 11 + launchT * 7).fill({ color: 0xff4a2f, alpha: flash });
    carrierLights.circle(325, -70, 7).fill({ color: 0, alpha: 0.3 + launchT * 0.24 });
    carrierLights
      .moveTo(260, -52)
      .lineTo(430, -84)
      .lineTo(430, -22)
      .closePath()
      .fill({ color: 0xfff4dc, alpha: phase === 'launch' ? 0.08 + launchT * 0.1 : 0.03 });
  }

  function updateRouteProps(timeSec: number, routeProgress: number, revealAmount: number, cameraX?: number) {
    if (cameraX !== undefined) {
      // True 2D Parallax mapping for absolute horizontal level
      
      // 1. Industrial Island (absolute 3500)
      secondIsland.x = 3500;
      secondIsland.y = WORLD_HEIGHT * 0.57 + Math.sin(timeSec * 0.36) * 12;
      secondIsland.rotation = Math.sin(timeSec * 0.22) * 0.01;
      secondIsland.visible = Math.abs(secondIsland.x - cameraX) < 1600;
      secondIsland.alpha = revealAmount * 0.42;

      // 2. Oilfield Island (absolute 7000)
      thirdIsland.x = 7000;
      thirdIsland.y = WORLD_HEIGHT * 0.43 + Math.sin(timeSec * 0.29) * 13;
      thirdIsland.rotation = Math.sin(timeSec * 0.21) * 0.009;
      thirdIsland.visible = Math.abs(thirdIsland.x - cameraX) < 1600;
      thirdIsland.alpha = revealAmount * 0.56;

      // 3. Far Island (scenic background, factor 0.35, absolute 6000)
      farIsland.x = cameraX + (6000 - cameraX) * 0.35;
      farIsland.y = WORLD_HEIGHT * 0.19 + Math.sin(timeSec * 0.22) * 9;
      farIsland.rotation = Math.sin(timeSec * 0.18) * 0.006;
      farIsland.visible = Math.abs(farIsland.x - cameraX) < 1600;
      farIsland.alpha = revealAmount * 0.24;

      // 4. Lighthouse Island (absolute 10500)
      island.x = 10500;
      island.y = WORLD_HEIGHT * 0.28 + Math.sin(timeSec * 0.31) * 11;
      island.rotation = Math.sin(timeSec * 0.26) * 0.012;
      island.visible = Math.abs(island.x - cameraX) < 1600;
      island.alpha = 0.45 + revealAmount * 0.41;

      // 5. Crimson Carrier (absolute 8800)
      crimsonCarrier.x = 8800;
      crimsonCarrier.y = WORLD_HEIGHT * 0.2 + Math.sin(timeSec * 0.42) * 12;
      crimsonCarrier.rotation = Math.sin(timeSec * 0.33) * 0.006;
      crimsonCarrier.visible = Math.abs(crimsonCarrier.x - cameraX) < 1600;
      crimsonCarrier.alpha = Math.max(0, Math.min(0.56, (cameraX - 6000) / 2000 * 0.56));

      routeDust.clear();
      for (let i = 0; i < 7; i++) {
        const t = (routeProgress * 6 + i * 0.19) % 1;
        const x = 1200 + t * 9000;
        const y = WORLD_HEIGHT * (0.24 + Math.sin(t * Math.PI * 2 + i) * 0.08);
        routeDust.circle(x, y, 1.8 + i % 3).fill({ color: 0xffd173, alpha: revealAmount * 0.08 });
      }
    } else {
      // Fallback single-screen pseudo-scrolling logic
      const scroll = routeProgress * 2850;
      secondIsland.x = WORLD_WIDTH * 0.98 - scroll * 0.46;
      secondIsland.y = WORLD_HEIGHT * 0.57 + Math.sin(timeSec * 0.36) * 12;
      secondIsland.rotation = Math.sin(timeSec * 0.22) * 0.01;
      secondIsland.visible = secondIsland.x > -280 && secondIsland.x < WORLD_WIDTH + 320;
      secondIsland.alpha = revealAmount * 0.42;

      thirdIsland.x = WORLD_WIDTH * 1.46 - scroll * 0.52;
      thirdIsland.y = WORLD_HEIGHT * 0.43 + Math.sin(timeSec * 0.29) * 13;
      thirdIsland.rotation = Math.sin(timeSec * 0.21) * 0.009;
      thirdIsland.visible = thirdIsland.x > -300 && thirdIsland.x < WORLD_WIDTH + 360;
      thirdIsland.alpha = revealAmount * 0.46;

      farIsland.x = WORLD_WIDTH * 1.24 - scroll * 0.26;
      farIsland.y = WORLD_HEIGHT * 0.19 + Math.sin(timeSec * 0.22) * 9;
      farIsland.rotation = Math.sin(timeSec * 0.18) * 0.006;
      farIsland.visible = farIsland.x > -220 && farIsland.x < WORLD_WIDTH + 260;
      farIsland.alpha = revealAmount * 0.24;

      island.x = WORLD_WIDTH * 2.05 - scroll * 0.62;
      island.y = WORLD_HEIGHT * 0.28 + Math.sin(timeSec * 0.31) * 11;
      island.rotation = Math.sin(timeSec * 0.26) * 0.012;
      island.alpha = 0.45 + revealAmount * 0.41;

      const carrierT = Math.max(0, Math.min(1, (routeProgress - 0.68) / 0.11));
      crimsonCarrier.x = WORLD_WIDTH * 1.12 - scroll * 0.16;
      crimsonCarrier.y = WORLD_HEIGHT * 0.2 + Math.sin(timeSec * 0.42) * 12;
      crimsonCarrier.rotation = Math.sin(timeSec * 0.33) * 0.006;
      crimsonCarrier.alpha = carrierT * 0.56;

      routeDust.clear();
      for (let i = 0; i < 7; i++) {
        const t = (routeProgress * 6 + i * 0.19) % 1;
        const x = WORLD_WIDTH * (0.15 + t * 0.74);
        const y = WORLD_HEIGHT * (0.24 + Math.sin(t * Math.PI * 2 + i) * 0.08);
        routeDust.circle(x, y, 1.8 + i % 3).fill({ color: 0xffd173, alpha: revealAmount * 0.08 });
      }
    }
  }

  function updateBeacon(timeSec: number) {
    beaconBeam.clear();
    exitGlow.clear();
    const pulse = Math.max(0, Math.sin(timeSec * 3.4 - 1.2));
    if (pulse > 0.12) {
      const originX = island.x + 38;
      const originY = island.y - 118;
      const length = 360;
      const beamW = 72 + pulse * 30;
      beaconBeam
        .moveTo(originX, originY)
        .lineTo(originX - length, originY - beamW * 0.5)
        .lineTo(originX - length, originY + beamW * 0.5)
        .closePath()
        .fill({ color: 0xffe2a2, alpha: 0.05 + pulse * 0.08 });
      exitGlow.circle(originX, originY, 16 + pulse * 18).fill({ color: 0xffd173, alpha: 0.08 + pulse * 0.14 });
    }
  }

  function updateScarPlane(timeSec: number, caravanX?: number) {
    scarPlane.visible = timeSec > 132 && timeSec < 178;
    if (!scarPlane.visible) return;
    const t = (timeSec - 132) / 46;
    if (caravanX !== undefined) {
      scarPlane.x = caravanX + 800 - t * 1600;
    } else {
      scarPlane.x = WORLD_WIDTH * (0.92 - t * 0.32);
    }
    scarPlane.y = WORLD_HEIGHT * (0.22 + Math.sin(timeSec * 1.7) * 0.018);
    scarPlane.rotation = -0.05 + Math.sin(timeSec * 2.1) * 0.035;
    scarPlane.alpha = 0.74;
  }

  function updateBoss(timeSec: number, phase: MissionOnePhase, bossAlive: boolean, cameraX?: number) {
    bossAirship.visible = phase === 'boss' || bossAlive;
    if (!bossAirship.visible) return;
    const t = Math.max(0, timeSec - 246);
    if (cameraX !== undefined) {
      bossAirship.x = 10500 - Math.min(220, t * 5);
    } else {
      bossAirship.x = WORLD_WIDTH * 0.86 - Math.min(220, t * 5);
    }
    bossAirship.y = WORLD_HEIGHT * 0.24 + Math.sin(timeSec * 0.5) * 16;
    bossAirship.rotation = Math.sin(timeSec * 0.38) * 0.01;
    bossAirship.alpha = bossAlive ? 0.82 : 0.28;
  }

  reset();
  drawRoute(0);

  return {
    container: container,
    reset: reset,
    update(
      _dt: number,
      timeSec: number,
      active: boolean,
      routeProgress: number,
      caravanHp: number,
      phase: MissionOnePhase,
      revealAmount: number,
      bossAlive: boolean,
      caravanX?: number,
      cameraX?: number
    ) {
      container.visible = active;
      if (!active) return;
      drawRoute(routeProgress);
      updateCarrier(timeSec, phase, revealAmount);
      updateRouteProps(timeSec, routeProgress, revealAmount, cameraX);
      updateCaravan(timeSec, routeProgress, caravanHp, revealAmount, caravanX, cameraX);
      updateSmoke(timeSec, caravanHp);
      updateBeacon(timeSec);
      updateScarPlane(timeSec, caravanX);
      updateBoss(timeSec, phase, bossAlive, cameraX);
    },
  };
}
