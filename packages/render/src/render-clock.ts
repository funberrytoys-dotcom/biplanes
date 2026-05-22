export interface RenderClock {
  /** Return the dt the renderer should use this frame (after pause/slow-mo). */
  tick(realDt: number): number;
  /** Freeze rendering for N upcoming frames. Re-calling extends to max(current, N). */
  hitPause(frames: number): void;
  /** Engage slow-mo at `scale` for `durationSec`, then ramp back to 1.0 over `recoverySec`. */
  slowMo(scale: number, durationSec: number, recoverySec: number): void;
}

export function createRenderClock(): RenderClock {
  let pauseFrames = 0;

  let slowmoScale = 1;
  let slowmoTimeLeft = 0;
  let slowmoRecoveryLeft = 0;
  let slowmoRecoveryTotal = 0;

  return {
    tick(realDt: number): number {
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
      pauseFrames = Math.max(pauseFrames, frames);
    },
    slowMo(scale: number, durationSec: number, recoverySec: number) {
      slowmoScale = scale;
      slowmoTimeLeft = durationSec;
      slowmoRecoveryLeft = recoverySec;
      slowmoRecoveryTotal = recoverySec;
    },
  };
}
