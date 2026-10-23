import data from './mdsd-map-data.json';
import type { AirportTerrainMap } from './map-types';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Inactive foundation package; consumers explicitly opt in in a separate integration unit. */
export const mdsdMap = freeze(data as AirportTerrainMap);
