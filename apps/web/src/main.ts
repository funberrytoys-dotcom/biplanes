import {
  bindTelegramViewportChange,
  getTelegramViewportHeight,
  initializeTelegramMiniApp,
} from './telegram-mini-app.js';

function syncAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${getTelegramViewportHeight() ?? window.innerHeight}px`);
}

function isPhoneRuntime() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowSide = Math.min(window.innerWidth, window.innerHeight) <= 520;
  const shortLongSide = Math.max(window.innerWidth, window.innerHeight) <= 1100;
  return coarsePointer && narrowSide && shortLongSide;
}

const telegram = initializeTelegramMiniApp();
const params = new URLSearchParams(window.location.search);
if (telegram.isTelegramMiniApp) {
  params.set('phone', '');
  if (
    !params.has('story') &&
    !params.has('arena') &&
    !params.has('skytest') &&
    !params.has('gunfeelLab') &&
    !params.has('flightLab') &&
    !params.has('oilshot')
  ) {
    params.set('arena', '');
  }
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
if (telegram.isTelegramMiniApp || params.has('phone') || params.has('iphone') || isPhoneRuntime()) {
  document.body.classList.add('phone-runtime');
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
bindTelegramViewportChange(syncAppHeight);

const container = document.getElementById('game');
if (!container) throw new Error('No #game element');

const { startGame } = await import('@biplanes/app');
startGame(container).catch(err => {
  console.error('Game failed to start', err);
  container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
});
