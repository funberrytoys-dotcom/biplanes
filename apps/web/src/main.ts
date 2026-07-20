import {
  bindTelegramViewportChange,
  getTelegramViewportHeight,
  initializeTelegramMiniApp,
} from './telegram-mini-app.js';

// === Auto-update ============================================================
// An iOS home-screen PWA caches the HTML+bundle very hard, so deployed fixes don't
// reach the device until the cache is manually cleared. On boot, ask the server for
// the live version (cache-busted, no-store) and, if it's newer than this bundle,
// reload ONCE to it. Guarded against reload loops via sessionStorage. Bump in BOTH
// this constant AND apps/web/public/version.json (and BUILD_TAG in the app) per deploy.
const THIS_VERSION = 'v35-boot-flow';
void (async () => {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json().catch(() => null)) as { v?: string } | null;
    const live = data && typeof data.v === 'string' ? data.v : null;
    if (!live || live === THIS_VERSION) return;
    if (sessionStorage.getItem('biplanes.updTried') === live) return; // already tried — never loop
    sessionStorage.setItem('biplanes.updTried', live);
    const u = new URL(window.location.href);
    u.searchParams.set('v', live);
    window.location.replace(u.toString());
  } catch { /* offline / missing version.json — ignore */ }
})();

function syncAppHeight() {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${getTelegramViewportHeight() ?? viewportHeight}px`);
}

function isPhoneRuntime() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowSide = Math.min(window.innerWidth, window.innerHeight) <= 520;
  const shortLongSide = Math.max(window.innerWidth, window.innerHeight) <= 1100;
  return coarsePointer && narrowSide && shortLongSide;
}

const telegram = initializeTelegramMiniApp();
const params = new URLSearchParams(window.location.search);
let shouldReplaceUrl = false;
if (telegram.isTelegramMiniApp) {
  // Phone viewport, but DO NOT auto-skip into a mode: the menu is the hub now
  // (Arena + Забег + music toggle + exit), so Telegram opens on the menu like the
  // browser does. (Was: auto-started arena and skipped the menu.)
  params.set('phone', '');
  shouldReplaceUrl = true;
}
if (params.has('iphone15') && !params.has('arena') && !params.has('story')) {
  params.set('arena', '');
  shouldReplaceUrl = true;
}
if (shouldReplaceUrl) {
  const nextSearch = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
  );
}
if (params.has('device')) {
  document.body.classList.add('device-preview');
}
if (params.has('iphone15')) {
  document.body.classList.add('iphone15-preview');
}
if (telegram.isTelegramMiniApp || params.has('phone') || params.has('iphone') || params.has('iphone15') || isPhoneRuntime()) {
  document.body.classList.add('phone-runtime');
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);
bindTelegramViewportChange(syncAppHeight);

const container = document.getElementById('game');
if (!container) throw new Error('No #game element');

// Экран загрузки (лого + погоня) живёт в index.html и виден с ПЕРВОЙ отрисовки —
// до скачивания бандла и ассетов. Прячем его, когда игра готова, но НЕ раньше чем
// через 3 секунды: владелец хочет, чтобы лого и погоня успели прозвучать.
const BOOT_LOADER_MIN_MS = 3000;
function hideBootLoader() {
  const loader = document.getElementById('boot-loader');
  if (!loader) return;
  const wait = Math.max(0, BOOT_LOADER_MIN_MS - performance.now());
  window.setTimeout(() => {
    loader.classList.add('hidden');
    window.setTimeout(() => loader.remove(), 450);
  }, wait);
}

// Игровой шрифт должен быть ЗАГРУЖЕН до создания первых текстов: Pixi рисует текст
// в канвас один раз, и системный monospace на Android измеряется неверно (строки
// обрезались и налезали). Свой шрифт = одинаковая вёрстка на всех платформах.
try {
  await Promise.allSettled([
    document.fonts.load("700 16px BiplanesMono", 'РАУНД АБВ abc 09'),
    document.fonts.load("400 16px BiplanesMono", 'РАУНД АБВ abc 09'),
  ]);
} catch { /* шрифт не загрузился — останется системный monospace */ }

const { startGame } = await import('@biplanes/app');
startGame(container)
  .then(hideBootLoader)
  .catch(err => {
    console.error('Game failed to start', err);
    hideBootLoader();
    container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
  });
