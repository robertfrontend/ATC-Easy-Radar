import type { Airport, Runway, RunwayConfig } from '../types';
import type { AirportTerrainMap } from './map-types';
import type { SyntheticLayout } from './synthetic-layouts';
import { mdsdSyntheticLayout, mptoSyntheticLayout } from './synthetic-layouts';
import { mdsdMap } from './mdsd-map';
import { mptoMap } from './mpto-map';

export interface MapAirportDefinition {
  map: AirportTerrainMap;
  bindings: { runwayId: string; surfaceId: string; endId: string }[];
  syntheticLayout?: SyntheticLayout;
  suppressedAirspaceIds?: string[];
}

export const airportMapRegistry: Partial<Record<string, MapAirportDefinition>> = {
  MPTO: {
    map: mptoMap, syntheticLayout: mptoSyntheticLayout, suppressedAirspaceIds: ['mpto-canal-zone'],
    bindings: [
      { runwayId: 'mpto-03l', surfaceId: '03L/21R', endId: '03L' },
      { runwayId: 'mpto-03r', surfaceId: '03R/21L', endId: '03R' },
      { runwayId: 'mpto-21l', surfaceId: '03R/21L', endId: '21L' },
      { runwayId: 'mpto-21r', surfaceId: '03L/21R', endId: '21R' },
    ],
  },
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


/** Reciprocal controls paint one source surface; approach availability remains per operative end. */
export function mapPavementActive(airport: Airport, runwayId: string, config: RunwayConfig): boolean {
  const bindings = airportMapRegistry[airport.icao]?.bindings ?? [];
  const surfaceId = bindings.find(binding => binding.runwayId === runwayId)?.surfaceId;
  return surfaceId !== undefined && bindings.some(binding => binding.surfaceId === surfaceId &&
    airport.runways.some(runway => runway.id === binding.runwayId) &&
    (config[binding.runwayId]?.landing || config[binding.runwayId]?.departure));
}
