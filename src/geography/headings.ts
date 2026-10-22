import type { GeographicAirport } from './types';

const normalize = (heading: number) => ((heading % 360) + 360) % 360;
/** Convert only external magnetic clearances, never internal geometry-derived bearings. */
export function toTrueHeading(heading: number, airport: GeographicAirport) {
  return airport.geographic ? normalize(heading + airport.geographic.magneticVariationEast) : heading;
}
export function toMagneticHeading(heading: number, airport: GeographicAirport) {
  return airport.geographic ? normalize(heading - airport.geographic.magneticVariationEast) : heading;
}
