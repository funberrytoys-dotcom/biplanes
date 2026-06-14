import { isStalling, type WorldState } from '@biplanes/core';
import { resolveFlightAudioMix } from './game-audio-cues.js';
import { assetUrl } from '../asset-url.js';
import { AUDIO_UNLOCK_EVENTS, type AudioUnlockEventName } from './audio-unlock-events.js';

type SoundKey =
  | 'engine'
  | 'boost'
  | 'dive'
  | 'uiSelect'
  | 'upgradePick'
  | 'warning'
  | 'machineGun'
  | 'heavyGun'
  | 'airplaneExplosion'
  | 'heavyExplosion'
  | 'victory'
  | 'defeat';

const SOUND_URLS: Record<SoundKey, string> = {
  engine: assetUrl('assets/audio/war-on-water/engine.ogg'),
  boost: assetUrl('assets/audio/war-on-water/boost.ogg'),
  dive: assetUrl('assets/audio/war-on-water/dive.ogg'),
  uiSelect: assetUrl('assets/audio/war-on-water/button-click.ogg'),
  upgradePick: assetUrl('assets/audio/war-on-water/cartridges.ogg'),
  warning: assetUrl('assets/audio/war-on-water/call-help.ogg'),
  machineGun: assetUrl('assets/audio/war-on-water/machine-gun.ogg'),
  heavyGun: assetUrl('assets/audio/war-on-water/heavy-gun.ogg'),
  airplaneExplosion: assetUrl('assets/audio/war-on-water/airplane-explosion.ogg'),
  heavyExplosion: assetUrl('assets/audio/war-on-water/heavy-explosion.ogg'),
  victory: assetUrl('assets/audio/war-on-water/victory.ogg'),
  defeat: assetUrl('assets/audio/war-on-water/defeat.ogg'),
};

const ENGINE_LOOP_ENABLED = true;
// Synth beeps now (clean oscillator tones, not the old voice clip), so warnings
// are useful instead of grating.
const AUDIO_WARNING_BEEPS_ENABLED = true;

interface LoopLayer {
  key: SoundKey;
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
}

function rampParam(param: AudioParam, value: number, now: number, duration = 0.08) {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, duration);
}

export interface GameAudioHandle {
  unlock(): void;
  updateFlight(dt: number, state: WorldState, gameRunning: boolean, choicesShowing: boolean): void;
  playUiSelect(): void;
  playUpgradeOpen(): void;
  playUpgradePick(): void;
  playGunshot(heavy: boolean, ownerIsPlayer: boolean): void;
  playImpact(strong: boolean): void;
  playExplosion(): void;
  playThunder(): void;
  playVictory(): void;
  playDefeat(): void;
  playSalvo(): void;
  playBoostKick(): void;
  playLevelUp(): void;
  playWaveClear(): void;
  destroy(): void;
}

