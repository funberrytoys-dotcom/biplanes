import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { resolveCloudContact, resolveCloudReadabilityAlpha, smooth01 } from './cloud-volume-math.js';

export interface CloudVolumePlane {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export interface CloudVolumeHandle {
  backContainer: Container;
  frontContainer: Container;
  update: (dt: number, timeSec: number, focusX: number, focusY: number, planes: CloudVolumePlane[]) => void;
}

interface CloudBank {
  sprite: Sprite;
  baseX: number;
  baseY: number;
  width: number;
  height: number;
  alpha: number;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
  parallaxX: number;
  parallaxY: number;
  pushX: number;
  pushY: number;
  pushDecay: number;
  front: boolean;
  disturbance: number;
  wobbleX: number;
  wobbleY: number;
  shearX: number;
  shearY: number;
  propPulse: number;
}

interface CloudParticle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  alpha: number;
  spin: number;
  drag: number;
  stretchX: number;
  stretchY: number;
}

const CLEAN_CLOUD_URLS = [
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_01.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_02.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_04.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_05.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_08.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_11.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_13.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_14.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_18.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_20.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_22.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_23.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_25.png',
  '/assets/biplanes/arena/day/clean-clouds/cloud_highres_transparent_27.png',
];

function makePuffTexture(): Texture {
  if (typeof document === 'undefined') return Texture.WHITE;

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;

  const gradient = ctx.createRadialGradient(48, 48, 5, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,0.62)');
  gradient.addColorStop(0.38, 'rgba(242,250,255,0.42)');
  gradient.addColorStop(0.72, 'rgba(220,238,246,0.16)');
  gradient.addColorStop(1, 'rgba(220,238,246,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return Texture.from(canvas);
}

function addBank(
  target: Container,
  banks: CloudBank[],
  url: string,
  x: number,
  y: number,
  width: number,
  alpha: number,
  front: boolean,
  phase: number,
) {
  const sprite = Sprite.from(url);
  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.scale.y = Math.abs(sprite.scale.x);
  if (phase % 2 > 1) sprite.scale.x *= -1;
  sprite.alpha = alpha;
  sprite.x = x;
  sprite.y = y;
  target.addChild(sprite);

  banks.push({
    sprite,
    baseX: x,
    baseY: y,
    width,
    height: Math.abs(sprite.height || width * 0.72),
    alpha,
    bobAmp: front ? 14 + (phase % 3) * 5 : 7 + (phase % 4) * 2,
    bobSpeed: front ? 0.28 + (phase % 5) * 0.022 : 0.14 + (phase % 5) * 0.014,
    phase,
    parallaxX: front ? 0.09 : 0.035,
    parallaxY: front ? 0.035 : 0.015,
    pushX: 0,
    pushY: 0,
    pushDecay: front ? 2.8 : 2.0,
    front,
    disturbance: 0,
    wobbleX: 0,
    wobbleY: 0,
    shearX: 0,
    shearY: 0,
    propPulse: 0,
  });
}

export function createCloudVolume(worldWidth: number, worldHeight: number): CloudVolumeHandle {
  const backContainer = new Container();
  const frontContainer = new Container();
  const banks: CloudBank[] = [];
  const particles: CloudParticle[] = [];
  const puffTexture = makePuffTexture();
  let loaded = false;
  let particleCursor = 0;

  Assets.load(CLEAN_CLOUD_URLS)
    .then(() => {
      const backRows = [
        { y: worldHeight * 0.44, width: 520, alpha: 0.22 },
        { y: worldHeight * 0.51, width: 700, alpha: 0.27 },
        { y: worldHeight * 0.60, width: 820, alpha: 0.31 },
      ];
      for (let i = 0; i < 18; i++) {
        const row = backRows[i % backRows.length]!;
        addBank(
          backContainer,
          banks,
          CLEAN_CLOUD_URLS[i % CLEAN_CLOUD_URLS.length]!,
          worldWidth * (0.035 + i * 0.055),
          row.y + ((i % 4) - 1.5) * 34,
          row.width + (i % 5) * 70,
          row.alpha + (i % 3) * 0.025,
          false,
          i * 1.37,
        );
      }

      for (let i = 0; i < 10; i++) {
        addBank(
          frontContainer,
          banks,
          CLEAN_CLOUD_URLS[(i * 2 + 3) % CLEAN_CLOUD_URLS.length]!,
          worldWidth * (0.06 + i * 0.098),
          worldHeight * (0.46 + (i % 4) * 0.06),
          620 + (i % 4) * 120,
          0.34 + (i % 3) * 0.085,
          true,
          i * 1.91,
        );
      }
      loaded = true;
    })
    .catch(() => {
      loaded = false;
    });

  function placeParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    startScale: number,
    endScale: number,
    alpha: number,
    spin: number,
    drag: number,
    stretchX = 1,
    stretchY = 1,
  ) {
    const sprite = particles[particleCursor]?.sprite ?? new Sprite(puffTexture);
    if (!particles[particleCursor]) {
      sprite.anchor.set(0.5);
      frontContainer.addChild(sprite);
    }

    particles[particleCursor] = {
      sprite,
      x,
      y,
      vx,
      vy,
      age: 0,
      life,
      startScale,
      endScale,
      alpha,
      spin,
      drag,
      stretchX,
      stretchY,
    };

    particleCursor = (particleCursor + 1) % 220;
  }

  function spawnPuff(x: number, y: number, vx: number, vy: number, strength: number, spread = 1) {
    const speed = Math.hypot(vx, vy) || 1;
    const nx = -vx / speed;
    const ny = -vy / speed;
    const side = (Math.random() - 0.5) * 56 * spread;
    const life = 1.15 + Math.random() * 0.75;
    const startScale = 0.66 + Math.random() * 0.56;
    const endScale = startScale + 1.15 + strength * 0.95;

    placeParticle(
      x + nx * (24 + Math.random() * 34) - ny * side,
      y + ny * (24 + Math.random() * 34) + nx * side,
      nx * (105 + strength * 155) + (Math.random() - 0.5) * 84 * spread,
      ny * (70 + strength * 110) + (Math.random() - 0.5) * 68 * spread,
      life,
      startScale,
      endScale,
      0.48 + strength * 0.34,
      (Math.random() - 0.5) * 0.45,
      0.74,
      1,
      1,
    );
  }

  return {
    backContainer,
    frontContainer,
    update(dt, timeSec, focusX, focusY, planes) {
      if (!loaded) return;

      for (const bank of banks) {
        bank.pushX *= Math.max(0, 1 - dt * bank.pushDecay);
        bank.pushY *= Math.max(0, 1 - dt * bank.pushDecay);
        bank.shearX *= Math.max(0, 1 - dt * (bank.front ? 1.65 : 1.1));
        bank.shearY *= Math.max(0, 1 - dt * (bank.front ? 1.4 : 0.95));
        bank.propPulse *= Math.max(0, 1 - dt * 2.2);
        let readabilityContact = 0;

        for (const plane of planes) {
          if (!plane.active) continue;
          const contact = resolveCloudContact({
            planeX: plane.x,
            planeY: plane.y,
            planeVx: plane.vx,
            planeVy: plane.vy,
            bankX: bank.baseX,
            bankY: bank.baseY,
            bankWidth: bank.width,
            bankHeight: bank.height,
            front: bank.front,
          });
          if (contact.strength <= 0) continue;

          const strength = contact.strength;
          bank.disturbance = Math.max(bank.disturbance, strength);
          readabilityContact = Math.max(readabilityContact, strength);
          bank.propPulse = Math.max(bank.propPulse, contact.propWash);
          bank.pushX -= plane.vx * strength * dt * (bank.front ? 0.14 : 0.052);
          bank.pushY -= plane.vy * strength * dt * (bank.front ? 0.105 : 0.034);
          bank.shearX += contact.sideX * contact.propWash * dt * (bank.front ? 220 : 90);
          bank.shearY += contact.sideY * contact.propWash * dt * (bank.front ? 145 : 60);
          bank.pushX = Math.max(-105, Math.min(105, bank.pushX));
          bank.pushY = Math.max(-66, Math.min(66, bank.pushY));
          bank.shearX = Math.max(-85, Math.min(85, bank.shearX));
          bank.shearY = Math.max(-58, Math.min(58, bank.shearY));

          const puffChance = Math.min(1, dt * (13 + contact.speed / 38) * strength);
          if (Math.random() < puffChance) {
            spawnPuff(plane.x, plane.y, plane.vx, plane.vy, strength, bank.front ? 1.45 : 1);
            if (bank.front && strength > 0.4) {
              spawnPuff(plane.x, plane.y, plane.vx, plane.vy, strength * 0.82, 1.6);
            }
          }
        }

        bank.disturbance *= Math.max(0, 1 - dt * 1.35);
        bank.wobbleX += (Math.sin(timeSec * 7.2 + bank.phase * 1.7) * bank.disturbance * (bank.front ? 27 : 12) - bank.wobbleX) * Math.min(1, dt * 5.4);
        bank.wobbleY += (Math.cos(timeSec * 6.4 + bank.phase * 1.3) * bank.disturbance * (bank.front ? 19 : 8) - bank.wobbleY) * Math.min(1, dt * 5.4);
        const bob = Math.sin(timeSec * bank.bobSpeed + bank.phase) * bank.bobAmp;
        const slowDrift = Math.sin(timeSec * 0.08 + bank.phase) * (bank.front ? 18 : 8);
        const slowRise = Math.cos(timeSec * 0.06 + bank.phase * 0.7) * (bank.front ? 8 : 4);
        bank.sprite.x = bank.baseX + slowDrift + bank.pushX + bank.wobbleX + bank.shearX;
        bank.sprite.y = bank.baseY + slowRise + bob + bank.pushY + bank.wobbleY + bank.shearY;
        bank.sprite.rotation = Math.sin(timeSec * 3.2 + bank.phase) * bank.disturbance * (bank.front ? 0.028 : 0.012);
        bank.sprite.alpha = resolveCloudReadabilityAlpha({
          baseAlpha: bank.alpha,
          contactStrength: readabilityContact,
          front: bank.front,
          propPulse: bank.propPulse,
          ambientPulse: Math.sin(timeSec * 0.35 + bank.phase) * 0.025,
        });
      }

      for (const particle of particles) {
        particle.age += dt;
        const t = particle.age / particle.life;
        if (t >= 1) {
          particle.sprite.visible = false;
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.max(0, 1 - dt * particle.drag);
        particle.vy *= Math.max(0, 1 - dt * particle.drag * 0.72);
        const ease = smooth01(t);
        const scale = particle.startScale + (particle.endScale - particle.startScale) * ease;
        particle.sprite.visible = true;
        particle.sprite.x = particle.x;
        particle.sprite.y = particle.y;
        particle.sprite.rotation += particle.spin;
        particle.sprite.scale.set(scale * particle.stretchX, scale * particle.stretchY);
        particle.sprite.alpha = particle.alpha * (1 - smooth01(t));
      }
    },
  };
}
