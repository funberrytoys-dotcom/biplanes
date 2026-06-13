import { describe, expect, it } from 'vitest';
import { formatHudReadout } from './hud-readout.js';

describe('formatHudReadout', () => {
  it('uses player-facing escort language', () => {
    const text = formatHudReadout({
      mode: 'escort',
      level: 1,
      timeSec: 12.4,
      enemyAlive: 3,
      playerScore: 2,
      enemyScore: 0,
      caravanHpPct: 86,
      progressPct: 14,
      altitudeFt: 536,
      weaponTags: ['MG'],
      boostActive: false,
      boostHeatPct: 0,
      status: 'stable',
    });

    expect(text).toContain('КАРАВАН 86%');
    expect(text).toContain('МАРШРУТ 14%');
    expect(text).toContain('ПИРАТЫ 3');
    expect(text).not.toMatch(/ESCORT|BOGEYS|ALTITUDE|SYSTEM|SCORE/);
  });

  it('keeps critical warnings short enough for a compact phone HUD', () => {
    const text = formatHudReadout({
      mode: 'arena',
      level: 2,
      timeSec: 64,
      enemyAlive: 5,
      playerScore: 7,
      enemyScore: 1,
      altitudeFt: 420,
      weaponTags: ['MG', 'ROCKETS'],
      boostActive: true,
      boostHeatPct: 91,
      status: 'overheat',
    });

    expect(text).toContain('ПЕРЕГРЕВ');
    expect(text.split('\n').length).toBeLessThanOrEqual(4);
  });
});
