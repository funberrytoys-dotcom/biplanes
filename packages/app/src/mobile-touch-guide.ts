export interface TouchGuideContext {
  width: number;
  maxTouchPoints: number;
}

export function shouldShowTouchGuide(ctx: TouchGuideContext): boolean {
  return ctx.maxTouchPoints > 0 || ctx.width <= 960;
}
