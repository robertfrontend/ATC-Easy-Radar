import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { getGeographicAirport } from './kbos';
import { inverseWgs84, projectWgs84 } from './projection';
import { mdsdMap } from './mdsd-map';

it('projects explicit WGS84 controls independently of the NAD83 Boston contract', () => {
  const origin = { longitude: 0, latitude: 0 };
  expect(projectWgs84(origin, origin)).toEqual({ x: 500, y: 500 });
  expect(inverseWgs84(origin, { longitude: 0, latitude: 1 }).distanceMetres).toBeCloseTo(110574.388558, 3);
  expect(inverseWgs84(origin, { longitude: 1, latitude: 0 }).distanceMetres).toBeCloseTo(111319.490793, 3);
  const point = projectWgs84(origin, { longitude: 0, latitude: 1 });
  expect(point.x).toBeCloseTo(500, 8);
  expect(500 - point.y).toBeCloseTo(110574.388558 / 1852 * 22.4, 6);
  expect(() => projectWgs84(origin, { longitude: NaN, latitude: 0 })).toThrow();
});

it('packages only independent historical17/35 pavement and generalized terrain, without activating navigation', () => {
  const canonical = AIRPORTS.find(airport => airport.icao === 'MDSD')!;
  expect(getGeographicAirport(canonical)).toBe(canonical);
  expect(mdsdMap.physicalRunways.map(runway => runway.id)).toEqual(['17/35']);
  const [first, second] = mdsdMap.physicalRunways[0].ends;
  expect(first.id).toBe('17');
  expect(second.id).toBe('35');
  expect(first.coordinate).toEqual({ latitude: 18.444000244140625, longitude: -69.67420196533203 });
  expect(second.coordinate).toEqual({ latitude: 18.4153995513916, longitude: -69.6636962890625 });
  for (const end of [first, second]) {
    expect(end.displacedThresholdMetres).toBeNull();
    expect(end.position).toEqual(projectWgs84(mdsdMap.reference, end.coordinate));
  }
  const length = Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y);
  // Independent Vincenty control supplied by the read-only mapper, not generated from this module.
  expect(length / 22.4 * 1852).toBeCloseTo(3354.600109181442, 3);
  expect(inverseWgs84(first.coordinate, second.coordinate).trueBearingDegrees).toBeCloseTo(160.67781695959104, 7);
  expect(mdsdMap.source.sources[0].sha256).toBe('7be01aa01204b13edde729d603505cf4c1661d274128b70a137c2285be728197');
  expect(mdsdMap).not.toHaveProperty('localizers');
  expect(mdsdMap).not.toHaveProperty('magneticVariationEast');
  expect(mdsdMap.source.notice).toMatch(/synthetic|simplified/);
  expect(mdsdMap.source.notice).toContain('datum');
  expect(Object.isFrozen(mdsdMap.physicalRunways[0].ends)).toBe(true);
});

it('keeps deterministic terrain paths finite, bounded in asset size and independently hashed', () => {
  const paths = [...mdsdMap.terrain.landPaths, ...mdsdMap.terrain.waterPaths];
  expect(mdsdMap.terrain.landPaths.length).toBeGreaterThan(0);
  expect(paths.join('')).not.toMatch(/NaN|Infinity/);
  expect(paths.every(path => /^M[-\d.,MLZ]+Z$/.test(path))).toBe(true);
  const text = readFileSync(new URL('./mdsd-map-data.json', import.meta.url), 'utf8');
  expect(Buffer.byteLength(text)).toBeLessThan(250_000);
  expect(createHash('sha256').update(JSON.stringify(mdsdMap.terrain)).digest('hex')).toBe(mdsdMap.source.terrainSha256);
  expect(mdsdMap.source.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
  expect(mdsdMap.coverage.land.worldRing).toHaveLength(64);
  expect(mdsdMap.coverage.water.lonLatBounds).toEqual(mdsdMap.coverage.land.lonLatBounds);
});


it('preserves real land versus ocean rather than filling the coverage rectangle as land', () => {
  const isLand = (coordinate: { longitude: number; latitude: number }) => {
    const point = projectWgs84(mdsdMap.reference, coordinate);
    let inside = false;
    for (const path of mdsdMap.terrain.landPaths) {
      for (const ring of path.split('M').filter(Boolean)) {
        const vertices = ring.replace(/Z$/, '').split('L').map(pair => pair.split(',').map(Number));
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const [x, y] = vertices[i], [previousX, previousY] = vertices[j];
          if ((y > point.y) !== (previousY > point.y) &&
            point.x < (previousX - x) * (point.y - y) / (previousY - y) + x) inside = !inside;
        }
      }
    }
    return inside;
  };
  expect(isLand({ longitude: -69.7, latitude: 18.7 })).toBe(true);
  expect(isLand({ longitude: -69.7, latitude: 18.0 })).toBe(false);
});
