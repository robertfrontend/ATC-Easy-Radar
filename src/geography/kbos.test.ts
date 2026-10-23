import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { inverseNad83, projectNad83 } from './projection';
import { getGeographicAirport, toMagneticHeading, toTrueHeading } from './kbos';

const reference = { longitude: -71.00638888, latitude: 42.36294444 };
const canonical = AIRPORTS.find(airport => airport.icao === 'KBOS')!;

describe('independent geographic contract, not active game configuration', () => {
  it('projects the NAD83 origin and an equatorial GRS80 distance control uniformly', () => {
    expect(projectNad83(reference, reference)).toEqual({ x: 500, y: 500 });
    const result = inverseNad83({ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 0 });
    expect(result.distanceMetres).toBeCloseTo(111319.490793, 3);
    expect(result.trueBearingDegrees).toBeCloseTo(90, 8);
    const point = projectNad83({ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 0 });
    expect(point.x - 500).toBeCloseTo(result.distanceMetres / 1852 * 22.4, 8);
    expect(point.y).toBeCloseTo(500, 8);
    expect(() => projectNad83(reference, { longitude: NaN, latitude: 42 })).toThrow();
    expect(() => inverseNad83({ longitude: 0, latitude: 0 }, { longitude: 180, latitude: 0 })).toThrow();
    const north = projectNad83({ longitude: 0, latitude: 0 }, { longitude: 0, latitude: 1 });
    expect(north.x).toBe(500);
    expect(north.y).toBeLessThan(500);
  });

  it('retains canonical objects and all legacy heading semantics until explicitly adapted', () => {
    const before = JSON.stringify(AIRPORTS);
    const frozenBefore = Object.isFrozen(canonical.airlines);
    const adapted = getGeographicAirport(canonical);
    expect(adapted).not.toBe(canonical);
    expect(JSON.stringify(AIRPORTS)).toBe(before);
    expect(Object.isFrozen(canonical.airlines)).toBe(frozenBefore);
    for (const airport of AIRPORTS.filter(item => !['KBOS', 'MDSD'].includes(item.icao))) {
      expect(getGeographicAirport(airport)).toBe(airport);
      expect(toTrueHeading(360, airport)).toBe(360);
      expect(toMagneticHeading(360, airport)).toBe(360);
    }
    expect(toTrueHeading(330, adapted)).toBe(315);
    expect(toMagneticHeading(315, adapted)).toBe(330);
    for (const heading of [0, 5, 180, 359]) expect(toMagneticHeading(toTrueHeading(heading, adapted), adapted)).toBe(heading);
  });

  it('keeps four operative IDs while separating six surfaces and five localizers', () => {
    const airport = getGeographicAirport(canonical);
    expect(airport.runways.map(runway => runway.id)).toEqual(['bos-33l', 'bos-27', 'bos-04r', 'bos-15r']);
    expect(airport.geographic!.physicalRunways).toHaveLength(6);
    expect(airport.geographic!.localizers).toHaveLength(5);
    expect(airport.geographic!.localizers.find(loc => loc.runwayEnd === '22L')!.referenceOnly).toBe(true);
    expect(airport.geographic!.localizers.find(loc => loc.runwayEnd === '15R')!.trueCourse).not.toBe(airport.runways[3].heading);
    expect(airport.geographic!.localizers.find(loc => loc.runwayEnd === '33L')!.restrictions.join(' ')).toContain('33 DEGS LEFT');
    expect(airport.geographic!.shortestHalfRange).toBe(392);
    expect(airport.elevation).toBe(19.1);
    const end = airport.geographic!.physicalRunways.find(runway => runway.id === '04R/22L')!.ends[0];
    expect(end.position).toEqual(projectNad83(reference, { longitude: -71.01179388, latitude: 42.35105816 }));
    expect(end.threshold).toEqual(projectNad83(reference, { longitude: -71.01035252, latitude: 42.35404027 }));
    expect(Object.isFrozen(airport.geographic!.physicalRunways)).toBe(true);
    expect(getGeographicAirport(canonical)).toBe(airport);
  });

  it('uses only the nine visible core fixes for navigation and exits', () => {
    const airport = getGeographicAirport(canonical);
    expect(airport.waypoints).toHaveLength(9);
    for (const waypoint of airport.waypoints) {
      expect(Math.abs(waypoint.x - 500)).toBeLessThan(16 * 22.4);
      expect(Math.abs(waypoint.y - 500)).toBeLessThan(16 * 22.4);
    }
    expect(airport.geographic!.contextFixes.map(fix => fix.label)).toEqual(['SOSYO', 'WHYBE']);
    expect(airport.holdingStacks).toEqual([]);
    expect(airport.geographic!.holdReferences.map(hold => hold.label)).toEqual(['WAXEN', 'WINNI']);
  });

  it('retains separate coverage and source limitations instead of classifying unknown space', () => {
    const geography = getGeographicAirport(canonical).geographic!;
    expect(geography.coverage.water.lonLatBounds).toEqual([-71.6, 42.01, -70.4, 42.72]);
    expect(geography.coverage.water.worldRing.length).toBeGreaterThan(4);
    expect(geography.terrain.landPaths.length).toBeGreaterThan(0);
    expect(geography.source.effectiveDate).toBe('2026-10-01');
    expect(geography.source.crs).toBe('EPSG:4269');
    expect(geography.source.notice).toContain('Not for navigation');
    expect(geography.source.notice).not.toContain('CC0');
    expect(geography.source.attribution).toContain('MassDEP');
    expect(geography.source.attribution).toContain('USGS');
    expect(geography.source.sources.some(source => source.url.includes('01_Oct_2026_ILS_CSV.zip'))).toBe(true);
    for (const paths of Object.values(geography.terrain)) for (const path of paths) {
      expect(path).toMatch(/^M.+Z$/);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
  });
});
