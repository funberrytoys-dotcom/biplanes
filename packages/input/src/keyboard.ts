import type { PlayerCommand } from '@biplanes/shared';

export interface KeyboardController {
  current(): PlayerCommand;
  destroy(): void;
}

export function createKeyboardController(): KeyboardController {
  const keys = new Set<string>();
  const onDown = (e: KeyboardEvent) => keys.add(e.code);
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  return {
    current(): PlayerCommand {
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      let rotate: -1 | 0 | 1 = 0;
      if (left && !right) rotate = -1;
      else if (right && !left) rotate = 1;

      return {
        rotate,
        fire: keys.has('Space'),
        bomb: keys.has('ShiftLeft') || keys.has('KeyB'),
      };
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}
