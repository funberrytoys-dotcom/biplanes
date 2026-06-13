import { describe, expect, it } from 'vitest';
import { AUDIO_UNLOCK_EVENTS } from './audio-unlock-events.js';

describe('audio unlock events', () => {
  it('covers iOS touch gestures and desktop fallback gestures', () => {
    expect(AUDIO_UNLOCK_EVENTS).toContain('touchstart');
    expect(AUDIO_UNLOCK_EVENTS).toContain('pointerdown');
    expect(AUDIO_UNLOCK_EVENTS).toContain('click');
    expect(AUDIO_UNLOCK_EVENTS).toContain('keydown');
  });
});
