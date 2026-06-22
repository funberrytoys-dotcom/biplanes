import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { SupplyBalloon, Pickup, PickupKind } from '@biplanes/core';
import {
  SUPPLY_BALLOON_BOB_AMPLITUDE,
  PICKUP_BOB_AMPLITUDE,
  PICKUP_LIFETIME,
  type Vec2,
} from '@biplanes/shared';

const KIND_COLOR: Record<PickupKind, number> = {
  ammo: 0xffcf45,
  repair: 0x57e08a,
  rapidfire: 0xff8a3c,
  level: 0xc77dff, // violet — a bonus card pick (premium)
};
const KIND_LABEL: Record<PickupKind, string> = {
  ammo: 'ПАТРОНЫ',
  repair: 'РЕМОНТ',
  rapidfire: 'СКОРОСТРЕЛ',
  level: 'КАРТА',
};

export type BalloonScheme = 'sov' | 'jackals';

/** Draw a fallback balloon+chest so the entity is always visible even if the art PNG
 *  hasn't loaded. Red for the Jackals, blue for С.О.В. */
function drawFallbackBalloon(g: Graphics, scheme: BalloonScheme = 'sov') {
  const jk = scheme === 'jackals';
  const balloonFill = jk ? 0xc0392b : 0x2f7dd6;
  const balloonStroke = jk ? 0x7d2018 : 0x1d4f8c;
  const balloonHi = jk ? 0xf09a8c : 0x8fc2f2;
  g.clear();
  // rope
  g.moveTo(0, -6).lineTo(0, 30).stroke({ color: 0x4a3a26, width: 2.5, alpha: 0.9 });
  // balloon
  g.ellipse(0, -34, 30, 36).fill({ color: balloonFill });
  g.ellipse(0, -34, 30, 36).stroke({ color: balloonStroke, width: 3, alpha: 0.6 });
  g.ellipse(-9, -44, 8, 12).fill({ color: balloonHi, alpha: 0.55 }); // highlight
  g.moveTo(-18, -6).lineTo(0, 4).lineTo(18, -6).stroke({ color: 0x4a3a26, width: 2, alpha: 0.85 });
  // chest
  g.roundRect(-20, 28, 40, 26, 4).fill({ color: 0x7a4a22 });
  g.roundRect(-20, 28, 40, 26, 4).stroke({ color: 0x3c2410, width: 2.5 });
  g.rect(-20, 36, 40, 4).fill({ color: 0xc9a14a });
  g.rect(-3, 36, 6, 10).fill({ color: 0xc9a14a }); // lock
}

interface BalloonNode {
  container: Container;
  fallback: Graphics;
  sprite: Sprite;
}

export class SupplyPool {
  private active = new Map<number, BalloonNode>();
  private pool: BalloonNode[] = [];
  private scheme: BalloonScheme = 'sov';
  constructor(private container: Container, private textureUrl: string) {}

  /** Swap the balloon look for the chosen faction (red Jackal art + fallback, or blue С.О.В.). */
  setFaction(scheme: BalloonScheme, textureUrl: string) {
    if (scheme === this.scheme && textureUrl === this.textureUrl) return;
    this.scheme = scheme;
    this.textureUrl = textureUrl;
    const refresh = (n: BalloonNode) => {
      drawFallbackBalloon(n.fallback, scheme);
      n.sprite.texture = Texture.from(textureUrl);
      n.sprite.visible = false; // let sync() re-show once the new texture has real dims
      n.fallback.visible = true;
    };
    for (const n of this.active.values()) refresh(n);
    for (const n of this.pool) refresh(n);
  }

  private make(): BalloonNode {
    const c = new Container();
    const fallback = new Graphics();
    drawFallbackBalloon(fallback, this.scheme);
    const sprite = Sprite.from(this.textureUrl);
    sprite.anchor.set(0.5, 0.42);
    sprite.visible = false;
    c.addChild(fallback, sprite);
    return { container: c, fallback, sprite };
  }

  sync(balloons: readonly SupplyBalloon[]) {
    const seen = new Set<number>();
    for (const b of balloons) {
      seen.add(b.id);
      let n = this.active.get(b.id);
      if (!n) {
        n = this.pool.pop() ?? this.make();
        this.container.addChild(n.container);
        this.active.set(b.id, n);
      }
      // Once the PNG has real dimensions, prefer it over the drawn fallback.
      const tex = n.sprite.texture;
      if (tex && tex !== Texture.EMPTY && tex.width > 2) {
        if (!n.sprite.visible) {
          n.sprite.visible = true;
          n.fallback.visible = false;
          // ~100px tall balloon+chest
          n.sprite.scale.set(110 / tex.height);
        }
      }
      const bob = Math.sin(b.bobPhase) * SUPPLY_BALLOON_BOB_AMPLITUDE;
      n.container.x = b.position.x;
      n.container.y = b.position.y + bob;
      // a hint of sway
      n.container.rotation = Math.sin(b.bobPhase * 0.7) * 0.04;
    }
    for (const [id, n] of this.active) {
      if (!seen.has(id)) {
        this.container.removeChild(n.container);
        this.active.delete(id);
        this.pool.push(n);
      }
    }
  }
}

