import type { PlayerCommand } from '@biplanes/shared';

export interface TouchController {
  current(): PlayerCommand;
  destroy(): void;
  // expose for render to draw the buttons
  zones: {
    rotateCcw: { x: number; y: number; r: number };
    rotateCw: { x: number; y: number; r: number };
    fire: { x: number; y: number; r: number };
    bomb: { x: number; y: number; r: number };
    boost: { x: number; y: number; r: number };
  };
  updateZones(viewportW: number, viewportH: number): void;
}

export function createTouchController(canvas: HTMLElement): TouchController {
  const state = { rotateCcw: false, rotateCw: false, fire: false, bomb: false, boost: false };
  const zones = {
    rotateCcw: { x: 0, y: 0, r: 0 },
    rotateCw: { x: 0, y: 0, r: 0 },
    fire: { x: 0, y: 0, r: 0 },
    bomb: { x: 0, y: 0, r: 0 },
    boost: { x: 0, y: 0, r: 0 },
  };

  function updateZones(w: number, h: number) {
    const r = Math.min(w, h) * 0.08;
    zones.rotateCcw = { x: r * 1.2, y: h - r * 1.2, r };
    zones.rotateCw = { x: r * 3.2, y: h - r * 1.2, r };
    zones.fire = { x: w - r * 1.5, y: h - r * 1.5, r: r * 1.2 };
    zones.bomb = { x: w - r * 3.5, y: h - r * 1.5, r };
    zones.boost = { x: w - r * 2.5, y: h - r * 3.15, r: r * 0.9 };
  }

  function inZone(px: number, py: number, z: { x: number; y: number; r: number }) {
    const dx = px - z.x; const dy = py - z.y;
    return dx * dx + dy * dy < z.r * z.r;
  }

  function handleTouches(touches: TouchList) {
    state.rotateCcw = state.rotateCw = state.fire = state.bomb = state.boost = false;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (inZone(x, y, zones.rotateCcw)) state.rotateCcw = true;
      if (inZone(x, y, zones.rotateCw)) state.rotateCw = true;
      if (inZone(x, y, zones.fire)) state.fire = true;
      if (inZone(x, y, zones.bomb)) state.bomb = true;
      if (inZone(x, y, zones.boost)) state.boost = true;
    }
  }

  const onTouch = (e: TouchEvent) => {
    e.preventDefault();
    handleTouches(e.touches);
  };

  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('touchmove', onTouch, { passive: false });
  canvas.addEventListener('touchend', onTouch, { passive: false });
  canvas.addEventListener('touchcancel', onTouch, { passive: false });

  return {
    current(): PlayerCommand {
      let rotate: -1 | 0 | 1 = 0;
      if (state.rotateCcw && !state.rotateCw) rotate = -1;
      else if (state.rotateCw && !state.rotateCcw) rotate = 1;
      const touching = state.rotateCcw || state.rotateCw || state.fire || state.bomb || state.boost;
      return { rotate, fire: state.fire, bomb: state.bomb, throttleDelta: touching ? 1 : 0, eject: false, jump: false, boost: state.boost };
    },
    destroy() {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouch);
      canvas.removeEventListener('touchcancel', onTouch);
    },
    zones,
    updateZones,
  };
}
