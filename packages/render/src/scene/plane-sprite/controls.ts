import { Container, Graphics } from 'pixi.js';

export interface PlaneControlsHandle {
  container: Container;
  update(rotateInput: number, headingDelta: number, dt: number): void;
}

export function createPlaneControls(_faction: 'player' | 'enemy'): PlaneControlsHandle {
  const container = new Container();

  const aileronL = new Graphics().rect(0, -1.5, 6, 3).fill({ color: 0x222222 });
  aileronL.x = -16;
  aileronL.y = 14;
  const aileronR = new Graphics().rect(-6, -1.5, 6, 3).fill({ color: 0x222222 });
  aileronR.x = 16;
  aileronR.y = 14;
  const elevator = new Graphics().rect(-4, -1.5, 8, 3).fill({ color: 0x222222 });
  elevator.x = -14;
  elevator.y = 0;
  const rudder = new Graphics().rect(-2, -1, 4, 6).fill({ color: 0x222222 });
  rudder.x = -16;
  rudder.y = -6;

  container.addChild(aileronL, aileronR, elevator, rudder);

  return {
    container,
    update(rotateInput, headingDelta, _dt) {
      aileronL.rotation = -rotateInput * 0.26;
      aileronR.rotation = rotateInput * 0.26;
      elevator.rotation = Math.max(-0.21, Math.min(0.21, headingDelta * 3));
      rudder.rotation = Math.max(-0.07, Math.min(0.07, headingDelta * 1.5));
    },
  };
}
