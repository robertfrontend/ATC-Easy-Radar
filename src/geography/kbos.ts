import type { Airport } from '../types';
import type { GeographicAirport } from './types';
import { kbosData } from './kbos-data';
import { runwayFrame } from './navigation';

const adapted = new WeakMap<Airport, GeographicAirport>();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
freeze(kbosData);

/** Explicit opt-in only: canonical airport inventory and existing consumers stay untouched. */
export function getGeographicAirport(airport: Airport): GeographicAirport {
  if (airport.icao !== 'KBOS' || (airport as GeographicAirport).geographic) return airport;
  let result = adapted.get(airport);
  if (!result) {
    const candidate = { ...structuredClone(airport), ...kbosData, holdingStacks: [], airspacePolygons: [] };
    candidate.runways = candidate.runways.map(runway => ({ ...runway, heading: runwayFrame(candidate, runway).pavementHeading }));
    result = freeze(candidate);
    adapted.set(airport, result);
  }
  return result;
}

export { toMagneticHeading, toTrueHeading } from './headings';
