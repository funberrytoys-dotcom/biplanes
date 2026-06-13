import { startGame } from '@biplanes/app';

function syncAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

function isPhoneRuntime() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowSide = Math.min(window.innerWidth, window.innerHeight) <= 520;
  const shortLongSide = Math.max(window.innerWidth, window.innerHeight) <= 1100;
  return coarsePointer && narrowSide && shortLongSide;
}

const params = new URLSearchParams(window.location.search);
if (params.has('device')) {
  document.body.classList.add('device-preview');
}
if (params.has('phone') || params.has('iphone') || isPhoneRuntime()) {
  document.body.classList.add('phone-runtime');
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);

const container = document.getElementById('game');
if (!container) throw new Error('No #game element');
startGame(container).catch(err => {
  console.error('Game failed to start', err);
  container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
});
