import { Container } from 'pixi.js';

export function createDistantSilhouettes(_width: number, _height: number, _color: number) {
  return {
    container: new Container(),
    update(_dt: number, _timeSec: number) {},
  };
}
