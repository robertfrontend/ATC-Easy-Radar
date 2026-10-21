import { Airport, Plane } from '../types';

/** Fixed world bounds, independent of the radar camera, zoom and viewport. */
export const DEPARTURE_SECTOR_HALF_EXTENT = 600;
export const DISTANT_WORLD_HALF_EXTENT = 2500;

/** Distance to an airport-centered square edge, in unchanged radar units. */
export function squareExtent(position: Pick<Plane, 'x' | 'y'>, airport: Pick<Airport, 'x' | 'y'>): number {
  return Math.max(Math.abs(position.x - airport.x), Math.abs(position.y - airport.y));
}
