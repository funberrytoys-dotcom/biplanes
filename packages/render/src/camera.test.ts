import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { createCamera } from './camera.js';

describe('camera follow feel', () => {
  it('reacts quickly enough when the focus target jumps during fast flight', () => {
    const worldRoot = new Container();
    const camera = createCamera(worldRoot, 1280, 720);

    camera.setWorldSize(5000, 2000);
    camera.setFocus(1000, 500, 1);
    camera.snap();
    camera.setFocus(2000, 500, 1);
    camera.tickShake(1 / 60);

    expect(camera.currentFocusX).toBeGreaterThan(1170);
  });
});