export function createGameAudio(): GameAudioHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let warningTimer = 0;
  let lastWarning: string | null = null;
  let disposed = false;
  const buffers = new Map<SoundKey, AudioBuffer>();
  const loading = new Set<SoundKey>();
  const loops: Record<'engine' | 'boost' | 'dive', LoopLayer> = {
    engine: { key: 'engine', source: null, gain: null },
    boost: { key: 'boost', source: null, gain: null },
    dive: { key: 'dive', source: null, gain: null },
  };

  function ensureContext() {
    if (disposed) return null;
    if (ctx) return ctx;

    const AudioContextCtor = window.AudioContext
      ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    ctx = new AudioContextCtor();
    master = ctx.createGain();
    master.gain.value = 0.92;
    master.connect(ctx.destination);

    for (const key of Object.keys(SOUND_URLS) as SoundKey[]) {
      void loadBuffer(key);
    }

    return ctx;
  }

  async function loadBuffer(key: SoundKey) {
    const audioCtx = ensureContext();
    if (!audioCtx || buffers.has(key) || loading.has(key)) return;
    loading.add(key);
    try {
      const res = await fetch(SOUND_URLS[key]);
      const data = await res.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(data);
      buffers.set(key, buffer);
    } catch {
      // Audio is optional: a missing SFX should never break the game loop.
    } finally {
      loading.delete(key);
    }
  }

  function resume() {
    const audioCtx = ensureContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
  }

  function primeSilentTap() {
    const audioCtx = ensureContext();
    if (!audioCtx || !master) return;
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    src.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    src.connect(gain);
    gain.connect(master);
    src.start(0);
  }

  function ensureLoop(layer: LoopLayer) {
    const audioCtx = ensureContext();
    if (!audioCtx || !master) return null;
    if (layer.source && layer.gain) return layer;

    const buffer = buffers.get(layer.key);
    if (!buffer) {
      void loadBuffer(layer.key);
      return null;
    }

    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = layer.key === 'engine'
      ? Math.min(0.22, buffer.duration * 0.28)
      : Math.min(0.035, buffer.duration * 0.15);
    source.loopEnd = layer.key === 'engine'
      ? Math.max(source.loopStart + 0.1, buffer.duration - Math.min(0.22, buffer.duration * 0.22))
      : buffer.duration;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(master);
    source.start(audioCtx.currentTime + 0.025, source.loopStart);
    layer.source = source;
    layer.gain = gain;
    return layer;
  }

  function playBuffer(key: SoundKey, volume = 1, rate = 1) {
    resume();
    const audioCtx = ensureContext();
    if (!audioCtx || !master) return;
    const buffer = buffers.get(key);
    if (!buffer) {
      void loadBuffer(key);
      return;
    }
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(master);
    src.start();
  }

  // Synthesized tone (oscillator + AD envelope). Used for crisp UI/feedback cues
  // and warning beeps so we don't depend on harsh sampled clips.
  function synthTone(
    freq: number,
    duration: number,
    peak: number,
    type: OscillatorType = 'sine',
    glideTo?: number,
    delay = 0,
  ) {
    resume();
    const audioCtx = ensureContext();
    if (!audioCtx || !master) return;
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  const unlock = () => {
    resume();
    primeSilentTap();
  };
  const unlockOptions: AddEventListenerOptions = { capture: true, passive: true };
  for (const eventName of AUDIO_UNLOCK_EVENTS) {
    window.addEventListener(eventName, unlock as EventListener, unlockOptions);
  }

  return {
    unlock,
    updateFlight(dt: number, state: WorldState, gameRunning: boolean, choicesShowing: boolean) {
      const audioCtx = ensureContext();
      if (!audioCtx) return;

      const mix = resolveFlightAudioMix({
        gameRunning,
        choicesShowing,
        playerAlive: state.player.alive,
        playerState: state.player.state,
        speed: state.player.kinematic.g,
        verticalVelocity: state.player.kinematic.velocity.y,
        throttleLevel: state.player.kinematic.throttleLevel,
        boostActive: state.player.boostActive ?? false,
        boostHeat: state.player.boostHeat ?? 0,
        noThrottleSec: state.player.noThrottleSec ?? 0,
        stalling: isStalling(state.player.kinematic),
      });
      const now = audioCtx.currentTime;

      const engine = ENGINE_LOOP_ENABLED ? ensureLoop(loops.engine) : loops.engine;
      const boost = ensureLoop(loops.boost);
      const dive = ensureLoop(loops.dive);

      if (engine?.gain && engine.source) {
        rampParam(engine.gain.gain, ENGINE_LOOP_ENABLED ? mix.engineGain : 0, now);
        rampParam(engine.source.playbackRate, mix.engineRate, now, 0.06);
      }
      if (boost?.gain && boost.source) {
        rampParam(boost.gain.gain, mix.boostGain, now, 0.04);
        rampParam(boost.source.playbackRate, 1.06 + mix.engineRate * 0.1, now, 0.05);
      }
      if (dive?.gain && dive.source) {
        rampParam(dive.gain.gain, mix.diveGain, now, 0.05);
        rampParam(dive.source.playbackRate, 0.95 + mix.diveGain * 0.55, now, 0.05);
      }

      if (AUDIO_WARNING_BEEPS_ENABLED && mix.warning) {
        warningTimer -= dt;
        if (mix.warning !== lastWarning) warningTimer = 0;
        if (warningTimer <= 0) {
          if (mix.warning === 'stall') {
            synthTone(330, 0.16, 0.12, 'triangle');
            warningTimer = 0.5;
          } else if (mix.warning === 'overheat') {
            synthTone(760, 0.1, 0.1, 'square');
            warningTimer = 0.62;
          } else {
            synthTone(520, 0.1, 0.09, 'square');
            warningTimer = 0.7;
          }
        }
      } else {
        warningTimer = 0;
      }
      lastWarning = mix.warning;
    },
    playUiSelect() {
      resume();
      playBuffer('uiSelect', 0.14, 0.88 + Math.random() * 0.08);
    },
    playUpgradeOpen() {
      resume();
      playBuffer('uiSelect', 0.24, 0.82);
    },
    playUpgradePick() {
      resume();
      playBuffer('upgradePick', 0.42, 0.98);
    },
    playGunshot(heavy: boolean, ownerIsPlayer: boolean) {
      const vol = ownerIsPlayer ? 0.68 : 0.3;
      playBuffer(heavy ? 'heavyGun' : 'machineGun', heavy ? vol * 1.18 : vol, heavy ? 0.9 + Math.random() * 0.08 : 0.96 + Math.random() * 0.08);
      if (ownerIsPlayer && !heavy && Math.random() < 0.35) {
        playBuffer('upgradePick', 0.1, 1.4 + Math.random() * 0.25);
      }
    },
    playImpact(strong: boolean) {
      playBuffer(strong ? 'heavyExplosion' : 'airplaneExplosion', strong ? 0.42 : 0.24, strong ? 1.05 : 1.28);
    },
    playExplosion() {
      playBuffer('airplaneExplosion', 0.82, 0.94);
      playBuffer('heavyExplosion', 0.54, 0.78);
    },
    playThunder() {
      playBuffer('heavyExplosion', 0.28, 0.52);
      playBuffer('dive', 0.16, 0.58);
    },
    playVictory() {
      playBuffer('victory', 0.68, 1);
    },
    playDefeat() {
      playBuffer('defeat', 0.58, 1);
    },
    playSalvo() {
      // Rocket whoosh: a quick descending tone + a softened heavy-gun thump.
      synthTone(440, 0.22, 0.16, 'sawtooth', 150);
      playBuffer('heavyGun', 0.34, 0.72 + Math.random() * 0.06);
    },
    playBoostKick() {
      // Afterburner light-up: rising sweep + a touch of the boost sample.
      synthTone(170, 0.34, 0.16, 'sawtooth', 540);
      playBuffer('boost', 0.3, 1.2);
    },
    playLevelUp() {
      // Ascending major triad chime — reads as a reward.
      synthTone(523, 0.16, 0.14, 'triangle', undefined, 0);
      synthTone(659, 0.16, 0.14, 'triangle', undefined, 0.08);
      synthTone(784, 0.3, 0.16, 'triangle', undefined, 0.16);
    },
    playWaveClear() {
      // Two-note rising fanfare to punctuate a cleared wave.
      synthTone(392, 0.14, 0.13, 'triangle', undefined, 0);
      synthTone(523, 0.26, 0.15, 'triangle', undefined, 0.12);
      playBuffer('upgradePick', 0.28, 1.0);
    },
    destroy() {
      disposed = true;
      for (const eventName of AUDIO_UNLOCK_EVENTS as readonly AudioUnlockEventName[]) {
        window.removeEventListener(eventName, unlock as EventListener, { capture: true });
      }
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
