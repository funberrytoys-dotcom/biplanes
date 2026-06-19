import { Container, Graphics } from 'pixi.js';
import type { Rocket } from '@biplanes/core';

/**
 * Draws in-flight rockets (wing rockets + homing rockets). Previously rockets were
 * invisible — they flew and exploded "somewhere", which read as nothing happening.
 */
export class RocketPool {
  private active = new Map<number, { c: Container; body: Graphics; flame: Graphics }>();
  private pool: { c: Container; body: Graphics; flame: Graphics }[] = [];
  private t = 0;
  constructor(private container: Container) {}

  private make() {
    const c = new Container();
    const flame = new Graphics();
    const body = new Graphics();
    // missile body — pointing +x (heading 0), origin at centre
    body.moveTo(13, 0).lineTo(4, -4).lineTo(-11, -4).lineTo(-11, 4).lineTo(4, 4).closePath()
      .fill({ color: 0x9aa4b0 })
      .moveTo(13, 0).lineTo(4, -4).lineTo(4, 4).closePath()
      .fill({ color: 0xd23b2a }) // red nose
      .rect(-12, -5, 4, 10).fill({ color: 0x394250 }) // tail fins
      .rect(-6, -4, 2, 8).fill({ color: 0x2b313c, alpha: 0.6 });
    c.addChild(flame, body);
    return { c, body, flame };
  }

  sync(rockets: readonly Rocket[]) {
    this.t += 1;
    const seen = new Set<number>();
    for (const r of rockets) {
      seen.add(r.id);
      let n = this.active.get(r.id);
      if (!n) {
        n = this.pool.pop() ?? this.make();
        this.container.addChild(n.c);
        this.active.set(r.id, n);
      }
      n.c.x = r.position.x;
      n.c.y = r.position.y;
      n.c.rotation = Math.atan2(r.velocity.y, r.velocity.x);
      const flick = 0.7 + 0.3 * Math.sin(this.t * 0.9 + r.id);
      n.flame.clear()
        .moveTo(-11, -3.5).lineTo(-22 - flick * 8, 0).lineTo(-11, 3.5).closePath()
        .fill({ color: 0xffd24a, alpha: 0.9 })
        .moveTo(-11, -2).lineTo(-17 - flick * 5, 0).lineTo(-11, 2).closePath()
        .fill({ color: 0xff7a2a, alpha: 0.95 });
    }
    for (const [id, n] of this.active) {
      if (!seen.has(id)) {
        this.container.removeChild(n.c);
        this.active.delete(id);
        this.pool.push(n);
      }
    }
  }
}
