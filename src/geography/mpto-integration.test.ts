import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { makePlane } from '../test/field';
import { applyClearance, resolveNavigation } from '../utils/navigation';
import { trackFate } from '../utils/approach';
import { getGeographicAirport } from './kbos';
import { mptoMap } from './mpto-map';
import { runwayFrame } from './navigation';

const canonical = AIRPORTS.find(airport => airport.icao === 'MPTO')!;

it('retains the four exact MPTO bindings and independent WGS84 geometry controls without threshold or LOC claims', () => {
  const before = JSON.stringify(canonical);
  const airport = getGeographicAirport(canonical);
  expect(airport).not.toBe(canonical);
  expect(getGeographicAirport(canonical)).toBe(airport);
  expect(getGeographicAirport(airport)).toBe(airport);
  expect(airport.terrainMap).toBe(mptoMap);
  expect(airport.geographic).toBeUndefined();
  expect(airport.runways.map(runway => runway.id)).toEqual(canonical.runways.map(runway => runway.id));
  expect(mptoMap.reference).toEqual({ latitude: 9.071385145187378, longitude: -79.38344955444336 });
  expect(mptoMap.referenceKind).toBe('derived selected endpoint mean');
  // Independent Python Vincenty controls from the mapper, not the application projection.
  const controls = [
    ['03L/21R', 494.88202898745647, 498.12045654249306, 511.4982860555297, 470.25513640555636, 32.44342869189791],
    ['03R/21L', 487.69876557260415, 531.8578311426181, 505.91941775491, 499.76618036585774, 36.90347159179083],
  ] as const;
  for (const [id, x1, y1, x2, y2, length] of controls) {
    const surface = mptoMap.physicalRunways.find(row => row.id === id)!;
    expect(surface.ends[0].position.x).toBeCloseTo(x1, 6);
    expect(surface.ends[0].position.y).toBeCloseTo(y1, 6);
    expect(surface.ends[1].position.x).toBeCloseTo(x2, 6);
    expect(surface.ends[1].position.y).toBeCloseTo(y2, 6);
    for (const end of surface.ends) {
      const runway = airport.runways.find(row => row.label === end.id)!;
      const frame = runwayFrame(airport, runway), angle = runway.heading * Math.PI / 180;
      expect(runway.length).toBeCloseTo(length, 7);
      expect(frame.threshold.x - Math.sin(angle) * runway.length! / 2).toBeCloseTo(end.position.x, 8);
      expect(frame.threshold.y + Math.cos(angle) * runway.length! / 2).toBeCloseTo(end.position.y, 8);
      expect(frame.localizer).toBeUndefined();
      expect(end.displacedThresholdMetres).toBeNull();
    }
  }
  expect(airport.airspacePolygons?.map(polygon => polygon.id)).toEqual(['mpto-ctr']);
  expect(mptoMap).not.toHaveProperty('magneticVariationEast');
  expect(Object.isFrozen(airport.runways)).toBe(true);
  expect(Object.isFrozen(mptoMap.terrain.landPaths)).toBe(true);
  expect(JSON.stringify(canonical)).toBe(before);
});

it('uses distinct fixed synthetic points and the named CANAL hold while preserving direct/handoff/uncleared-exit behavior', () => {
  const airport = getGeographicAirport(canonical);
  expect(airport.waypoints.map(fix => [fix.id, fix.label, fix.x, fix.y])).toEqual([
    ['WP-P1', 'CANAL', 80, 370], ['WP-P2', 'TABOG', 380, 1040],
    ['WP-P3', 'DARIW', 1080, 760], ['WP-P4', 'CHAGR', 760, 80],
  ]);
  expect(airport.syntheticLayout?.holdFixIds['stack-canal']).toBe('WP-P1');
  expect(airport.holdingStacks?.[0]).toEqual(expect.objectContaining({ id: 'stack-canal', label: 'CANAL', x: 80, y: 360 }));
  for (const fix of airport.waypoints) {
    const arrival = applyClearance(makePlane({ x: 500, y: 500, altitude: 5000 }), { targetWaypoint: fix.id });
    expect(resolveNavigation(arrival, airport).targetWaypoint).toBe(fix.id);
    expect(resolveNavigation({ ...arrival, x: fix.x, y: fix.y + 34 }, airport).targetWaypoint).toBeNull();
    for (const distance of [35, 34]) {
      const departure = makePlane({ type: 'departure', x: fix.x, y: fix.y + distance,
        exitWaypointId: fix.id, targetWaypoint: fix.id });
      const next = { ...departure, ...resolveNavigation(departure, airport) };
      expect(next.markedForRemoval).toBe(distance < 35);
      expect(trackFate(next, airport).score).toBe(distance < 35);
    }
    expect(trackFate(makePlane({ type: 'departure', x: 1101, y: 500, targetWaypoint: null,
      exitWaypointId: fix.id }), airport)).toEqual({ keep: false, score: false, accident: false, success: false });
  }
});

it('retains exact source provenance and finite deterministic generalized terrain/coverage', () => {
  expect(mptoMap.coverage.land.lonLatBounds).toEqual([-81, 7.5, -77.8, 10.7]);
  expect(mptoMap.coverage.water.worldRing).toHaveLength(64);
  expect(mptoMap.source.sources[0].sha256).toBe('7be01aa01204b13edde729d603505cf4c1661d274128b70a137c2285be728197');
  expect(createHash('sha256').update(JSON.stringify(mptoMap.terrain)).digest('hex')).toBe(mptoMap.source.terrainSha256);
  expect(mptoMap.terrain.landPaths.length).toBeGreaterThan(0);
  expect(JSON.stringify(mptoMap)).not.toMatch(/NaN|Infinity/);
  expect(mptoMap.source.notice).toMatch(/approximate|generalized/i);
  expect(mptoMap.source.notice).toContain('unknown threshold');
  expect(mptoMap.source.notice).toContain('synthetic');
});
