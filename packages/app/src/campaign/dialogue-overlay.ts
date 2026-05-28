import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

export interface DialogueLine {
  speaker: string;
  text: string;
  portraitUrl?: string;
}

const SPEAKER_COLORS: Record<string, number> = {
  'Чико': 0xffb44a,
  'Мира': 0x72d7ff,
  'Искрик': 0xffdf55,
  'Тотти': 0x9ee6a8,
  'Старый Ас': 0xd8c8a8,
  'Шрам': 0xff6060,
  'Бублик': 0xf0c680,
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function createDialogueOverlay(width: number, height: number) {
  const container = new Container();
  container.visible = false;
  container.eventMode = 'static';

  const dim = new Graphics();
  const panel = new Graphics();
  const portraitBg = new Graphics();
  const portraitHolder = new Container();
  const portraitFallback = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 34,
      fontWeight: 'bold',
      fill: 0x1b2338,
    }),
  });
  portraitHolder.addChild(portraitBg, portraitFallback);

  const speakerText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 21,
      fontWeight: 'bold',
      fill: 0xffd07a,
      stroke: { color: 0x05080e, width: 4 },
    }),
  });
  const bodyText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      lineHeight: 31,
      fill: 0xfff4dc,
      wordWrap: true,
      wordWrapWidth: 760,
      stroke: { color: 0x05080e, width: 4 },
    }),
  });
  const hintText = new Text({
    text: 'Нажми, чтобы продолжить',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 15,
      fill: 0xc6d2ee,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });

  container.addChild(dim, panel, portraitHolder, speakerText, bodyText, hintText);

  let lines: DialogueLine[] = [];
  let index = 0;
  let done: (() => void) | null = null;
  let portraitSprite: Sprite | null = null;
  let screenW = width;
  let screenH = height;

  function redraw() {
    const panelW = Math.min(980, screenW - 64);
    const panelH = 190;
    const x = (screenW - panelW) / 2;
    const y = screenH - panelH - 42;
    dim.clear().rect(0, 0, screenW, screenH).fill({ color: 0x01040a, alpha: 0.38 });
    panel.clear()
      .roundRect(x, y, panelW, panelH, 10)
      .fill({ color: 0x07101f, alpha: 0.88 })
      .stroke({ color: 0xffb44a, width: 2, alpha: 0.72 })
      .roundRect(x + 12, y + 12, panelW - 24, panelH - 24, 8)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.12 });

    portraitHolder.x = x + 30;
    portraitHolder.y = y + 28;
    portraitBg.clear()
      .roundRect(0, 0, 126, 126, 10)
      .fill({ color: 0xffd07a, alpha: 0.9 })
      .stroke({ color: 0x1b0d05, width: 3, alpha: 0.85 });

    speakerText.x = x + 176;
    speakerText.y = y + 28;
    bodyText.x = x + 176;
    bodyText.y = y + 65;
    bodyText.style.wordWrapWidth = panelW - 220;
    hintText.x = x + panelW - hintText.width - 28;
    hintText.y = y + panelH - 34;
  }

  function setPortrait(url?: string) {
    if (portraitSprite) {
      portraitHolder.removeChild(portraitSprite);
      portraitSprite.destroy();
      portraitSprite = null;
    }
    portraitFallback.visible = !url;
    if (!url) return;
    portraitSprite = Sprite.from(url);
    portraitSprite.anchor.set(0.5);
    portraitSprite.x = 63;
    portraitSprite.y = 63;
    const scale = 118 / Math.max(portraitSprite.width, portraitSprite.height);
    portraitSprite.scale.set(scale);
    portraitHolder.addChild(portraitSprite);
  }

  function renderLine() {
    const line = lines[index];
    if (!line) return;
    speakerText.text = line.speaker;
    speakerText.style.fill = SPEAKER_COLORS[line.speaker] ?? 0xffd07a;
    bodyText.text = line.text;
    portraitFallback.text = initials(line.speaker);
    portraitFallback.x = (126 - portraitFallback.width) / 2;
    portraitFallback.y = (126 - portraitFallback.height) / 2;
    setPortrait(line.portraitUrl);
    redraw();
  }

  function advance() {
    if (!container.visible) return;
    index += 1;
    if (index >= lines.length) {
      container.visible = false;
      const cb = done;
      done = null;
      cb?.();
      return;
    }
    renderLine();
  }

  container.on('pointerdown', advance);

  redraw();

  return {
    container,
    show(nextLines: DialogueLine[], onDone?: () => void) {
      lines = nextLines;
      index = 0;
      done = onDone ?? null;
      container.visible = true;
      renderLine();
    },
    hide() {
      container.visible = false;
      done = null;
    },
    resize(w: number, h: number) {
      screenW = w;
      screenH = h;
      redraw();
    },
  };
}

export function createRadioPopup(width: number) {
  const container = new Container();
  container.visible = false;
  container.alpha = 0;

  const bg = new Graphics();
  const nameText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffd07a,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });
  const bodyText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      lineHeight: 23,
      fill: 0xfff4dc,
      wordWrap: true,
      wordWrapWidth: 420,
      stroke: { color: 0x05080e, width: 3 },
    }),
  });
  container.addChild(bg, nameText, bodyText);

  let life = 0;
  let maxLife = 0;
  let screenW = width;

  function redraw() {
    const w = Math.min(520, screenW - 42);
    bg.clear()
      .roundRect(0, 0, w, 76, 8)
      .fill({ color: 0x07101f, alpha: 0.82 })
      .stroke({ color: 0x72d7ff, width: 1.5, alpha: 0.68 });
    nameText.x = 16;
    nameText.y = 9;
    bodyText.x = 16;
    bodyText.y = 31;
    bodyText.style.wordWrapWidth = w - 32;
    container.x = Math.max(20, screenW - w - 28);
    container.y = 116;
  }

  redraw();

  return {
    container,
    show(line: DialogueLine, duration = 4.4) {
      nameText.text = line.speaker;
      nameText.style.fill = SPEAKER_COLORS[line.speaker] ?? 0xffd07a;
      bodyText.text = line.text;
      life = duration;
      maxLife = duration;
      container.visible = true;
      container.alpha = 1;
      redraw();
    },
    update(dt: number) {
      if (!container.visible) return;
      life -= dt;
      if (life <= 0) {
        container.visible = false;
        container.alpha = 0;
        return;
      }
      const fadeIn = Math.min(1, (maxLife - life) / 0.18);
      const fadeOut = Math.min(1, life / 0.4);
      container.alpha = Math.min(fadeIn, fadeOut);
    },
    hide() {
      life = 0;
      maxLife = 0;
      container.visible = false;
      container.alpha = 0;
    },
    resize(w: number) {
      screenW = w;
      redraw();
    },
  };
}
