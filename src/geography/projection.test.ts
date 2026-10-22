import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { inverseNad83, projectNad83 } from './projection';
import { toMagneticHeading, toTrueHeading } from './headings';
import type { AirportGeography, GeographicAirport } from './types';

const origin = { longitude: -71, latitude: 42 };

describe('pure geographic contract without terrain or airport activation', () => {
  it('keeps the origin exact and projects a known GRS80 equatorial control uniformly', () => {
    expect(projectNad83(origin, origin)).toEqual({ x: 500, y: 500 });
    const from = { longitude: 0, latitude: 0 }, to = { longitude: 1, latitude: 0 };
    const control = inverseNad83(from, to);
    expect(control.distanceMetres).toBeCloseTo(111319.490793, 3);
    expect(control.trueBearingDegrees).toBeCloseTo(90, 8);
    expect(projectNad83(from, to).x - 500).toBeCloseTo(control.distanceMetres / 1852 * 22.4, 8);
    expect(projectNad83(from, to).y).toBeCloseTo(500, 8);
  });

  it('preserves north-up and handles all local bearing quadrants', () => {
    for (const [longitude, latitude, bearing] of [[0, 1, 0], [1, 0, 90], [0, -1, 180], [-1, 0, 270]]) {
      const point = { longitude, latitude }, from = { longitude: 0, latitude: 0 };
      expect(inverseNad83(from, point).trueBearingDegrees).toBeCloseTo(bearing, 8);
      const world = projectNad83(from, point);
      expect(Math.hypot(world.x - 500, world.y - 500)).toBeCloseTo(inverseNad83(from, point).distanceMetres / 1852 * 22.4, 8);
    }
  });

  it.each([{ longitude: NaN, latitude: 42 }, { longitude: 181, latitude: 0 }, { longitude: 0, latitude: 91 }])('rejects invalid input %j', point => {
    expect(() => projectNad83(origin, point)).toThrow();
    expect(() => projectNad83(point, origin)).toThrow();
  });

  it('fails explicitly for unsupported antipodal geometry', () => {
    expect(() => inverseNad83({ longitude: 0, latitude: 0 }, { longitude: 180, latitude: 0 })).toThrow();
  });

  it('converts only explicit magnetic-reference variants and preserves canonical legacy objects', () => {
    const before = JSON.stringify(AIRPORTS);
    const variant: GeographicAirport = { ...AIRPORTS[0], geographic: { magneticVariationEast: -15 } as AirportGeography };
    expect(toTrueHeading(330, variant)).toBe(315);
    expect(toMagneticHeading(315, variant)).toBe(330);
    for (const value of [0, 5, 180, 359]) expect(toMagneticHeading(toTrueHeading(value, variant), variant)).toBe(value);
    for (const airport of AIRPORTS) {
      expect(toTrueHeading(360, airport)).toBe(360);
      expect(toMagneticHeading(360, airport)).toBe(360);
    }
    expect(JSON.stringify(AIRPORTS)).toBe(before);
  });
});
