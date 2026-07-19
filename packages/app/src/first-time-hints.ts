// Brief first-time control hints for Arena and «Забег». The Campaign already onboards via
// scripted mission guidance; these modes drop you straight into the air with no teaching.
// We show a SHORT, self-dismissing sequence (give gas → turn → dive/don't-stall) the first
// time only, gated by a per-mode "seen" flag so veterans are never nagged.

export type HintMode = 'arena' | 'run';

export interface FirstTimeHintInput {
  /** Seconds since the sortie/round began. */
  elapsedSec: number;
  /** Player has left the runway (state === 'flying'). */
  airborne: boolean;
  /** Player has issued at least one steer command. */
  hasTurned: boolean;
  /** Player has put the nose down at least once while airborne. */
  hasDived: boolean;
  /** Touch device → phrase hints for the lever/stick; else for the keyboard. */
  touch: boolean;
}

export interface FirstTimeHintResult {
  /** Hint to show, or null when there is nothing (or onboarding is finished). */
  text: string | null;
  /** True once the sequence is complete — caller should set the per-mode "seen" flag. */
  done: boolean;
}

/** Hard ceiling: stop hinting after this many seconds no matter what (anti-nag safety). */
export const MAX_HINT_SEC = 24;

function gasText(touch: boolean): string {
  return touch ? 'ДАЙ ГАЗ РЫЧАГОМ СПРАВА — ВЗЛЕТАЙ' : 'ДАЙ ГАЗ (W) — ВЗЛЕТАЙ';
}
function turnText(touch: boolean): string {
  return touch ? 'ТЯНИ РУЧКУ СЛЕВА — ПОВОРОТ' : 'РУЛИ (A / D) — ПОВОРОТ';
}
const DIVE_TEXT = 'ПИКИРУЙ ВНИЗ — НАБЕРИ СКОРОСТЬ, НЕ СВАЛИВАЙСЯ';

/**
 * Resolve the current first-time hint. Pure — the caller tracks the milestone booleans
 * and persists the "seen" flag when {@link FirstTimeHintResult.done} turns true.
 */
export function resolveFirstTimeHint(input: FirstTimeHintInput): FirstTimeHintResult {
  const milestonesDone = input.airborne && input.hasTurned && input.hasDived;
  if (milestonesDone || input.elapsedSec >= MAX_HINT_SEC) {
    return { text: null, done: true };
  }
  if (!input.airborne) return { text: gasText(input.touch), done: false };
  if (!input.hasTurned) return { text: turnText(input.touch), done: false };
  return { text: DIVE_TEXT, done: false };
}

/** localStorage key holding the per-mode "already onboarded" flag. */
export function hintSeenKey(mode: HintMode): string {
  return `biplanes.hintsSeen.${mode}`;
}

export function hintsAlreadySeen(mode: HintMode): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(hintSeenKey(mode)) === '1';
  } catch {
    return false;
  }
}

export function markHintsSeen(mode: HintMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(hintSeenKey(mode), '1');
  } catch {
    /* private mode — hints will simply show again next time, which is harmless */
  }
}
