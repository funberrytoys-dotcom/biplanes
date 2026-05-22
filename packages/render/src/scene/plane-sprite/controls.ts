import { Container } from 'pixi.js';

export interface PlaneControlsHandle {
  container: Container;
  update(rotateInput: number, headingDelta: number, dt: number): void;
}

export function createPlaneControls(_faction: 'player' | 'enemy'): PlaneControlsHandle {
  const container = new Container();
  return {
    container,
    update() {
      /* stub — filled in Task 2.3 */
    },
  };
}
