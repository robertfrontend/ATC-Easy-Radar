import data from './mpto-map-data.json';
import type { AirportTerrainMap } from './map-types';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Approximate map facts only; no verified navigation or magnetic-reference claims. */
export const mptoMap = freeze(data as AirportTerrainMap);
