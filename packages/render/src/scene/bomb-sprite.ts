import { Container, Graphics } from 'pixi.js';
import type { Bomb } from '@biplanes/core';

export class BombPool {
  private pool: Graphics[] = [];
  private active = new Map<number, Graphics>();

  constructor(private container: Container) {}

  sync(bombs: readonly Bomb[]) {
    const seen = new Set<number>();
    for (const b of bombs) {
      seen.add(b.id);
      let g = this.active.get(b.id);
      if (!g) {
        g = this.pool.pop() ?? new Graphics();
        g.clear()
          .circle(0, 13, 10)
          .fill({ color: 0xff7a22, alpha: 0.16 })
          .ellipse(0, 0, 8, 14)
          .fill({ color: 0x191b22, alpha: 1 })
          .ellipse(-2, -3, 3, 6)
          .fill({ color: 0x4b5365, alpha: 0.9 })
          .rect(-6, -16, 12, 5)
          .fill({ color: 0x2d3442, alpha: 1 })
          .circle(3, -6, 2)
          .fill({ color: 0xf7d28a, alpha: 0.75 });
        this.container.addChild(g);
        this.active.set(b.id, g);
      }
      g.x = b.position.x;
      g.y = b.position.y;
      g.rotation = Math.atan2(b.velocity.y, b.velocity.x) + Math.PI / 2;
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
