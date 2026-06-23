import { describe, it, expect } from 'vitest';
import {
  createWolfComet,
  stepWolfComet,
  damageWolfCometSection,
  wolfCometSectionWorldPos,
  wolfCometTurretsReadyToFire,
  wolfCometTurretFired,
  wolfCometHealthFraction,
  WOLF_COMET_TURRET_COUNT,
  WOLF_COMET_ENGINE_COUNT,
  WOLF_COMET_CORE_HP,
  WOLF_COMET_TURRET_HP,
  WOLF_COMET_ENGINE_HP,
} from './wolf-comet.js';

function fresh() {
  return createWolfComet(1000, 500, 4000, 1400);
}

describe('Wolf Comet carrier boss', () => {
  it('is built from turrets + engines + one core', () => {
    const c = fresh();
    expect(c.sections.filter(s => s.kind === 'turret')).toHaveLength(WOLF_COMET_TURRET_COUNT);
    expect(c.sections.filter(s => s.kind === 'engine')).toHaveLength(WOLF_COMET_ENGINE_COUNT);
    expect(c.sections.filter(s => s.kind === 'core')).toHaveLength(1);
    expect(c.coreExposed).toBe(false);
    expect(c.defeated).toBe(false);
  });

  it('section world position = airship origin + fractional offset × size', () => {
    const c = fresh();
    const turret = c.sections.find(s => s.kind === 'turret')!;
    const p = wolfCometSectionWorldPos(c, turret);
    expect(p.x).toBeCloseTo(1000 + turret.fx * 4000);
    expect(p.y).toBeCloseTo(500 + turret.fy * 1400);
  });

  it('drifts slowly and bleeds turret cooldowns over time', () => {
    let c = fresh();
    const x0 = c.position.x;
    c = stepWolfComet(c, 1.0);
    expect(c.position.x).toBeGreaterThan(x0);
    // a turret that started with cooldown ~0.4 is ready after 1s
    expect(wolfCometTurretsReadyToFire(c).length).toBeGreaterThan(0);
  });

  it('a fired turret goes back on cooldown, then re-arms', () => {
    let c = stepWolfComet(fresh(), 1.5); // arm everything
    const ready = wolfCometTurretsReadyToFire(c);
    expect(ready.length).toBeGreaterThan(0);
    const id = ready[0]!.id;
    c = wolfCometTurretFired(c, id);
    expect(c.sections.find(s => s.id === id)!.fireCooldown).toBeGreaterThan(0);
    expect(wolfCometTurretsReadyToFire(c).map(s => s.id)).not.toContain(id);
  });

  it('the CORE is invulnerable until every turret and engine is destroyed', () => {
    let c = fresh();
    // hammering the core while shielded does nothing
    c = damageWolfCometSection(c, 'core', 99999);
    expect(c.sections.find(s => s.id === 'core')!.hp).toBe(WOLF_COMET_CORE_HP);
    expect(c.defeated).toBe(false);

    // strip every turret + engine
    for (const s of c.sections.filter(s => s.kind === 'turret' || s.kind === 'engine')) {
      c = damageWolfCometSection(c, s.id, s.maxHp);
    }
    expect(c.coreExposed).toBe(true);

    // now the core takes damage and the ship can be defeated
    c = damageWolfCometSection(c, 'core', WOLF_COMET_CORE_HP);
    expect(c.sections.find(s => s.id === 'core')!.alive).toBe(false);
    expect(c.defeated).toBe(true);
  });

  it('damage is clamped and a dead section stops taking hits', () => {
    let c = fresh();
    const turret = c.sections.find(s => s.kind === 'turret')!;
    c = damageWolfCometSection(c, turret.id, WOLF_COMET_TURRET_HP + 500);
    const dead = c.sections.find(s => s.id === turret.id)!;
    expect(dead.hp).toBe(0);
    expect(dead.alive).toBe(false);
  });

  it('health fraction falls from 1 toward 0 as sections die', () => {
    let c = fresh();
    expect(wolfCometHealthFraction(c)).toBeCloseTo(1);
    c = damageWolfCometSection(c, 'turret0', WOLF_COMET_TURRET_HP);
    expect(wolfCometHealthFraction(c)).toBeLessThan(1);
    expect(wolfCometHealthFraction(c)).toBeGreaterThan(0);
  });

  it('total starting HP reflects the epic-but-beatable budget', () => {
    const c = fresh();
    const total = c.sections.reduce((a, s) => a + s.maxHp, 0);
    expect(total).toBe(
      WOLF_COMET_TURRET_COUNT * WOLF_COMET_TURRET_HP +
      WOLF_COMET_ENGINE_COUNT * WOLF_COMET_ENGINE_HP +
      WOLF_COMET_CORE_HP,
    );
  });
});
