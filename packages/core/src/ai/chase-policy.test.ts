import { describe, it, expect } from 'vitest';
import { aiCommand, aiCommandPilotTarget, chasePolicy, createAiState } from './chase-policy.js';
import { DIFFICULTIES } from './difficulty.js';
import { WORLD_HEIGHT } from '@biplanes/shared';
import type { Plane } from '../entities/plane.js';
import type { Pilot } from '../entities/pilot.js';

function makePlane(x: number, y: number, heading: number): Plane {
  return {
    id: 1,
    faction: 'enemy',
    kinematic: {
      position: { x, y },
      velocity: { x: 200, y: 0 },
      heading,
      throttleOn: true,
      g: 1200, facing: 1, throttle: true, throttleLevel: 1,
    },
    hp: 30,
    maxHp: 30,
    weaponCooldown: 0,
    alive: true,
    state: 'flying',
    respawnTimer: 0,
  };
}

function makePilot(x: number, y: number, state: Pilot['state'] = 'parachute'): Pilot {
  return {
    id: 99,
    faction: 'player',
    position: { x, y },
    velocity: { x: 0, y: 60 },
    state,
    facing: 1,
    hp: 1,
    deathTimer: 0,
    groundedJumpCooldown: 0,
  };
}

describe('chase policy', () => {
  it('turns toward target when target is above', () => {
    const enemy = makePlane(500, 500, 0); // pointing right
    const target = makePlane(500, 400, 0); // above
    const cmd = chasePolicy(enemy, target);
    // In screen coords "up" is -y, so we need to rotate CCW (negative)
    expect(cmd.rotate).toBe(-1);
  });

  it('turns toward target when target is below', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(500, 600, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(1);
  });

  it('does not turn when target is directly ahead', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(900, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.rotate).toBe(0);
  });

  it('fires when target is roughly in front and close', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(700, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(true);
  });

  it('does not fire when target is behind', () => {
    const enemy = makePlane(500, 500, 0); // facing right
    const target = makePlane(200, 500, 0); // behind
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });

  it('does not fire when target is too far', () => {
    const enemy = makePlane(500, 500, 0);
    const target = makePlane(2500, 500, 0);
    const cmd = chasePolicy(enemy, target);
    expect(cmd.fire).toBe(false);
  });

  it('breaks off and stops firing when a head-on collision is likely', () => {
    const enemy = makePlane(700, 500, Math.PI);
    enemy.kinematic.velocity = { x: -900, y: 0 };
    enemy.kinematic.facing = -1;
    enemy.kinematic.throttleLevel = 1;
    const target = makePlane(500, 500, 0);
    target.faction = 'player';
    target.kinematic.velocity = { x: 900, y: 0 };

    const aiState = { ...createAiState(7), timeFlyingSec: 2 };
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.medium, aiState, enemy.hp, 1 / 60, 1);

    expect(cmd.fire).toBe(false);
    expect(cmd.throttleDelta).toBe(-1);
    expect(cmd.rotate).not.toBe(0);
  });

  it('actively strafes an ejected player pilot when the nose is on target', () => {
    const enemy = makePlane(500, 420, 0);
    enemy.kinematic.velocity = { x: 900, y: 0 };
    const pilot = makePilot(880, 500, 'parachute');
    const aiState = { ...createAiState(9), timeFlyingSec: 2 };

    const { cmd } = aiCommandPilotTarget(
      enemy,
      pilot,
      DIFFICULTIES.hard,
      aiState,
      enemy.hp,
      1 / 60,
      2,
    );

    expect(cmd.fire).toBe(true);
  });
});

// The Layer-1 survival logic that keeps enemies from flying into the dirt — the
// documented "enemies kill themselves" class. Pure functions, so headless + deterministic.
const GROUND_Y = WORLD_HEIGHT - 90;

describe('chase policy — ground/ceiling survival (anti-self-crash)', () => {
  it('pulls the nose UP (and stops firing) when skimming just above the ground', () => {
    const enemy = makePlane(500, GROUND_Y - 2, 0.6); // facing right, diving, right on the deck
    const target = makePlane(1800, GROUND_Y - 2, 0); // far away → no collision-avoidance override
    const aiState = { ...createAiState(3), timeFlyingSec: 5 }; // well past post-takeoff stabilisation
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, aiState, enemy.hp, 1 / 60, 5);
    expect(cmd.rotate).toBe(-1); // -1 = nose up when facing right (see "target above" case)
    expect(cmd.fire).toBe(false); // survival overrides combat
  });

  it('starts the pull-out EARLY when moderately low AND steeply diving (altitude-aware anti-dive)', () => {
    const gc = DIFFICULTIES.hard.groundClearance;
    // Between the raw clearance band and the 2.4× early-trigger band, with a steep dive.
    const enemy = makePlane(500, GROUND_Y - gc * 1.5, 0.6); // sin(0.6)≈0.56 > 0.45 → diving
    expect(enemy.kinematic.position.y).toBeLessThan(GROUND_Y - gc); // NOT yet in the raw-proximity band
    const target = makePlane(1800, GROUND_Y - gc * 1.5, 0);
    const aiState = { ...createAiState(4), timeFlyingSec: 5 };
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, aiState, enemy.hp, 1 / 60, 5);
    expect(cmd.rotate).toBe(-1); // pulling up early, before it's too late to reverse the dive
  });

  it('collision break is UPWARD (away from ground) when there is room above', () => {
    const enemy = makePlane(300, 600, 0); // mid-air, lots of room above (600 > 220)
    enemy.kinematic.velocity = { x: 900, y: 0 };
    const target = makePlane(500, 600, Math.PI); // closing head-on
    target.faction = 'player';
    target.kinematic.velocity = { x: -900, y: 0 };
    const aiState = { ...createAiState(5), timeFlyingSec: 5 };
    const { cmd } = aiCommand(enemy, target, DIFFICULTIES.hard, aiState, enemy.hp, 1 / 60, 5);
    expect(cmd.rotate).toBe(-1); // breaks UP, not down into the ground
    expect(cmd.fire).toBe(false);
  });
});
