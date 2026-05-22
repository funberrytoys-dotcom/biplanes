import { Container, Text, TextStyle } from 'pixi.js';

interface Num {
  t: Text;
  life: number;
  maxLife: number;
  vy: number;
}

const MAX_ACTIVE = 30;

export class FloatingNumbers {
  private active: Num[] = [];
  private pool: Text[] = [];

  constructor(private container: Container) {}

  spawn(x: number, y: number, value: number, isPlayerDealing: boolean) {
    if (this.active.length >= MAX_ACTIVE) {
      const old = this.active.shift()!;
      if (old.t.parent) old.t.parent.removeChild(old.t);
      this.pool.push(old.t);
    }
    let t = this.pool.pop();
    if (!t) {
      t = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 'bold',
          stroke: { color: 0x000000, width: 2 },
          fill: 0xffe066,
        }),
      });
    }
    t.text = `-${Math.round(value)}`;
    (t.style as TextStyle).fill = isPlayerDealing ? 0xffe066 : 0xff5544;
    t.x = x - t.width / 2;
    t.y = y - 8;
    t.alpha = 1;
    this.container.addChild(t);
    this.active.push({ t, life: 0.6, maxLife: 0.6, vy: -30 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i]!;
      n.life -= dt;
      if (n.life <= 0) {
        if (n.t.parent) n.t.parent.removeChild(n.t);
        this.pool.push(n.t);
        this.active.splice(i, 1);
        continue;
      }
      n.t.y += n.vy * dt;
      n.t.alpha = n.life / n.maxLife;
    }
  }
}
