import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { getGeographicAirport, toTrueHeading, toMagneticHeading } from './kbos';
import { runwayFrame, approachPoint } from './navigation';
import { mdsdMap } from './mdsd-map';
import { makePlane } from '../test/field';
import { applyClearance, resolveNavigation } from '../utils/navigation';
import { trackFate } from '../utils/approach';

it('adapts MDSD immutably with map-only facts and the same derived pavement axis for gameplay', () => {
  const canonical = AIRPORTS.find(airport => airport.icao === 'MDSD')!;
  const before = JSON.stringify(canonical);
  const airport = getGeographicAirport(canonical);
  expect(airport).not.toBe(canonical);
  expect(getGeographicAirport(canonical)).toBe(airport);
  expect(getGeographicAirport(airport)).toBe(airport);
  expect(airport.terrainMap).toBe(mdsdMap);
  expect(airport.geographic).toBeUndefined();
  expect(airport.waypoints.map(fix => [fix.id, fix.label])).toEqual(canonical.waypoints.map(fix => [fix.id, fix.label]));
  expect(airport.holdingStacks?.map(hold => [hold.id, hold.label])).toEqual(canonical.holdingStacks?.map(hold => [hold.id, hold.label]));
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

it('declares fixed, noncircular synthetic points separately from real map facts and keeps the named hold attached', () => {
  const canonical = AIRPORTS.find(airport => airport.icao === 'MDSD')!;
  const airport = getGeographicAirport(canonical);
  expect(airport.syntheticLayout?.kind).toBe('synthetic');
  expect(airport.waypoints.map(fix => [fix.id, fix.label, fix.x, fix.y])).toEqual([
    ['WP-D1', 'OCEAN', 350, 880], ['WP-D2', 'PALMA', 840, 620],
    ['WP-D3', 'QUEEN', 690, 330], ['WP-D4', 'UPWAY', 210, 480],
  ]);
  expect(airport.terrainMap).not.toHaveProperty('syntheticLayout');
  expect(airport.syntheticLayout?.holdFixIds['stack-ocean']).toBe('WP-D1');
  expect(airport.holdingStacks?.[0]).toEqual(expect.objectContaining({ id: 'stack-ocean', label: 'OCEAN', x: 350, y: 870 }));
  expect(airport.waypoints.map(fix => [fix.id, fix.label])).toEqual(canonical.waypoints.map(fix => [fix.id, fix.label]));
  expect(canonical.waypoints[0]).toEqual({ id: 'WP-D1', label: 'OCEAN', x: 500, y: 850 });
});


it('preserves arrival direct-to, the35-unit departure handoff and unscored uncleared exits', () => {
  const airport = getGeographicAirport(AIRPORTS.find(item => item.icao === 'MDSD')!);
  for (const fix of airport.waypoints) {
    const arrival = applyClearance(makePlane({ x: 500, y: 500, altitude: 5000 }), { targetWaypoint: fix.id });
    const navigation = resolveNavigation(arrival, airport);
    expect(navigation.targetWaypoint).toBe(fix.id);
    expect(navigation.markedForRemoval).toBe(false);
    expect(navigation.targetHeading).toBeCloseTo((Math.atan2(fix.x - 500, 500 - fix.y) * 180 / Math.PI + 360) % 360, 8);
    expect(resolveNavigation({ ...arrival, x: fix.x + 34, y: fix.y }, airport).targetWaypoint).toBeNull();
    for (const distance of [35, 34]) {
      const departure = makePlane({ type: 'departure', x: fix.x + distance, y: fix.y, altitude: 5000,
        exitWaypointId: fix.id, targetWaypoint: fix.id });
      const next = { ...departure, ...resolveNavigation(departure, airport) };
      expect(next.markedForRemoval).toBe(distance < 35);
      expect(trackFate(next, airport).score).toBe(distance < 35);
    }
    const uncleared = makePlane({ type: 'departure', x: airport.x + 601, y: airport.y,
      exitWaypointId: fix.id, targetWaypoint: null, markedForRemoval: false });
    expect(trackFate(uncleared, airport)).toEqual({ keep: false, score: false, accident: false, success: false });
  }
});
