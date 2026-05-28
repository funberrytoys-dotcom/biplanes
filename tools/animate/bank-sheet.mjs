#!/usr/bin/env node
/**
 * bank-sheet.mjs
 *
 * Берёт ОДНУ статичную картинку самолёта (строгий side-profile),
 * генерит 16-кадровый bank-cycle спрайт-шит:
 *   neutral → roll left 30° → neutral (бесшовный loop)
 *
 * Выход: PNG sprite-sheet + JSON атлас в формате Pixi.
 *
 * Использование:
 *   node tools/animate/bank-sheet.mjs <input.png> [output-name]
 *
 * Пример:
 *   node tools/animate/bank-sheet.mjs \
 *     docs/references/style/plane-player-canonical.png \
 *     plane-player-bank
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

// ───── НАСТРОЙКИ ─────────────────────────────────────────────────────────────

const FRAMES = 16;                 // Кадров в анимации
const MAX_ANGLE_DEG = 30;          // Глубина крена в градусах
const GRID_COLS = 4;               // Колонок в спрайт-шите
const GRID_ROWS = 4;               // Строк в спрайт-шите
const OUTPUT_DIR = 'docs/animations/test';
const ROTATION_DIRECTION = -1;     // -1 = bank LEFT (counter-clockwise), +1 = bank RIGHT

// ───── ВХОД ──────────────────────────────────────────────────────────────────

const INPUT_PATH = process.argv[2];
const OUTPUT_NAME = process.argv[3] || 'bank-cycle';

if (!INPUT_PATH) {
  console.error('❌ Ошибка: укажи путь к исходной картинке.');
  console.error('   Пример: node tools/animate/bank-sheet.mjs docs/references/style/plane.png');
  process.exit(1);
}

// ───── КРИВАЯ УГЛОВ ──────────────────────────────────────────────────────────
// Используем cosine ease-in-out для плавного крена в обе стороны.
//   t=0    → 0°       (нейтраль)
//   t=0.5  → 30°      (пик крена)
//   t=1    → 0°       (вернулись в нейтраль)
// Идеальный бесшовный loop.

const angles = Array.from({ length: FRAMES }, (_, i) => {
  const t = i / FRAMES;
  const eased = (1 - Math.cos(t * 2 * Math.PI)) / 2;  // 0..1..0
  return ROTATION_DIRECTION * MAX_ANGLE_DEG * eased;
});

// ───── РАБОТА ────────────────────────────────────────────────────────────────

async function main() {
  // Проверяем что входной файл существует
  try {
    await fs.access(INPUT_PATH);
  } catch {
    console.error(`❌ Файл не найден: ${INPUT_PATH}`);
    process.exit(1);
  }

  // Создаём выходную папку
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Читаем метаданные исходника
  const meta = await sharp(INPUT_PATH).metadata();
  const sourceW = meta.width;
  const sourceH = meta.height;
  console.log(`📐 Source: ${sourceW}×${sourceH} (${meta.format})`);

  // Auto-chroma-key: вырезаем magenta-фон (#FF00FF) → прозрачность.
  // Tolerance ±20 на канал чтобы поймать края с лёгкой растушёвкой.
  const { data: rawData, info: rawInfo } = await sharp(INPUT_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let keyed = 0;
  for (let i = 0; i < rawData.length; i += 4) {
    const r = rawData[i];
    const g = rawData[i + 1];
    const b = rawData[i + 2];
    if (r > 235 && g < 40 && b > 235) {
      rawData[i + 3] = 0;
      keyed++;
    }
  }
  console.log(`🔑 Chroma-keyed ${keyed} magenta pixels → transparent`);

  // Кэшируем чистый source-buffer один раз
  const sourceBuffer = await sharp(rawData, {
    raw: { width: rawInfo.width, height: rawInfo.height, channels: 4 },
  }).png().toBuffer();

  // Размер ячейки с запасом под поворот.
  // При повороте на 30° картинка может вылезти за исходный bbox,
  // поэтому добавляем 30% padding и используем квадратную ячейку.
  const cellSize = Math.ceil(Math.max(sourceW, sourceH) * 1.3);
  console.log(`📏 Cell size: ${cellSize}×${cellSize}`);

  // Генерим каждый кадр: поворот → центрирование на квадратной ячейке
  const cells = [];
  for (let i = 0; i < FRAMES; i++) {
    const angle = angles[i];

    // Sharp поворачивает изображение, расширяя canvas чтобы вместить
    const rotated = await sharp(sourceBuffer)
      .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const rotMeta = await sharp(rotated).metadata();

    // Накладываем повёрнутую картинку по центру квадратной ячейки
    const cell = await sharp({
      create: {
        width: cellSize,
        height: cellSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: rotated,
        left: Math.floor((cellSize - rotMeta.width) / 2),
        top: Math.floor((cellSize - rotMeta.height) / 2),
      }])
      .png()
      .toBuffer();

    cells.push(cell);
  }

  // Складываем все ячейки в один большой спрайт-шит
  const sheetW = cellSize * GRID_COLS;
  const sheetH = cellSize * GRID_ROWS;

  const composites = cells.map((buf, i) => ({
    input: buf,
    left: (i % GRID_COLS) * cellSize,
    top: Math.floor(i / GRID_COLS) * cellSize,
  }));

  const sheetPath = path.join(OUTPUT_DIR, `${OUTPUT_NAME}.png`);
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(sheetPath);

  // Atlas JSON в формате Pixi spritesheet
  const atlas = {
    frames: {},
    meta: {
      app: 'biplanes-animate-tool',
      version: '1.0',
      image: `${OUTPUT_NAME}.png`,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: '1',
    },
    animations: {
      [OUTPUT_NAME]: [],
    },
  };

  for (let i = 0; i < FRAMES; i++) {
    const frameName = `${OUTPUT_NAME}-${String(i).padStart(2, '0')}`;
    atlas.frames[frameName] = {
      frame: {
        x: (i % GRID_COLS) * cellSize,
        y: Math.floor(i / GRID_COLS) * cellSize,
        w: cellSize,
        h: cellSize,
      },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cellSize, h: cellSize },
      sourceSize: { w: cellSize, h: cellSize },
    };
    atlas.animations[OUTPUT_NAME].push(frameName);
  }

  const atlasPath = path.join(OUTPUT_DIR, `${OUTPUT_NAME}.json`);
  await fs.writeFile(atlasPath, JSON.stringify(atlas, null, 2));

  // ───── ОТЧЁТ ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('✅ Готово.');
  console.log(`   Sprite sheet: ${sheetPath} (${sheetW}×${sheetH})`);
  console.log(`   Atlas JSON:   ${atlasPath}`);
  console.log(`   Кадров:       ${FRAMES}`);
  console.log(`   Углы (°):     ${angles.map((a) => a.toFixed(1)).join(', ')}`);
  console.log('');
  console.log('💡 Чтобы использовать в Pixi:');
  console.log('     const sheet = await Assets.load("' + atlasPath + '");');
  console.log('     const anim = new AnimatedSprite(sheet.animations["' + OUTPUT_NAME + '"]);');
  console.log('     anim.animationSpeed = 0.5;  // ~30fps');
  console.log('     anim.play();');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
