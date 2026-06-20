import {
  bindTelegramViewportChange,
  getTelegramViewportHeight,
  initializeTelegramMiniApp,
} from './telegram-mini-app.js';

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

const { startGame } = await import('@biplanes/app');
startGame(container).catch(err => {
  console.error('Game failed to start', err);
  container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
});
