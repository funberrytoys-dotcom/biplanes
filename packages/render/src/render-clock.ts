export interface RenderClock {
  /** Return the dt the renderer should use this frame (after pause/slow-mo). */
  tick(realDt: number): number;
  /**
   * Freeze rendering for N upcoming frames. Re-calling extends to max(current, N).
   *
   * Gated by a real-time cooldown so sustained rapid-fire hits don't chain
   * 60ms pauses into a continuous freeze. The first hit feels punchy; for the
   * next ~150ms additional `hitPause` calls are silently ignored.
   */
  hitPause(frames: number): void;
  /** Engage slow-mo at `scale` for `durationSec`, then ramp back to 1.0 over `recoverySec`. */
  slowMo(scale: number, durationSec: number, recoverySec: number): void;
}

const HIT_PAUSE_COOLDOWN_SEC = 0.15;

export function createRenderClock(): RenderClock {
  let pauseFrames = 0;

  let slowmoScale = 1;
  let slowmoTimeLeft = 0;
  let slowmoRecoveryLeft = 0;
  let slowmoRecoveryTotal = 0;

  let realTimeAcc = 0;
  let lastHitPauseTime = -Infinity;

  return {
    tick(realDt: number): number {
      realTimeAcc += realDt;
      if (pauseFrames > 0) {
        pauseFrames--;
        return 0;
      }
      let scale = 1;
      if (slowmoTimeLeft > 0) {
        slowmoTimeLeft = Math.max(0, slowmoTimeLeft - realDt);
        scale = slowmoScale;
      } else if (slowmoRecoveryLeft > 0) {
        const t = slowmoRecoveryLeft / slowmoRecoveryTotal; // 1 → 0
        scale = slowmoScale + (1 - slowmoScale) * (1 - t);
        slowmoRecoveryLeft = Math.max(0, slowmoRecoveryLeft - realDt);
      }
      return realDt * scale;
    },
    hitPause(frames: number) {
      if (realTimeAcc - lastHitPauseTime < HIT_PAUSE_COOLDOWN_SEC) return;
      pauseFrames = Math.max(pauseFrames, frames);
      lastHitPauseTime = realTimeAcc;
    },
    slowMo(scale: number, durationSec: number, recoverySec: number) {
      slowmoScale = scale;
      slowmoTimeLeft = durationSec;
      slowmoRecoveryLeft = recoverySec;
      slowmoRecoveryTotal = recoverySec;
    },
  };
}
