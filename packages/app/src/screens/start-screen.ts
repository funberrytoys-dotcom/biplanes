import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Difficulty } from '@biplanes/core';

export function createStartScreen(width: number, height: number, onPick: (d: Difficulty) => void) {
  const c = new Container();
  c.eventMode = 'static';

  // 1. Dark ambient background overlay
  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x070b12, alpha: 0.85 });
  c.addChild(dim);

  // 2. Glassmorphic Central Console Panel
  const panel = new Container();
  c.addChild(panel);

  const panelBg = new Graphics()
    .roundRect(0, 0, 820, 480, 20)
    .fill({ color: 0x0d1424, alpha: 0.92 }) // Glass tint
    .stroke({ color: 0x8b5a2b, width: 2.5 }); // Copper frame
  
  // Decorative copper rivets at the corners of the panel
  const panelBezel = new Graphics()
    .roundRect(4, 4, 812, 472, 18)
    .stroke({ color: 0x3d4a66, width: 1.5, alpha: 0.45 })
    // Corner rivets (screws)
    .circle(16, 16, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
    .circle(804, 16, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
    .circle(16, 464, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
    .circle(804, 464, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 });

  panel.addChild(panelBg, panelBezel);

  // 3. Stenciled Metallic Title
  const titleStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 54,
    fontWeight: 'bold',
    fill: 0xf4d35e, // Warm diesel gold
    stroke: { color: 0x3d1000, width: 4 },
  });
  const title = new Text({ text: '⚡ B I P L A N E S ⚡', style: titleStyle });
  
  const subtitleStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 18,
    fill: 0xa0a5b5,
    fontWeight: 'bold',
    letterSpacing: 2,
  });
  const subtitle = new Text({ text: 'RETRO DIESELPUNK FLIGHT COMBAT', style: subtitleStyle });
  
  const instructionStyle = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 14,
    fill: 0x8890a0,
    align: 'center',
  });
  const instruction = new Text({
    text: 'A/D or Arrows to steer  |  Space to fire machine gun  |  Shift to drop bomb\n(Hold W to start engine and throttle up)',
    style: instructionStyle,
  });

  panel.addChild(title, subtitle, instruction);

  // 4. Interactive Neon-bordered Buttons
  const buttons: Container[] = [];
  const levels: { label: string; d: Difficulty; color: number }[] = [
    { label: 'EASY',   d: 'easy',   color: 0x2ecc71 }, // Glowing Green
    { label: 'MEDIUM', d: 'medium', color: 0xf39c12 }, // Glowing Amber
    { label: 'HARD',   d: 'hard',   color: 0xe74c3c }, // Glowing Crimson
  ];

  levels.forEach(({ label, d, color }) => {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    // Local anchor at button center for clean scaling animations
    const btnW = 210;
    const btnH = 75;
    
    // Draw base button graphics
    const bg = new Graphics()
      .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
      .fill({ color: color, alpha: 0.12 })
      .stroke({ color: color, width: 2 });
    
    const t = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 24,
        fill: color,
        fontWeight: 'bold',
      }),
    });
    // Center text locally
    t.x = -t.width / 2;
    t.y = -t.height / 2;
    
    btn.addChild(bg, t);

    // Interactive Hover Scales and Neon Glow transitions
    btn.on('pointerover', () => {
      // Scale up smoothly
      btn.scale.set(1.06);
      
      // Intense neon glow border fill
      bg.clear()
        .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
        .fill({ color: color, alpha: 0.32 })
        .stroke({ color: color, width: 3.5 });
      
      t.style.fill = 0xffffff;
    });

    btn.on('pointerout', () => {
      // Revert scaling
      btn.scale.set(1.0);
      
      // Revert basic border style
      bg.clear()
        .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
        .fill({ color: color, alpha: 0.12 })
        .stroke({ color: color, width: 2 });
      
      t.style.fill = color;
    });

    btn.on('pointerdown', () => {
      onPick(d);
    });

    buttons.push(btn);
    panel.addChild(btn);
  });

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x070b12, alpha: 0.85 });
    
    // Center panel on screen
    panel.x = (w - 820) / 2;
    panel.y = (h - 480) / 2;

    // Arrange contents inside panel
    title.x = (820 - title.width) / 2;
    title.y = 55;
    
    subtitle.x = (820 - subtitle.width) / 2;
    subtitle.y = 125;

    instruction.x = (820 - instruction.width) / 2;
    instruction.y = 390;

    // Arrange buttons horizontally in center of panel
    const gap = 45;
    const btnW = 210;
    const totalW = btnW * 3 + gap * 2;
    const startX = (820 - totalW) / 2 + btnW / 2;
    
    buttons.forEach((b, i) => {
      b.x = startX + i * (btnW + gap);
      b.y = 265;
    });
  }
  layout(width, height);

  return {
    container: c,
    show() { c.visible = true; },
    hide() { c.visible = false; },
    resize(w: number, h: number) { layout(w, h); },
  };
}
