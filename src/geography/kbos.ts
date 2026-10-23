import type { Airport } from '../types';
import type { GeographicAirport } from './types';
import { kbosData } from './kbos-data';
import { runwayFrame } from './navigation';
import { airportMapRegistry, deriveMapRunways } from './map-registry';

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
  const existing = airport as GeographicAirport;
  const mapDefinition = airportMapRegistry[airport.icao];
  if (existing.geographic || existing.terrainMap || airport.icao !== 'KBOS' && !mapDefinition) return airport;
  let result = adapted.get(airport);
  if (!result) {
    const candidate: GeographicAirport = airport.icao === 'KBOS'
      ? { ...structuredClone(airport), ...kbosData, holdingStacks: [], airspacePolygons: [] }
      : { ...structuredClone(airport), terrainMap: mapDefinition!.map, syntheticLayout: mapDefinition!.syntheticLayout,
        airspacePolygons: structuredClone(airport.airspacePolygons?.filter(polygon => !mapDefinition!.suppressedAirspaceIds?.includes(polygon.id))) };
    if (candidate.syntheticLayout) {
      const layout = candidate.syntheticLayout;
      candidate.waypoints = candidate.waypoints.map(fix => ({ ...fix, ...layout.fixPositions[fix.id] }));
      candidate.holdingStacks = candidate.holdingStacks?.map(hold => {
        const fix = candidate.waypoints.find(point => point.id === layout.holdFixIds[hold.id]);
        return fix ? { ...hold, x: fix.x, y: fix.y - 10 } : hold;
      });
    }
    if (candidate.terrainMap) {
      candidate.runways = deriveMapRunways(airport, mapDefinition!);
    } else {
      candidate.runways = candidate.runways.map(runway => ({ ...runway, heading: runwayFrame(candidate, runway).pavementHeading }));
    }
    result = freeze(candidate);
    adapted.set(airport, result);
  }
  return result;
}

export { toMagneticHeading, toTrueHeading } from './headings';
