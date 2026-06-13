import type { WorldState } from '../world/world-state.js';
import type { UpgradeId } from './upgrade-pool.js';

export function applyUpgrade(state: WorldState, id: UpgradeId): WorldState {
  let damageMultiplier = state.damageMultiplier;
  let fireRateMultiplier = state.fireRateMultiplier;
  let boostHeatMultiplier = state.boostHeatMultiplier;
  let boostCoolingMultiplier = state.boostCoolingMultiplier;
  let boostPowerMultiplier = state.boostPowerMultiplier;
  let collisionDamageMultiplier = state.collisionDamageMultiplier;
  let hasDrone = state.hasDrone;
  let hasHomingRockets = state.hasHomingRockets;
  let hasFlameTrail = state.hasFlameTrail;
  let hasHeavyCannon = state.hasHeavyCannon;
  let player = state.player;
  let xpMagnetRange = state.xpMagnetRange;

  switch (id) {
    case 'damage_plus_25': damageMultiplier *= 1.25; break;
    case 'damage_plus_50': damageMultiplier *= 1.5; break;
    case 'fire_rate_plus_25': fireRateMultiplier *= 1.25; break;
    case 'fire_rate_plus_50': fireRateMultiplier *= 1.5; break;
    case 'hp_plus_25': {
      const newMax = player.maxHp * 1.25;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'hp_plus_50': {
      const newMax = player.maxHp * 1.5;
      player = { ...player, maxHp: newMax, hp: newMax };
      break;
    }
    case 'magnet_range_plus': xpMagnetRange = xpMagnetRange * 1.5; break;
    case 'drone_wingman': hasDrone = true; break;
    case 'piercing_bullets': /* handled dynamically in collision-system */ break;
    case 'heavy_bomb': /* handled in tick drop logic */ break;
    case 'heavy_cannon':
      hasHeavyCannon = true;
      break;
    case 'homing_rocket':
      hasHomingRockets = true;
      break;
    case 'flame_trail':
      hasFlameTrail = true;
      break;
    case 'tracer_belt':
      fireRateMultiplier *= 1.15;
      break;
    case 'cluster_bomb':
      damageMultiplier *= 1.15;
      break;
    case 'coolant_injector':
      boostHeatMultiplier *= 0.72;
      boostCoolingMultiplier *= 1.45;
      break;
    case 'boost_supercharger':
      boostPowerMultiplier *= 1.18;
      break;
    case 'reinforced_struts': {
      collisionDamageMultiplier *= 0.68;
      const newMax = player.maxHp * 1.18;
      player = { ...player, maxHp: newMax, hp: Math.max(player.hp, newMax) };
      break;
    }
    case 'gatling_evolution':
      damageMultiplier *= 1.5;
      fireRateMultiplier *= 2.0;
      break;
    case 'fire_screen':
      hasFlameTrail = true;
      damageMultiplier *= 1.25;
      break;
    case 'chico_wing':
      hasDrone = true;
      xpMagnetRange = xpMagnetRange * 1.6;
      break;
    case 'redline_engine':
      boostHeatMultiplier *= 0.82;
      boostCoolingMultiplier *= 1.25;
      boostPowerMultiplier *= 1.25;
      break;
  }

  return {
    ...state,
    player,
    damageMultiplier,
    fireRateMultiplier,
    boostHeatMultiplier,
    boostCoolingMultiplier,
    boostPowerMultiplier,
    collisionDamageMultiplier,
    hasDrone,
    hasHomingRockets,
    hasFlameTrail,
    hasHeavyCannon,
    xpMagnetRange,
    appliedUpgradeIds: [...state.appliedUpgradeIds, id],
    pendingLevelUp: false,
  };
}
