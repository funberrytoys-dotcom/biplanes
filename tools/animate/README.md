# tools/animate

Скрипты для генерации анимационных sprite-sheet'ов из статичных PNG.

Не требуют рисования руками и не тратят кредиты внешних AI-сервисов — чистая математика поверх существующих изображений.

---

## bank-sheet.mjs

Из одной картинки самолёта в строгом боковом профиле делает **16-кадровый bank-cycle**: нейтраль → крен в сторону → возврат в нейтраль (бесшовный loop).

### Запуск

```bash
# Положи canonical PNG куда-нибудь, например в docs/references/style/
# Затем:
pnpm animate:bank docs/references/style/plane-player-canonical.png plane-player-bank
```

Параметры:
- `<input.png>` — путь к исходной картинке (обязательно)
- `[output-name]` — префикс выходных файлов (по умолчанию `bank-cycle`)

### Что получишь

В папке `docs/animations/test/`:

- `<output-name>.png` — спрайт-шит 4×4 с 16 кадрами
- `<output-name>.json` — Pixi atlas, готов к загрузке через `Assets.load()`

### Настройки внутри файла

В верхней части `bank-sheet.mjs` можно покрутить:

| Константа | По умолчанию | Что меняет |
|---|---|---|
| `FRAMES` | 16 | Количество кадров (можно 12, 24, 32...) |
| `MAX_ANGLE_DEG` | 30 | Глубина крена в градусах |
| `GRID_COLS / GRID_ROWS` | 4 / 4 | Раскладка ячеек в шите |
| `ROTATION_DIRECTION` | -1 | -1 = крен влево, +1 = крен вправо |

### Кривая углов

Используется **cosine ease-in-out**: плавный заход в крен, плавный выход. Получается естественное движение «плавно накренился — плавно вернулся», без рывков.

### Использование в игре (Pixi v8)

```ts
import { Assets, AnimatedSprite } from 'pixi.js';

const sheet = await Assets.load('docs/animations/test/plane-player-bank.json');
const anim = new AnimatedSprite(sheet.animations['plane-player-bank']);
anim.animationSpeed = 0.5;  // ~30fps при ticker 60Hz
anim.anchor.set(0.5);
anim.play();
app.stage.addChild(anim);
```

---

## Что ещё можно сделать в этой папке (планы)

| Скрипт | Что будет делать |
|---|---|
| `dive-sheet.mjs` | Pitch nose-down анимация |
| `climb-sheet.mjs` | Pitch nose-up анимация |
| `death-spin.mjs` | Вращение + смещение для сбитого самолёта |
| `hover-sheet.mjs` | Лёгкое вертикальное колебание (Y +/-2px) |
| `propeller-overlay.mjs` | 8 кадров крутящегося винта на прозрачном фоне для наложения поверх корпуса |

Все эти задачи — чистая математика, не требуют AI. Пишем по запросу.
