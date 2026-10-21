import { Airport, Plane } from '../types';

/** Fixed world bounds, independent of the radar camera, zoom and viewport. */
export const DEPARTURE_SECTOR_HALF_EXTENT = 600;
export const DISTANT_WORLD_HALF_EXTENT = 2500;

/** Distance to an airport-centered square edge, in unchanged radar units. */
export function squareExtent(position: Pick<Plane, 'x' | 'y'>, airport: Pick<Airport, 'x' | 'y'>): number {
  return Math.max(Math.abs(position.x - airport.x), Math.abs(position.y - airport.y));
}

export interface RadarDomain {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export const DEFAULT_RADAR_DOMAIN: RadarDomain = Object.freeze({ halfWidth: 600, halfHeight: 600 });
export const ARRIVAL_INTAKE_MARGIN = 20;

/** Capture this once per session; later camera changes must not resize the world. */
export function createRadarDomain(aspect = 1, halfSpan = DEPARTURE_SECTOR_HALF_EXTENT): RadarDomain {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return Object.freeze({
    halfWidth: halfSpan * Math.max(1, ratio),
    halfHeight: halfSpan * Math.max(1, 1 / ratio),
  });
}

/** Canonical 600-unit extent: preserves existing strict/inclusive bound comparisons. */
export function domainExtent(
  position: Pick<Plane, 'x' | 'y'>,
  airport: Pick<Airport, 'x' | 'y'>,
  domain: RadarDomain = DEFAULT_RADAR_DOMAIN,
): number {
  return Math.max(
    Math.abs(position.x - airport.x) * DEPARTURE_SECTOR_HALF_EXTENT / domain.halfWidth,
    Math.abs(position.y - airport.y) * DEPARTURE_SECTOR_HALF_EXTENT / domain.halfHeight,
  );
}

/** Clockwise arc-length sampling from the top-left intake corner, using one draw. */
export function sampleArrivalPerimeter(
  airport: Pick<Airport, 'x' | 'y'>,
  domain: RadarDomain,
  unitSample: number,
): { x: number; y: number } {
  const width = domain.halfWidth - ARRIVAL_INTAKE_MARGIN;
  const height = domain.halfHeight - ARRIVAL_INTAKE_MARGIN;
  const perimeter = 4 * (width + height);
  let distance = (unitSample * perimeter) % perimeter;
  if (distance < 2 * width) return { x: airport.x - width + distance, y: airport.y - height };
  distance -= 2 * width;
  if (distance < 2 * height) return { x: airport.x + width, y: airport.y - height + distance };
  distance -= 2 * height;
  if (distance < 2 * width) return { x: airport.x + width - distance, y: airport.y + height };
  distance -= 2 * width;
  return { x: airport.x - width, y: airport.y + height - distance };
}

/** Center bearing ±30°, projected strictly inward at each incident intake edge. */
export function arrivalInwardHeading(
  position: Pick<Plane, 'x' | 'y'>,
  airport: Pick<Airport, 'x' | 'y'>,
  domain: RadarDomain,
  jitterSample: number,
): number {
  const dx = position.x - airport.x;
  const dy = position.y - airport.y;
  const angle = Math.atan2(-dy, -dx) + (jitterSample * 60 - 30) * Math.PI / 180;
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);
  const epsilon = 1e-6;
  // At a corner both half-planes apply. Projection needs no extra random draw.
  if (Math.abs(Math.abs(dx) - (domain.halfWidth - ARRIVAL_INTAKE_MARGIN)) < 1e-7) {
    vx = dx > 0 ? Math.min(vx, -epsilon) : Math.max(vx, epsilon);
  }
  if (Math.abs(Math.abs(dy) - (domain.halfHeight - ARRIVAL_INTAKE_MARGIN)) < 1e-7) {
    vy = dy > 0 ? Math.min(vy, -epsilon) : Math.max(vy, epsilon);
  }
  return (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360;
}
