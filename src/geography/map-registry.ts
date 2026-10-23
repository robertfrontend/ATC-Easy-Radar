import type { Airport, Runway } from '../types';
import type { AirportTerrainMap } from './map-types';
import type { SyntheticLayout } from './synthetic-layouts';
import { mdsdSyntheticLayout } from './synthetic-layouts';
import { mdsdMap } from './mdsd-map';

export interface MapAirportDefinition {
  map: AirportTerrainMap;
  bindings: { runwayId: string; surfaceId: string; endId: string }[];
  syntheticLayout?: SyntheticLayout;
  suppressedAirspaceIds?: string[];
}

export const airportMapRegistry: Partial<Record<string, MapAirportDefinition>> = {
  MDSD: {
    map: mdsdMap, syntheticLayout: mdsdSyntheticLayout, suppressedAirspaceIds: ['mdsd-caribbean'],
    bindings: [
      { runwayId: 'mdsd-17', surfaceId: '17/35', endId: '17' },
      { runwayId: 'mdsd-35', surfaceId: '17/35', endId: '35' },
    ],
  },
};

/** Bind approximate endpoint spans only; no threshold displacement or real navigation is inferred. */
export function deriveMapRunways(airport: Airport, definition: MapAirportDefinition): Runway[] {
  const surfaces = new Map<string, AirportTerrainMap['physicalRunways'][number]>();
  for (const surface of definition.map.physicalRunways) {
    if (!surface.id || surfaces.has(surface.id) || surface.ends.length !== 2) {
      throw new Error('Invalid or duplicate map surface');
    }
    const [first, second] = surface.ends;
    if (first.id === second.id) throw new Error('Duplicate map surface end');
    const span = Math.hypot(second.position.x - first.position.x, second.position.y - first.position.y);
    const midpoint = [(first.position.x + second.position.x) / 2, (first.position.y + second.position.y) / 2];
    if (surface.ends.some(end => !end.id || ![
      end.position.x, end.position.y, end.coordinate.longitude, end.coordinate.latitude,
    ].every(Number.isFinite)) || ![span, ...midpoint].every(Number.isFinite) || span === 0) {
      throw new Error('Invalid map geometry');
    }
    surfaces.set(surface.id, surface);
  }
  const bindings = new Map<string, MapAirportDefinition['bindings'][number]>();
  const boundEnds = new Set<string>();
  for (const binding of definition.bindings) {
    const key = JSON.stringify([binding.surfaceId, binding.endId]);
    if (bindings.has(binding.runwayId) || boundEnds.has(key) ||
      !airport.runways.some(runway => runway.id === binding.runwayId)) {
      throw new Error('Invalid or duplicate operative binding');
    }
    const surface = surfaces.get(binding.surfaceId);
    if (!surface || !surface.ends.some(end => end.id === binding.endId)) throw new Error('Binding references missing surface/end');
    bindings.set(binding.runwayId, binding);
    boundEnds.add(key);
  }
  return airport.runways.map(runway => {
    const binding = bindings.get(runway.id);
    if (!binding) throw new Error(`Missing map binding: ${runway.id}`);
    const [first, second] = surfaces.get(binding.surfaceId)!.ends;
    const center = { x: (first.position.x + second.position.x) / 2, y: (first.position.y + second.position.y) / 2 };
    const length = Math.hypot(second.position.x - first.position.x, second.position.y - first.position.y);
    const heading = (Math.atan2(second.position.x - first.position.x, first.position.y - second.position.y) * 180 / Math.PI + 360) % 360;
    return { ...runway, length, offsetX: center.x - airport.x, offsetY: center.y - airport.y,
      heading: binding.endId === first.id ? heading : (heading + 180) % 360 };
  });
}
