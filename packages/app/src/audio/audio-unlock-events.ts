export const AUDIO_UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'] as const;

export type AudioUnlockEventName = typeof AUDIO_UNLOCK_EVENTS[number];
