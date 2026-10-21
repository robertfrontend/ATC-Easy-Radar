import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { Plane } from '../types';
import { applyClearance } from '../utils/navigation';
import { advancePlane } from '../utils/sim';
import { applySeparation } from '../utils/separation';
import { trackFate } from '../utils/approach';
import { makePlane, field, fieldRunways } from '../test/field';
import { challengeRunways, getIntensity } from './model';
import { safeEntry, spawnIntensityTraffic } from './traffic';

function randomStream(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe('challenge entry safety', () => {
  const request = { airport: field, runwayConfig: fieldRunways, planes: [], now: 0, gameSpeed: 1 as const,
    lastDepartureByRunway: {}, lastDepartureAt: -100000, allowArrival: true, random: randomStream(42) };
  it('rejects immediate and predicted entry conflicts using the existing separation model', () => {
    const plane = makePlane({ x: 200, y: 300, altitude: 15000, heading: 90, targetHeading: 90 });
    expect(safeEntry(plane, { ...request, planes: [{ ...plane, id: 'other' }] })).toBe(false);
    expect(safeEntry(plane, { ...request, planes: [{ ...plane, id: 'other', x: 350, heading: 270, targetHeading: 270 }] })).toBe(false);
    expect(safeEntry(plane, { ...request, planes: [{ ...plane, id: 'other', altitude: 17000, targetAltitude: 17000 }] })).toBe(true);
  });
  it('caps departures too and never consumes runway state for a rejected entry', () => {
    const profile = getIntensity('las-americas', 1)!;
    const blocked = { ...request, planes: Array.from({ length: profile.maxPlanes }, (_, i) => makePlane({ id: `${i}` })) };
    expect(spawnIntensityTraffic(blocked, profile, 1).plane).toBeNull();
    expect(blocked.lastDepartureByRunway).toEqual({});
  });
});

describe('deterministic five-minute feasibility witnesses, not manual playtests', () => {
  for (const airport of AIRPORTS) for (let level = 1; level <= 20; level++) {
    it(`${airport.id}/${level}: safe intake and attainable effective-operation minimum`, () => {
      const profile = getIntensity(airport.id, level)!;
      const runways = challengeRunways(airport);
      const random = randomStream(123 + level);
      const runwayTimes = {};
      let planes: Plane[] = [];
      let lastSpawn = -100000, lastDeparture = -100000, sequence = 0, operations = 0;
      let peakTraffic = 0, collisions = 0, accidents = 0;
      for (let now = 50; now <= 300000; now += 50) {
        if (now - lastSpawn >= profile.spawnIntervalMs && planes.length < profile.maxPlanes) {
          const result = spawnIntensityTraffic({ airport, runwayConfig: runways, planes, now, gameSpeed: 1,
            lastDepartureByRunway: runwayTimes, lastDepartureAt: lastDeparture, allowArrival: true, random }, profile, ++sequence);
          lastSpawn = now;
          lastDeparture = result.lastDepartureAt;
          if (result.plane) {
            const plane = result.plane;
            // Reference policy clears departures out; arrivals receive an outward vector.
            // This proves the minimal activity goal is reachable, not that arrivals are sequenced expertly.
            const outward = (Math.atan2(plane.x - airport.x, airport.y - plane.y) * 180 / Math.PI + 360) % 360;
            planes.push(applyClearance(plane, plane.type === 'departure'
              ? { targetWaypoint: plane.exitWaypointId }
              : { targetHeading: outward, targetAltitude: 20000 + sequence % 5 * 2000 }));
          }
        }
        peakTraffic = Math.max(peakTraffic, planes.length);
        planes = planes.map(plane => advancePlane(plane, airport, runways, .4, 1).plane);
        collisions += applySeparation(planes).collisions;
        planes = planes.filter(plane => {
          const fate = trackFate(plane, airport);
          accidents += Number(fate.accident);
          if (fate.score) operations++;
          return fate.keep;
        });
      }
      expect(operations).toBeGreaterThanOrEqual(profile.minimumOperations);
      expect(peakTraffic).toBeLessThanOrEqual(profile.maxPlanes);
      expect(collisions).toBe(0);
      expect(accidents).toBe(0);
    }, 15000);
  }
});
