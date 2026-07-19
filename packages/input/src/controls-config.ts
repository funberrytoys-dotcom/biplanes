// Control-scheme toggles, resolvable from URL params + localStorage so the owner can
// A/B the new feel on a real phone with NO redeploy. Every behavioural control change
// hangs off one of these flags and each one defaults to the SAFE value, so a single
// `?controls=classic` (or the localStorage mirror) reverts the whole scheme instantly.
//
//   ?input=legacy        — old touch-event input path (revert the freshness fix)
//   ?steer=screen        — opt-in screen-relative steering (default: classic heading-relative)
//   ?haptics=off         — disable the stall buzz
//   ?controls=classic    — master rollback: legacy input + classic steering at once
//
// Mirrors (persist across reloads on the phone):
//   localStorage['biplanes.input']    = 'legacy' | 'fresh'
//   localStorage['biplanes.steer']    = 'screen' | 'classic'
//   localStorage['biplanes.haptics']  = 'off' | 'on'
//   localStorage['biplanes.controls'] = 'classic' | 'fresh'

export interface ControlsConfig {
  /** Use the Pointer-Events + per-frame-fresh input path (the #1 responsiveness fix). */
  freshInput: boolean;
  /** Screen-relative steering ("stick up = nose toward the top of the screen" regardless of facing). */
  screenRelativeSteer: boolean;
  /** Allow a short vibration buzz on stall (mobile only; no-op where unsupported). */
  haptics: boolean;
  /** Colour the throttle gauge honestly (green = at/above the physics stall line). */
  honestGauge: boolean;
  /** Eye-comfort: mute the saturation/contrast of the backdrop (softens the pink-on-pink glare). */
  eyeComfort: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
}

export const DEFAULT_CONTROLS_CONFIG: ControlsConfig = {
  freshInput: true,
  screenRelativeSteer: false,
  haptics: true,
  honestGauge: true,
  eyeComfort: true,
};

/** URL param (if present & non-empty) wins, else the localStorage mirror, else null. */
function readChoice(
  params: URLSearchParams,
  storage: StorageLike | null,
  urlKey: string,
  storeKey: string,
): string | null {
  const fromUrl = params.get(urlKey);
  if (fromUrl != null && fromUrl !== '') return fromUrl.toLowerCase();
  if (storage) {
    try {
      const v = storage.getItem(storeKey);
      if (v != null && v !== '') return v.toLowerCase();
    } catch {
      /* storage may throw in private mode — fall through to default */
    }
  }
  return null;
}

/**
 * Pure resolver — no DOM access, so it is fully unit-testable. The thin
 * {@link getControlsConfig} wrapper feeds it the live URL + localStorage.
 */
export function resolveControlsConfig(
  params: URLSearchParams,
  storage: StorageLike | null,
): ControlsConfig {
  const config: ControlsConfig = { ...DEFAULT_CONTROLS_CONFIG };

  const input = readChoice(params, storage, 'input', 'biplanes.input');
  if (input === 'legacy' || input === 'classic' || input === 'old' || input === 'off') {
    config.freshInput = false;
  } else if (input === 'fresh' || input === 'new' || input === 'on') {
    config.freshInput = true;
  }

  const steer = readChoice(params, storage, 'steer', 'biplanes.steer');
  if (steer === 'screen' || steer === 'relative' || steer === 'on') {
    config.screenRelativeSteer = true;
  } else if (steer === 'classic' || steer === 'heading' || steer === 'off') {
    config.screenRelativeSteer = false;
  }

  const haptics = readChoice(params, storage, 'haptics', 'biplanes.haptics');
  if (haptics === 'off' || haptics === 'false' || haptics === '0' || haptics === 'no') {
    config.haptics = false;
  } else if (haptics === 'on' || haptics === 'true' || haptics === '1' || haptics === 'yes') {
    config.haptics = true;
  }

  const gauge = readChoice(params, storage, 'gauge', 'biplanes.gauge');
  if (gauge === 'legacy' || gauge === 'old' || gauge === 'off') {
    config.honestGauge = false;
  } else if (gauge === 'honest' || gauge === 'new' || gauge === 'on') {
    config.honestGauge = true;
  }

  const eyes = readChoice(params, storage, 'eyes', 'biplanes.eyes');
  if (eyes === 'vivid' || eyes === 'off' || eyes === 'bright') {
    config.eyeComfort = false;
  } else if (eyes === 'comfort' || eyes === 'on' || eyes === 'soft') {
    config.eyeComfort = true;
  }

  // Master rollback wins over the individual flags — one switch reverts EVERY behavioural
  // change this scheme adds (input path, steering, and the stall buzz).
  const master = readChoice(params, storage, 'controls', 'biplanes.controls');
  if (master === 'classic' || master === 'legacy' || master === 'old') {
    config.freshInput = false;
    config.screenRelativeSteer = false;
    config.haptics = false;
    config.honestGauge = false;
    config.eyeComfort = false; // classic = the original vivid backdrop
  }

  return config;
}

/** Live reader for the browser — safe to call outside a browser (returns defaults). */
export function getControlsConfig(): ControlsConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTROLS_CONFIG };
  const params = new URLSearchParams(window.location.search);
  let storage: StorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return resolveControlsConfig(params, storage);
}
