import { describe, expect, it, vi } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { trackFate } from './approach';
import { predictFlightPath } from './prediction';
import { createRadarDomain, sampleArrivalPerimeter } from './radarBounds';
import { spawnAircraft } from './spawn';
import { safeEntry } from '../challenges/traffic';

const domain = createRadarDomain(3, 700);
const request = { airport: field, runwayConfig: {}, planes: [], now: 0, gameSpeed: 1 as const,
  lastDepartureByRunway: {}, lastDepartureAt: 0, allowArrival: true, domain };

it.each([0, 0.125, 0.25, 0.4, 0.5, 0.75, 0.9, 0.999])('real random generator uses rectangular perimeter at sample %s without extra draws', sample => {
  let draws = 0;
  const random = vi.fn(() => ++draws === 8 ? sample : 0.5);
  const plane = spawnAircraft({ ...request, random }).plane!;
  expect({ x: plane.x, y: plane.y }).toEqual(sampleArrivalPerimeter(field, domain, sample));
  expect(plane.type).toBe('arrival');
  expect(random).toHaveBeenCalledTimes(12);
  expect(trackFate(plane, field, domain).keep).toBe(true);
});

describe('consistent domain consumers', () => {
  it('shares departure and distant boundaries with prediction', () => {
    const departure = makeDeparture({ x: field.x + 1900, y: field.y + 650, heading: 90, targetHeading: 90,
      headingAssigned: true, altitude: 8000, targetAltitude: 8000 });
    expect(trackFate(departure, field, domain).keep).toBe(true);
    expect(trackFate({ ...departure, x: field.x + 2101 }, field, domain).keep).toBe(false);
    expect(trackFate(makePlane({ x: field.x + 8000 }), field, domain).keep).toBe(true);
    expect(trackFate(makePlane({ x: field.x + 8750 }), field, domain).keep).toBe(false);
    expect(predictFlightPath(departure, field, fieldRunways, .4, 1, 5, domain).ended).toBe(false);
    expect(predictFlightPath(departure, field, fieldRunways, .4, 1, 5).ended).toBe(true);
  });

  it('does not drop retained wide-band traffic from challenge safety forecasts', () => {
    const candidate = makePlane({ x: field.x + 700, y: field.y, heading: 90, targetHeading: 90,
      speed: 240, targetSpeed: 240, altitude: 8000, targetAltitude: 8000 });
    const other = makeDeparture({ x: field.x + 820, y: field.y, heading: 270, targetHeading: 270,
      headingAssigned: true, speed: 240, targetSpeed: 240, altitude: 8000, targetAltitude: 8000 });
    expect(safeEntry(candidate, { ...request, planes: [other] })).toBe(false);
  });
});
