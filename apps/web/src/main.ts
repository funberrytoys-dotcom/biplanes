import { startGame } from '@biplanes/app';

const params = new URLSearchParams(window.location.search);
if (params.has('device') || params.has('phone') || params.has('iphone')) {
  document.body.classList.add('device-preview');
}

const container = document.getElementById('game');
if (!container) throw new Error('No #game element');
startGame(container).catch(err => {
  console.error('Game failed to start', err);
  container.innerHTML = `<pre style="color:#f88;padding:20px;font:14px monospace">${String(err)}</pre>`;
});
