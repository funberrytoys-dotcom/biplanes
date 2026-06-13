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
        g.clear()
          .rect(-8, -2.1, 14, 4.2)
          .fill({ color: 0x2b1208, alpha: 0.72 })
          .rect(-7, -1.2, 12, 2.4)
          .fill({ color: 0xffd35c, alpha: 0.95 })
          .circle(4, 0, 2.8)
          .fill({ color: 0xffffff, alpha: 0.98 });
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
