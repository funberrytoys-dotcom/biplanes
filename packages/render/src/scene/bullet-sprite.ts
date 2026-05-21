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
        g = this.pool.pop() ?? new Graphics().circle(0, 0, 3).fill(0xfff5a0);
        this.container.addChild(g);
        this.active.set(b.id, g);
      }
      g.x = b.position.x;
      g.y = b.position.y;
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
