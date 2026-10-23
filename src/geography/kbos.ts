import type { Airport } from '../types';
import type { GeographicAirport } from './types';
import { kbosData } from './kbos-data';
import { runwayFrame } from './navigation';
import { mdsdMap } from './mdsd-map';
import { mdsdSyntheticLayout } from './synthetic-layouts';

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
  if (existing.geographic || existing.terrainMap || !['KBOS', 'MDSD'].includes(airport.icao)) return airport;
  let result = adapted.get(airport);
  if (!result) {
    const candidate: GeographicAirport = airport.icao === 'KBOS'
      ? { ...structuredClone(airport), ...kbosData, holdingStacks: [], airspacePolygons: [] }
      : { ...structuredClone(airport), terrainMap: mdsdMap, syntheticLayout: mdsdSyntheticLayout,
        airspacePolygons: structuredClone(airport.airspacePolygons?.filter(polygon => polygon.id !== 'mdsd-caribbean')) };
    if (candidate.syntheticLayout) {
      const layout = candidate.syntheticLayout;
      candidate.waypoints = candidate.waypoints.map(fix => ({ ...fix, ...layout.fixPositions[fix.id] }));
      candidate.holdingStacks = candidate.holdingStacks?.map(hold => {
        const fix = candidate.waypoints.find(point => point.id === layout.holdFixIds[hold.id]);
        return fix ? { ...hold, x: fix.x, y: fix.y - 10 } : hold;
      });
    }
    if (candidate.terrainMap) {
      const [first, second] = candidate.terrainMap.physicalRunways[0].ends;
      const center = { x: (first.position.x + second.position.x) / 2, y: (first.position.y + second.position.y) / 2 };
      const length = Math.hypot(second.position.x - first.position.x, second.position.y - first.position.y);
      const heading = (Math.atan2(second.position.x - first.position.x, first.position.y - second.position.y) * 180 / Math.PI + 360) % 360;
      candidate.runways = candidate.runways.map(runway => ({ ...runway, length,
        offsetX: center.x - candidate.x, offsetY: center.y - candidate.y,
        heading: runway.label === first.id ? heading : (heading + 180) % 360 }));
    } else {
      candidate.runways = candidate.runways.map(runway => ({ ...runway, heading: runwayFrame(candidate, runway).pavementHeading }));
    }
    result = freeze(candidate);
    adapted.set(airport, result);
  }
  return result;
}

export { toMagneticHeading, toTrueHeading } from './headings';
