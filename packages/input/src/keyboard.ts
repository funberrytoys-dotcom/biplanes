import type { PlayerCommand } from '@biplanes/shared';

export interface KeyboardController {
  current(): PlayerCommand;
  destroy(): void;
}

/**
 * Pure mapping from the set of currently-held key codes to a PlayerCommand.
 * Extracted so the (mutual-exclusion) routing logic is unit-testable without a DOM.
 */
export function commandFromKeys(keys: ReadonlySet<string>): PlayerCommand {
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  let rotate = 0; // analog-compatible; keyboard still steers at full ±1 deflection
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
    // Special weapon (rocket salvo): Q or B.
    special: keys.has('KeyQ') || keys.has('KeyB'),
    boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    throttleDelta,
    eject: keys.has('KeyE'),
  };
}

export function createKeyboardController(): KeyboardController {
  const keys = new Set<string>();
  const onDown = (e: KeyboardEvent) => keys.add(e.code);
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  // Clear all held keys when the window loses focus or the tab is hidden. Otherwise a
  // key held during alt-tab never receives its keyup and "sticks" — the plane keeps
  // steering/throttling on its own until that exact key is tapped again.
  const onBlur = () => keys.clear();
  const onVisibility = () => { if (typeof document !== 'undefined' && document.hidden) keys.clear(); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    current(): PlayerCommand {
      return commandFromKeys(keys);
    },
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
