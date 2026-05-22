import { Container } from 'pixi.js';

export interface PilotHeadHandle {
  container: Container;
  update(throttleChange: number, dt: number): void;
}

export function createPilotHead(_faction: 'player' | 'enemy'): PilotHeadHandle {
  const container = new Container();
  return {
    container,
    update() {
      /* stub — filled in Task 2.4 */
    },
  };
}
