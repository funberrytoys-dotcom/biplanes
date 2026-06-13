import { isStalling, type WorldState } from '@biplanes/core';
import { resolveFlightAudioMix } from './game-audio-cues.js';
import { assetUrl } from '../asset-url.js';

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
const AUDIO_WARNING_BEEPS_ENABLED = false;

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

  const unlock = () => resume();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

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
          playBuffer('warning', mix.warning === 'overheat' ? 0.3 : 0.22, mix.warning === 'stall' ? 0.86 : 1);
          warningTimer = mix.warning === 'stall' ? 0.52 : 0.7;
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
    destroy() {
      disposed = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
