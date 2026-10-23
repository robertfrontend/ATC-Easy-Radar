import data from './mdsd-map-data.json';
import type { AirportTerrainMap } from './map-types';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Map-only source package; consumers opt in without asserting verified navigation. */
export const mdsdMap = freeze(data as AirportTerrainMap);
