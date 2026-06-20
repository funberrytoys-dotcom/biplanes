import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { getStartScreenLayout } from './start-screen-layout.js';
import { getStartMenuOptions, type MenuAction } from './start-menu-options.js';

export interface StartScreenOpts {
  musicEnabled?: boolean;
  onMusicToggle?: (enabled: boolean) => void;
}

export function createStartScreen(
  width: number,
  height: number,
  onPick: (action: MenuAction) => void,
  opts: StartScreenOpts = {},
) {
  const c = new Container();
  c.eventMode = 'static';

  const dim = new Graphics();
  const leftShade = new Graphics();
  const panel = new Container();
  const statusPanel = new Container();
  c.addChild(dim, leftShade, panel, statusPanel);

  // Blue backing/frame that sits ONLY behind the menu button rows (not the whole
  // start screen) so the menu reads over the video without hiding it. Added first
  // to `panel` so it renders behind the buttons; drawn over the button bbox in layout().
  const menuBacking = new Graphics();
  panel.addChild(menuBacking);

  const titleStyle = new TextStyle({
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 58,
    fontWeight: 'bold',
    fill: 0xfff0c0,
    stroke: { color: 0x1b0d05, width: 5 },
  });
  const title = new Text({ text: 'Biplanes', style: titleStyle });

  const subtitle = new Text({
    text: 'ОГНИ МАЯКОВ',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 26,
      fontWeight: 'bold',
      fill: 0xffb44a,
      stroke: { color: 0x170704, width: 4 },
    }),
  });

  const tagline = new Text({
    text: 'Пока горят маяки, Архипелаг помнит дорогу домой.',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 16,
      fill: 0xf7d8a0,
      stroke: { color: 0x000000, width: 3 },
    }),
  });

  panel.addChild(title, subtitle, tagline);

  const statusBg = new Graphics();
  const statusText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 15,
      fill: 0xe7eaf4,
      align: 'center',
      lineHeight: 22,
      wordWrap: true,
      wordWrapWidth: 520,
      stroke: { color: 0x000000, width: 3 },
    }),
  });
  statusPanel.addChild(statusBg, statusText);

  const buttonDefs = getStartMenuOptions();
  const buttons: Container[] = [];
  let statusLife = 0;
  let statusWidth = 560;
  let statusHeight = 84;

  function centerStatusText() {
    statusText.x = (statusWidth - statusText.width) / 2;
    statusText.y = (statusHeight - statusText.height) / 2;
  }

  function setStatus(text: string, life = 2.8) {
    statusText.text = text;
    centerStatusText();
    statusPanel.visible = true;
    statusPanel.alpha = 1;
    statusLife = life;
  }

  function redrawButton(bg: Graphics, enabled: boolean, hovered: boolean) {
    const color = enabled ? 0xffb44a : 0x8390a8;
    const fillAlpha = enabled ? (hovered ? 0.28 : 0.16) : 0.08;
    const strokeAlpha = enabled ? (hovered ? 1 : 0.82) : 0.46;
    bg.clear()
      .roundRect(-180, -27, 360, 54, 8)
      .fill({ color: 0x101827, alpha: fillAlpha })
      .stroke({ color, width: hovered && enabled ? 3 : 2, alpha: strokeAlpha })
      .moveTo(-160, 19)
      .lineTo(160, 19)
      .stroke({ color: 0xffffff, width: 1, alpha: hovered && enabled ? 0.3 : 0.12 });
  }

  for (const def of buttonDefs) {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    const bg = new Graphics();
    const text = new Text({
      text: def.label,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 22,
        fill: def.enabled ? 0xffd07a : 0x9ca6ba,
        fontWeight: 'bold',
        stroke: { color: 0x05080e, width: 4 },
      }),
    });
    text.x = -text.width / 2;
    text.y = -text.height / 2 - 1;
    redrawButton(bg, def.enabled, false);
    btn.addChild(bg, text);
    btn.on('pointerover', () => {
      btn.scale.set(def.enabled ? 1.04 : 1.01);
      text.style.fill = def.enabled ? 0xffffff : 0xc2cad9;
      redrawButton(bg, def.enabled, true);
      setStatus(def.note, 1.2);
    });
    btn.on('pointerout', () => {
      btn.scale.set(1);
      text.style.fill = def.enabled ? 0xffd07a : 0x9ca6ba;
      redrawButton(bg, def.enabled, false);
    });
    btn.on('pointerdown', () => {
      if (def.enabled) {
        onPick(def.action);
      } else {
        setStatus(def.note);
      }
    });
    buttons.push(btn);
    panel.addChild(btn);
  }

  // Music on/off toggle — a compact button in the top-right corner of the menu.
  let musicOn = opts.musicEnabled ?? true;
  const musicBtn = new Container();
  musicBtn.eventMode = 'static';
  musicBtn.cursor = 'pointer';
  const musicBg = new Graphics();
  const musicText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 15,
      fontWeight: 'bold',
      fill: 0xffe0a4,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });
  const musicBtnW = 224;
  const musicBtnH = 42;
  function drawMusic(hovered: boolean) {
    const color = musicOn ? 0x6ee0a0 : 0x8390a8;
    musicBg.clear()
      .roundRect(-musicBtnW / 2, -musicBtnH / 2, musicBtnW, musicBtnH, 8)
      .fill({ color: 0x0a1320, alpha: hovered ? 0.9 : 0.72 })
      .stroke({ color, width: hovered ? 3 : 2, alpha: hovered ? 1 : 0.82 });
    musicText.text = musicOn ? '♪  МУЗЫКА: ВКЛ' : '♪  МУЗЫКА: ВЫКЛ';
    musicText.style.fill = musicOn ? 0xffe0a4 : 0x9ca6ba;
    musicText.x = -musicText.width / 2;
    musicText.y = -musicText.height / 2 - 1;
  }
  drawMusic(false);
  musicBtn.addChild(musicBg, musicText);
  musicBtn.on('pointerover', () => { musicBtn.scale.set(1.04); drawMusic(true); });
  musicBtn.on('pointerout', () => { musicBtn.scale.set(1); drawMusic(false); });
  musicBtn.on('pointerdown', () => {
    musicOn = !musicOn;
    drawMusic(false);
    opts.onMusicToggle?.(musicOn);
  });
  c.addChild(musicBtn);

  function layout(w: number, h: number) {
    // Just a whisper of darkening for overall contrast — the menu video stays visible.
    dim.clear().rect(0, 0, w, h).fill({ color: 0x040b14, alpha: 0.2 });
    // The old strong blue left-panel is gone (it covered the whole start screen + video).
    leftShade.clear();

    const screenLayout = getStartScreenLayout(w, h, buttons.length);
    panel.x = screenLayout.panelX;
    panel.y = screenLayout.panelY;
    panel.scale.set(screenLayout.panelScale);

    title.x = 0;
    title.y = 0;
    subtitle.x = 6;
    subtitle.y = 66;
    tagline.x = 7;
    tagline.y = 112;

    buttons.forEach((btn, i) => {
      btn.x = screenLayout.buttonX;
      btn.y = screenLayout.buttonStartY + i * screenLayout.buttonGap;
    });

    // Blue frame hugging ONLY the menu button rows (panel coords → scales with panel).
    const firstCenterY = screenLayout.buttonStartY;
    const lastCenterY = screenLayout.buttonStartY + Math.max(0, buttons.length - 1) * screenLayout.buttonGap;
    const padX = 16;
    const padY = 16;
    const mbX = screenLayout.buttonX - 180 - padX;
    const mbY = firstCenterY - 27 - padY;
    const mbW = 360 + padX * 2;
    const mbH = (lastCenterY - firstCenterY) + 54 + padY * 2;
    menuBacking.clear()
      .roundRect(mbX, mbY, mbW, mbH, 16)
      .fill({ color: 0x06101f, alpha: 0.6 })
      .stroke({ color: 0x3b6ea5, width: 2, alpha: 0.6 });

    statusWidth = screenLayout.statusWidth;
    statusHeight = screenLayout.statusHeight;
    statusPanel.x = screenLayout.statusX;
    statusPanel.y = screenLayout.statusY;
    statusBg.clear()
      .roundRect(0, 0, statusWidth, statusHeight, 12)
      .fill({ color: 0x060b13, alpha: 0.68 })
      .stroke({ color: 0xffb44a, width: 1.5, alpha: 0.5 });
    statusText.style.wordWrapWidth = screenLayout.statusWordWrapWidth;
    centerStatusText();

    // Top-right corner, clear of the title (top-left).
    musicBtn.x = w - musicBtnW / 2 - 20;
    musicBtn.y = musicBtnH / 2 + 18;
  }
  layout(width, height);
  statusPanel.visible = false;

  return {
    container: c,
    show() {
      c.visible = true;
      setStatus('Начни с первого вылета: взлети, защити караван, выбери первый апгрейд и дотяни до маяка.', 3.2);
    },
    hide() { c.visible = false; },
    update(dt: number) {
      if (!statusPanel.visible) return;
      if (statusLife > 0) {
        statusLife -= dt;
        if (statusLife <= 0) statusLife = 0;
      } else {
        statusPanel.alpha = Math.max(0, statusPanel.alpha - dt * 2);
        if (statusPanel.alpha <= 0) statusPanel.visible = false;
      }
    },
    resize(w: number, h: number) { layout(w, h); },
  };
}
