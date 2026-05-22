import { Container, Graphics } from 'pixi.js';

interface Crater {
  base: Graphics;
  age: number;
  smokeAcc: number;
}

const MAX_CRATERS = 3;

export class GroundFx {
  private craters: Crater[] = [];
  constructor(private container: Container) {}

  spawnCrater(x: number, y: number) {
    if (this.craters.length >= MAX_CRATERS) {
      const old = this.craters.shift()!;
      if (old.base.parent) old.base.parent.removeChild(old.base);
    }
    const g = new Graphics()
      .ellipse(0, 0, 22, 8).fill(0x1a0f08)
      .ellipse(0, 0, 22, 8).stroke({ color: 0x000000, width: 1.5 });
    g.x = x; g.y = y;
    this.container.addChild(g);
    this.craters.push({ base: g, age: 0, smokeAcc: 0 });
  }

  update(dt: number, addSmoke: (x: number, y: number) => void) {
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const c = this.craters[i]!;
      c.age += dt;
      if (c.age < 8) {
        c.smokeAcc += dt;
        while (c.smokeAcc >= 1 / 4) {
          addSmoke(c.base.x + (Math.random() - 0.5) * 8, c.base.y - 4);
          c.smokeAcc -= 1 / 4;
        }
      } else if (c.age < 12) {
        c.base.alpha = 1 - (c.age - 8) / 4;
      } else {
        if (c.base.parent) c.base.parent.removeChild(c.base);
        this.craters.splice(i, 1);
      }
    }
  }

  clear() {
    for (const c of this.craters) {
      if (c.base.parent) c.base.parent.removeChild(c.base);
    }
    this.craters.length = 0;
  }
}
