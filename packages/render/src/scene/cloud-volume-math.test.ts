import { describe, expect, it } from 'vitest';
import { resolveCloudContact, resolveCloudReadabilityAlpha } from './cloud-volume-math.js';

describe('resolveCloudContact', () => {
  it('returns strong contact near the center of a cloud bank', () => {
    const contact = resolveCloudContact({
      planeX: 500,
      planeY: 300,
      planeVx: 420,
      planeVy: 0,
      bankX: 500,
      bankY: 300,
      bankWidth: 600,
      bankHeight: 360,
      front: true,
    });

    expect(contact.strength).toBeCloseTo(1);
    expect(contact.propWash).toBeGreaterThan(0.55);
    expect(contact.dirX).toBeCloseTo(1);
    expect(contact.sideY).toBeCloseTo(1);
  });

  it('drops contact to zero outside the cloud bank', () => {
    const contact = resolveCloudContact({
      planeX: 950,
      planeY: 300,
      planeVx: 420,
      planeVy: 0,
      bankX: 500,
      bankY: 300,
      bankWidth: 600,
      bankHeight: 360,
      front: true,
    });

    expect(contact.strength).toBe(0);
    expect(contact.propWash).toBe(0);
  });

  it('keeps slow planes from creating prop wash', () => {
    const contact = resolveCloudContact({
      planeX: 500,
      planeY: 300,
      planeVx: 40,
      planeVy: 0,
      bankX: 500,
      bankY: 300,
      bankWidth: 600,
      bankHeight: 360,
      front: true,
    });

    expect(contact.strength).toBeCloseTo(1);
    expect(contact.propWash).toBe(0);
  });

  it('opens a readable pocket in front clouds around active planes', () => {
    const open = resolveCloudReadabilityAlpha({
      baseAlpha: 0.5,
      contactStrength: 0.9,
      front: true,
      propPulse: 0.2,
      ambientPulse: 0,
    });
    const normal = resolveCloudReadabilityAlpha({
      baseAlpha: 0.5,
      contactStrength: 0,
      front: true,
      propPulse: 0.2,
      ambientPulse: 0,
    });

    expect(open).toBeLessThan(normal);
    expect(open).toBeGreaterThanOrEqual(0.16); // front floor — punches a clearer hole now
  });

  it('thins background clouds less than foreground clouds', () => {
    const front = resolveCloudReadabilityAlpha({
      baseAlpha: 0.5,
      contactStrength: 0.9,
      front: true,
      propPulse: 0.2,
      ambientPulse: 0,
    });
    const back = resolveCloudReadabilityAlpha({
      baseAlpha: 0.5,
      contactStrength: 0.9,
      front: false,
      propPulse: 0.2,
      ambientPulse: 0,
    });

    expect(back).toBeGreaterThan(front);
  });
});
