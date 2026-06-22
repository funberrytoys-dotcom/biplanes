import { Container, Graphics } from 'pixi.js';
import type { Bullet } from '@biplanes/core';

export class BulletPool {
  private pool: Graphics[] = [];
  private active = new Map<number, Graphics>();
  constructor(private container: Container) {}

  sync(bullets: readonly Bullet[]) {
    const seen = new Set<number>();
    for (const b of bullets) {
      seen.add(b.id);
      let g = this.active.get(b.id);
      if (!g) {
        g = this.pool.pop() ?? new Graphics();
        g.clear();
        if (b.heavyRound) {
          // Алые Шакалы heavy gun: a big SLOW glowing ember ball with a motion tail.
          g.ellipse(-9, 0, 11, 4.5).fill({ color: 0xff5520, alpha: 0.22 }) // tail (points backward via rotation)
            .circle(0, 0, 9).fill({ color: 0xff4a1e, alpha: 0.4 })          // outer glow
            .circle(0, 0, 6).fill({ color: 0xff7a2a, alpha: 0.92 })         // ember body
            .circle(0, 0, 3.2).fill({ color: 0xffe2a0, alpha: 1 })          // hot core
            .circle(-1.2, -1.2, 1.4).fill({ color: 0xffffff, alpha: 0.95 }); // specular
        } else {
          g.rect(-8, -2.1, 14, 4.2).fill({ color: 0x2b1208, alpha: 0.72 })
            .rect(-7, -1.2, 12, 2.4).fill({ color: 0xffd35c, alpha: 0.95 })
            .circle(4, 0, 2.8).fill({ color: 0xffffff, alpha: 0.98 });
        }
        this.container.addChild(g);
        this.active.set(b.id, g);
      }
      g.x = b.position.x;
      g.y = b.position.y;
      g.rotation = Math.atan2(b.velocity.y, b.velocity.x);
    }
    for (const [id, g] of this.active) {
      if (!seen.has(id)) {
        this.container.removeChild(g);
        this.active.delete(id);
        this.pool.push(g);
      }
    }
  }
}
