import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { getGeographicAirport, toTrueHeading, toMagneticHeading } from './kbos';
import { runwayFrame, approachPoint } from './navigation';
import { mdsdMap } from './mdsd-map';

it('adapts MDSD immutably with map-only facts and the same derived pavement axis for gameplay', () => {
  const canonical = AIRPORTS.find(airport => airport.icao === 'MDSD')!;
  const before = JSON.stringify(canonical);
  const airport = getGeographicAirport(canonical);
  expect(airport).not.toBe(canonical);
  expect(getGeographicAirport(canonical)).toBe(airport);
  expect(getGeographicAirport(airport)).toBe(airport);
  expect(airport.terrainMap).toBe(mdsdMap);
  expect(airport.geographic).toBeUndefined();
  expect(airport.waypoints).toEqual(canonical.waypoints);
  expect(airport.holdingStacks).toEqual(canonical.holdingStacks);
  expect(airport.airspacePolygons?.map(polygon => polygon.id)).toEqual(['mdsd-ctr']);
  expect(canonical.airspacePolygons?.map(polygon => polygon.id)).toEqual(['mdsd-ctr', 'mdsd-caribbean']);
  expect(airport.runways.map(runway => runway.id)).toEqual(['mdsd-17', 'mdsd-35']);
  const [first, second] = mdsdMap.physicalRunways[0].ends;
  for (const runway of airport.runways) {
    const frame = runwayFrame(airport, runway);
    const source = runway.label === '17' ? first : second;
    const angle = runway.heading * Math.PI / 180;
    expect(frame.threshold.x - Math.sin(angle) * runway.length! / 2).toBeCloseTo(source.position.x, 8);
    expect(frame.threshold.y + Math.cos(angle) * runway.length! / 2).toBeCloseTo(source.position.y, 8);
    expect(frame.localizer).toBeUndefined();
    expect(frame.approachHeading).toBe(runway.heading);
    expect(frame.approachOrigin).toEqual(frame.threshold); // Existing simplified centre-based model, not a sourced threshold.
    expect(approachPoint(airport, runway, 100)).toEqual({
      x: frame.threshold.x - Math.sin(angle) * 100, y: frame.threshold.y + Math.cos(angle) * 100,
    });
    expect(toTrueHeading(90, airport)).toBe(90);
    expect(toMagneticHeading(90, airport)).toBe(90);
  }
  expect(Object.isFrozen(airport.runways)).toBe(true);
  expect(JSON.stringify(canonical)).toBe(before);
  expect(Object.isFrozen(canonical.runways)).toBe(false);
});
