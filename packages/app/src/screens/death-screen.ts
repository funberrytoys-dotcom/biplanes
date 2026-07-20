import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { WorldState } from '@biplanes/core';
import { UPGRADE_DEFS } from '@biplanes/core';
import { PLAYER_SCORE_TO_WIN } from '@biplanes/shared';
import { resolveDeathScreenLayout } from './death-screen-layout.js';

export function createDeathScreen(width: number, height: number, onRestart: () => void) {
  const c = new Container();
  c.visible = false;
  c.eventMode = 'static';

  // 1. Dark ambient background overlay
  const dim = new Graphics().rect(0, 0, width, height).fill({ color: 0x070b12, alpha: 0.85 });
  c.addChild(dim);

  // 2. Vintage Printed Telegram Panel
  const panel = new Container();
  c.addChild(panel);

  const panelW = 600;
  const panelH = 500;

  const panelBg = new Graphics();
  
  const drawPanel = () => {
    panelBg.clear();
    // Glassmorphic border glow & warm aged paper tint
    panelBg.roundRect(0, 0, panelW, panelH, 16)
      .fill({ color: 0xf6ebd4, alpha: 0.96 }) // Aged yellow paper
      .stroke({ color: 0x8b5a2b, width: 3 }); // Heavy copper frame
      
    // Faint printed double outline for retro telegraph style
    panelBg.roundRect(8, 8, panelW - 16, panelH - 16, 12)
      .stroke({ color: 0xab9573, width: 1, alpha: 0.6 });

    // Faint horizontal typewriter guidance lines
    const lineSpacing = 28;
    for (let y = 110; y < 380; y += lineSpacing) {
      panelBg.moveTo(30, y)
        .lineTo(panelW - 30, y)
        .stroke({ color: 0xe3d4b6, width: 1, alpha: 0.8 });
    }

    // Corner rivet markings
    panelBg.circle(18, 18, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
      .circle(panelW - 18, 18, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
      .circle(18, panelH - 18, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 })
      .circle(panelW - 18, panelH - 18, 4).fill(0x5a5f69).stroke({ color: 0x000, width: 1 });
  };
  drawPanel();
  panel.addChild(panelBg);

  // 3. Header Stamp Markings
  const headerSub = new Text({
    text: '--- WAR OFFICE TELEGRAPH ---',
    style: new TextStyle({
      fontFamily: 'BiplanesMono, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0x735738,
      letterSpacing: 2,
    })
  });
  headerSub.x = (panelW - headerSub.width) / 2;
  headerSub.y = 28;

  const headerTitle = new Text({
    text: 'PILOT DEBRIEF & MISSION LOG',
    style: new TextStyle({
      fontFamily: 'BiplanesMono, Courier New, monospace',
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0x3d2611,
      letterSpacing: 1,
    })
  });
  headerTitle.x = (panelW - headerTitle.width) / 2;
  headerTitle.y = 48;
  
  panel.addChild(headerSub, headerTitle);

  // 4. Typewritten Stats Box
  const statsStyle = new TextStyle({
    fontFamily: 'BiplanesMono, Courier New, monospace',
    fontSize: 15,
    fontWeight: 'bold',
    fill: 0x24180d,
    lineHeight: 28,
  });
  const stats = new Text({ text: '', style: statsStyle });
  stats.x = 42;
  stats.y = 115;
  panel.addChild(stats);

  // 5. Heavy Rubber Ink Stamp Container (angled)
  const stampContainer = new Container();
  stampContainer.x = panelW - 145;
  stampContainer.y = 180;
  stampContainer.rotation = -0.22; // subtle angled imprint
  panel.addChild(stampContainer);

  const stampBg = new Graphics();
  const stampText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      letterSpacing: 3,
    })
  });
  stampContainer.addChild(stampBg, stampText);

  // 6. Interactive Neon-bordered Return Button
  const button = new Container();
  button.eventMode = 'static';
  button.cursor = 'pointer';
  
  const btnW = 320;
  const btnH = 60;
  const btnColor = 0xf39c12; // Glowing Amber/Gold

  const btnBg = new Graphics()
    .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
    .fill({ color: btnColor, alpha: 0.12 })
    .stroke({ color: btnColor, width: 2 });
  
  const btnText = new Text({
    text: 'RETURN TO HANGAR',
    style: new TextStyle({
      fontFamily: 'BiplanesMono, monospace',
      fontSize: 20,
      fill: btnColor,
      fontWeight: 'bold',
    }),
  });
  btnText.x = -btnText.width / 2;
  btnText.y = -btnText.height / 2;
  button.addChild(btnBg, btnText);
  
  button.x = panelW / 2;
  button.y = 425;
  panel.addChild(button);

  // Button Hover scales & neon glowing transitions
  button.on('pointerover', () => {
    button.scale.set(1.05);
    btnBg.clear()
      .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
      .fill({ color: btnColor, alpha: 0.32 })
      .stroke({ color: btnColor, width: 3.5 });
    btnText.style.fill = 0xffffff;
  });

  button.on('pointerout', () => {
    button.scale.set(1.0);
    btnBg.clear()
      .roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12)
      .fill({ color: btnColor, alpha: 0.12 })
      .stroke({ color: btnColor, width: 2 });
    btnText.style.fill = btnColor;
  });

  button.on('pointerdown', onRestart);

  // Typewriter and stamp state variables
  let targetText = '';
  let currentLength = 0;
  let timeAccumulator = 0;
  let cursorPhase = 0;
  let isTyping = false;

  let stampActive = false;
  let stampTimer = 0;

  function layout(w: number, h: number) {
    dim.clear().rect(0, 0, w, h).fill({ color: 0x070b12, alpha: 0.85 });
    const panelLayout = resolveDeathScreenLayout(w, h);

    panel.scale.set(panelLayout.scale);
    panel.x = panelLayout.panelX;
    panel.y = panelLayout.panelY;
  }
  layout(width, height);

  return {
    container: c,
    show(state: WorldState) {
      const isVictory = state.playerScore >= PLAYER_SCORE_TO_WIN;
      const statusLabel = isVictory ? 'ПОБЕДА' : 'СБИТ';
      const stampColor = isVictory ? 0x277a3d : 0xb22222; // Green or Red

      // Procedurally draw distressed double-line ink stamp box
      stampBg.clear();
      stampBg.roundRect(-90, -32, 180, 64, 8)
        .stroke({ color: stampColor, width: 3.5, alpha: 0.85 });
      stampBg.roundRect(-84, -26, 168, 52, 6)
        .stroke({ color: stampColor, width: 1.2, alpha: 0.6 });

      stampText.text = statusLabel;
      stampText.style.fill = stampColor;
      stampText.x = -stampText.width / 2;
      stampText.y = -stampText.height / 2;

      // Construct detailed mechanical debrief log lines
      const upgradeTitles = new Map<string, string>(UPGRADE_DEFS.map(upgrade => [upgrade.id, upgrade.title]));
      const upgradeNames = state.appliedUpgradeIds
        .map(id => upgradeTitles.get(id) ?? id)
        .join(', ');
      const upgradesList = upgradeNames ? upgradeNames : 'НЕТ';

      const lines = [
        `ПИЛОТ: КАПИТАН ЧИКО (01)`,
        `СТАТУС: ${isVictory ? 'НЕБО ОЧИЩЕНО' : 'САМОЛЕТ ПОТЕРЯН'}`,
        `ВРЕМЯ ВЫЛЕТА: ${state.timeSec.toFixed(1)} СЕК`,
        `СБИТО ВРАГОВ: ${state.playerScore}`,
        `УРОВЕНЬ АВИОНИКИ: ${state.level}`,
        `АКТИВНЫЕ УЛУЧШЕНИЯ: ${upgradesList}`,
      ];

      targetText = lines.join('\n\n');
      currentLength = 0;
      timeAccumulator = 0;
      cursorPhase = 0;
      isTyping = true;

      stats.text = '';
      stampContainer.visible = false;
      stampActive = false;
      stampTimer = 0;

      c.visible = true;
    },
    hide() {
      c.visible = false;
      isTyping = false;
    },
    update(dt: number) {
      if (!c.visible) return;

      // Typewriter ticking reveal
      if (isTyping) {
        timeAccumulator += dt;
        cursorPhase += dt;

        // Reveal 1 character every 0.018 seconds
        const charsToType = Math.floor(timeAccumulator / 0.018);
        if (charsToType > currentLength) {
          currentLength = Math.min(charsToType, targetText.length);
          
          // Append mechanical blinking block cursor while actively typing
          const cursor = Math.floor(cursorPhase * 8) % 2 === 0 ? '|' : ' ';
          stats.text = targetText.slice(0, currentLength) + (currentLength < targetText.length ? cursor : '');

          if (currentLength >= targetText.length) {
            isTyping = false;
            stats.text = targetText; // Clean text without terminal cursor
            
            // Trigger rubber stamp slam-down slam-force sequence
            stampActive = true;
            stampTimer = 0;
          }
        }
      }

      // Distressed rubber stamp slam scale and bounce interpolation
      if (stampActive) {
        stampTimer += dt * 3.8; // Quick punchy slam
        if (stampTimer >= 1.0) {
          stampTimer = 1.0;
          stampActive = false;
        }

        const t = stampTimer;
        // Exponential/Cubic speed down from huge 5.0x zoom to tight 1.0x slam with tiny bounce
        const easeScale = 1 - Math.pow(1 - t, 3);
        const scale = 5.0 - 4.0 * easeScale;
        
        stampContainer.scale.set(scale);
        stampContainer.alpha = Math.min(1.0, t * 1.5);
        stampContainer.visible = true;
      }
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
  };
}
