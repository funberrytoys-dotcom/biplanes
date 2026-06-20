import { describe, it, expect } from 'vitest';
import {
  BRANCHES,
  RUN_WAVE_COUNT,
  createRunState,
  resolveRunFlow,
  rollRunPickChoices,
  buildRunSummary,
  emptyAffinity,
} from '../index.js';

describe('run engine public surface', () => {
  it('re-exports the run engine from the core barrel', () => {
    expect(BRANCHES).toHaveLength(4);
    expect(RUN_WAVE_COUNT).toBe(15);
    expect(typeof createRunState).toBe('function');
    expect(typeof resolveRunFlow).toBe('function');
    expect(typeof rollRunPickChoices).toBe('function');
    expect(typeof buildRunSummary).toBe('function');
    expect(typeof emptyAffinity).toBe('function');
  });
});
