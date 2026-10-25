import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { makePlane } from '../test/field';
import { approachStatus, checkIlsRunway } from '../utils/approach';
import { advancePlane } from '../utils/sim';
import { deriveMapRunways, airportMapRegistry, type MapAirportDefinition } from './map-registry';
import { mdsdMap } from './mdsd-map';
import { getGeographicAirport } from './kbos';
import { runwayFrame } from './navigation';

const canonical = AIRPORTS.find(airport => airport.icao === 'MDSD')!;
const surface = (id: string, x: number, y: number) => ({ id, ends: [
  { ...mdsdMap.physicalRunways[0].ends[0], id: 'N', position: { x, y: y - 20 } },
  { ...mdsdMap.physicalRunways[0].ends[1], id: 'S', position: { x, y: y + 20 } },
] });
const airport = { ...canonical, runways: [
  { id: 'east-s', label: 'same-label', heading: 180 }, { id: 'west-n', label: 'same-label', heading: 0 },
] };
const definition = (): MapAirportDefinition => ({
  map: { ...mdsdMap, physicalRunways: [surface('west', 100, 700), surface('east', 900, 700), surface('context', 700, 200)] },
  bindings: [ { runwayId: 'west-n', surfaceId: 'west', endId: 'N' }, { runwayId: 'east-s', surfaceId: 'east', endId: 'S' } ],
});

it('binds by operative/surface/end IDs, independent of array order or ambiguous labels, without adding controls', () => {
  const entry = definition();
  const runways = deriveMapRunways(airport, entry);
  expect(runways.map(runway => [runway.id, runway.offsetX, runway.offsetY, runway.heading, runway.length]))
    .toEqual([['east-s', 400, 200, 0, 40], ['west-n', -400, 200, 180, 40]]);
  entry.map.physicalRunways.reverse();
  entry.bindings.reverse();
  entry.map.physicalRunways.forEach(surface => surface.ends.reverse());
  expect(deriveMapRunways(airport, entry)).toEqual(runways);
  expect(airport.runways[0].heading).toBe(180);
  for (const icao of ['EGLL', 'EHAM', 'OMDB']) expect(airportMapRegistry[icao]).toBeUndefined();
});

it('keeps MDSD current derived geometry exactly and reuses the cached shared airport', () => {
  const mapped = getGeographicAirport(canonical);
  expect(deriveMapRunways(canonical, airportMapRegistry.MDSD!)).toEqual(mapped.runways);
  expect(getGeographicAirport(canonical)).toBe(mapped);
  expect(getGeographicAirport(mapped)).toBe(mapped);
});

it.each(['missing', 'duplicate', 'unknown-control', 'unknown-surface', 'unknown-end', 'duplicate-target', 'duplicate-end', 'duplicate-surface', 'nonfinite', 'nonfinite-coordinate', 'overflow', 'zero-span'])(
  'rejects %s bindings/geometry explicitly', fault => {
    const entry = definition();
    if (fault === 'missing') entry.bindings.pop();
    if (fault === 'duplicate') entry.bindings[1] = { ...entry.bindings[0] };
    if (fault === 'unknown-control') entry.bindings[0].runwayId = 'missing';
    if (fault === 'unknown-surface') entry.bindings[0].surfaceId = 'missing';
    if (fault === 'unknown-end') entry.bindings[0].endId = 'missing';
    if (fault === 'duplicate-target') entry.bindings[1] = { ...entry.bindings[0], runwayId: 'east-s' };
    if (fault === 'nonfinite-coordinate') entry.map.physicalRunways[0].ends[0].coordinate = { longitude: NaN, latitude: 0 };
    if (fault === 'overflow') {
      entry.map.physicalRunways[0].ends[0].position.x = -1e308;
      entry.map.physicalRunways[0].ends[1].position.x = 1e308;
    }
    if (fault === 'duplicate-end') entry.map.physicalRunways[0].ends[1].id = 'N';
    if (fault === 'duplicate-surface') entry.map.physicalRunways[1].id = 'west';
    if (fault === 'nonfinite') entry.map.physicalRunways[0].ends[0].position.x = NaN;
    if (fault === 'zero-span') entry.map.physicalRunways[0].ends[1].position = { ...entry.map.physicalRunways[0].ends[0].position };
    expect(() => deriveMapRunways(airport, entry)).toThrow(/binding|surface|geometry|end/i);
  },
);

it('uses assigned/established or nearest eligible map-only runway centers for warnings, never the airport center', () => {
  const entry = definition();
  const mapped = { ...airport, terrainMap: entry.map, runways: deriveMapRunways(airport, entry) };
  const active = { 'east-s': { landing: true, departure: true } };
  const plane = makePlane({ assignedRunwayId: 'east-s', altitude: 2000 });
  const position = { x: 900, y: 700, altitude: 2500, speed: 200, isEstablished: false };
  expect(runwayFrame(mapped, mapped.runways[0])).toMatchObject({
    threshold: { x: 900, y: 700 }, departureStart: { x: 900, y: 700 }, approachOrigin: { x: 900, y: 700 },
  });
  expect(checkIlsRunway({ ...plane, x: 904, y: 800, heading: 0 }, mapped, mapped.runways[0], 0.4))
    .toMatchObject({ alongTrack: 100, crossTrack: 4, ready: true });
  expect(approachStatus(plane, mapped, position, active)).toBe('bad_approach');
  expect(approachStatus(plane, mapped, { ...position, x: 500, y: 500 }, active)).toBe('normal');
  for (const x of [999, 1000]) expect(approachStatus(plane, mapped, { ...position, x }, active)).toBe(x < 1000 ? 'bad_approach' : 'normal');
  for (const x of [949, 950]) expect(approachStatus({ ...plane, establishedRunwayId: 'east-s' }, mapped,
    { ...position, x, altitude: 5000, isEstablished: true }, active)).toBe(x < 950 ? 'bad_approach' : 'normal');
  const unassigned = { ...plane, assignedRunwayId: null };
  expect(approachStatus(unassigned, mapped, { ...position, x: 100 }, active)).toBe('normal');
  expect(approachStatus(unassigned, mapped, position, active)).toBe('bad_approach');
  expect(approachStatus(unassigned, mapped, position, {})).toBe('normal');
  expect(approachStatus(unassigned, mapped, { ...position, x: 100 },
    { ...active, 'west-n': { landing: true, departure: true } })).toBe('bad_approach');
  expect(approachStatus({ ...plane, type: 'departure' }, mapped, position, active)).toBe('normal');
  expect(approachStatus({ ...plane, status: 'crashed' }, mapped, position, active)).toBe('crashed');
  expect(advancePlane({ ...plane, x: 500, y: 500 }, mapped, active, 0.4, 1).plane.status).toBe('normal');
  expect(approachStatus(plane, { ...mapped, terrainMap: undefined }, { ...position, x: 500, y: 500 }, active)).toBe('bad_approach');
});
