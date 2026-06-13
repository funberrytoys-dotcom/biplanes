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

      // W = throttle up, S = throttle down (no input = hold current)
      const throttleUp = keys.has('KeyW') || keys.has('ArrowUp');
      const throttleDown = keys.has('KeyS') || keys.has('ArrowDown');
      let throttleDelta: -1 | 0 | 1 = 0;
      if (throttleUp && !throttleDown) throttleDelta = 1;
      else if (throttleDown && !throttleUp) throttleDelta = -1;

      return {
        rotate,
        // Space serves a dual purpose: fire when piloting a plane, jump when controlling
        // the ejected pilot on foot. The tick router decides which based on world state.
        fire: keys.has('Space'),
        jump: keys.has('Space'),
        bomb: keys.has('KeyB'),
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        throttleDelta,
        eject: keys.has('KeyE'),
      };
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}