function drawPickupEmblem(g: Graphics, kind: PickupKind) {
  const color = KIND_COLOR[kind];
  g.clear();
  // little parachute canopy above (reads as "floating down")
  g.moveTo(-16, -14).quadraticCurveTo(0, -30, 16, -14).fill({ color, alpha: 0.32 });
  g.moveTo(-16, -14).lineTo(-6, 0).moveTo(16, -14).lineTo(6, 0).moveTo(0, -22).lineTo(0, 0)
    .stroke({ color: 0xffffff, width: 1.4, alpha: 0.5 });
  // disc
  g.circle(0, 6, 15).fill({ color: 0x0d1320, alpha: 0.85 });
  g.circle(0, 6, 15).stroke({ color, width: 3 });
  // glyph
  if (kind === 'ammo') {
    g.roundRect(-7, -1, 5, 13, 1.5).fill({ color });
    g.roundRect(1, -1, 5, 13, 1.5).fill({ color });
    g.rect(-7, -3, 13, 2).fill({ color: 0xffffff, alpha: 0.85 });
  } else if (kind === 'repair') {
    g.rect(-3, -1, 6, 14).fill({ color });
    g.rect(-7, 3, 14, 6).fill({ color });
  } else if (kind === 'level') {
    // a five-point star — "pick a card / level up"
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 4.6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(Math.cos(a) * r, 6 + Math.sin(a) * r);
    }
    g.poly(pts).fill({ color });
  } else {
    g.moveTo(2, -3).lineTo(-5, 7).lineTo(0, 7).lineTo(-2, 15).lineTo(6, 4).lineTo(1, 4).closePath().fill({ color });
  }
}

interface PickupNode {
  container: Container;
  emblem: Graphics;
  kind: PickupKind;
}

export class PickupPool {
  private active = new Map<number, PickupNode>();
  private pool: PickupNode[] = [];
  constructor(private container: Container) {}

  sync(pickups: readonly Pickup[]) {
    const seen = new Set<number>();
    for (const p of pickups) {
      seen.add(p.id);
      let n = this.active.get(p.id);
      if (!n || n.kind !== p.kind) {
        if (n) { this.container.removeChild(n.container); this.active.delete(p.id); }
        const c = new Container();
        const emblem = new Graphics();
        drawPickupEmblem(emblem, p.kind);
        c.addChild(emblem);
        n = { container: c, emblem, kind: p.kind };
        this.container.addChild(c);
        this.active.set(p.id, n);
      }
      const sway = Math.sin(p.bobPhase) * PICKUP_BOB_AMPLITUDE;
      n.container.x = p.position.x + sway;
      n.container.y = p.position.y;
      // fade out in the last second of life
      n.container.alpha = Math.max(0.15, Math.min(1, p.lifetime / 1.0));
      const pulse = 1 + Math.sin(p.bobPhase * 1.6) * 0.06;
      n.container.scale.set(pulse);
    }
    for (const [id, n] of this.active) {
      if (!seen.has(id)) {
        this.container.removeChild(n.container);
        this.active.delete(id);
        this.pool.push(n);
      }
    }
  }
}

interface FxItem {
  container: Container;
  ring: Graphics;
  label: Text | null;
  age: number;
  ttl: number;
}

const LABEL_STYLE = new TextStyle({ fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x000000, width: 4 } });

/** Pop bursts (golden ring) and collect flashes (colored ring + rising label). */
export class SupplyFx {
  private items: FxItem[] = [];
  constructor(private container: Container) {}

  pop(pos: Vec2) {
    const c = new Container();
    c.x = pos.x; c.y = pos.y;
    const ring = new Graphics();
    c.addChild(ring);
    this.container.addChild(c);
    this.items.push({ container: c, ring, label: null, age: 0, ttl: 0.5 });
  }

  collect(pos: Vec2, kind: PickupKind) {
    const c = new Container();
    c.x = pos.x; c.y = pos.y;
    const ring = new Graphics();
    const label = new Text({ text: `+${KIND_LABEL[kind]}`, style: LABEL_STYLE });
    label.anchor.set(0.5);
    label.y = -22;
    label.tint = KIND_COLOR[kind];
    c.addChild(ring, label);
    this.container.addChild(c);
    this.items.push({ container: c, ring, label, age: 0, ttl: 0.9 });
  }

  update(dt: number) {
    for (const it of this.items) {
      it.age += dt;
      const t = Math.min(1, it.age / it.ttl);
      const r = 8 + t * 46;
      it.ring.clear().circle(0, 0, r).stroke({ color: it.label ? 0xffffff : 0xffd35c, width: 3 * (1 - t), alpha: 1 - t });
      if (it.label) { it.label.y = -22 - t * 26; it.label.alpha = 1 - t; }
    }
    const dead = this.items.filter(it => it.age >= it.ttl);
    for (const it of dead) this.container.removeChild(it.container);
    this.items = this.items.filter(it => it.age < it.ttl);
  }

  clear() {
    for (const it of this.items) this.container.removeChild(it.container);
    this.items = [];
  }
}

export const PICKUP_FULL_LIFETIME = PICKUP_LIFETIME;
