import { Airport, GameSpeed, Plane, Runway, RunwayConfig } from '../types';

/**
 * Radar scope radius. Aircraft are clipped at 560; arrivals spawn just outside
 * that ring. An uncleared departure past this point has left the sector.
 */
export const DEPARTURE_SECTOR_RADIUS = 600;

export interface DepartureSeparationState {
  airport: Airport;
  runway: Runway;
  runwayConfig: RunwayConfig;
  planes: Plane[];
  now: number;
  gameSpeed: GameSpeed;
  lastDepartureByRunway: Record<string, number>;
  lastDepartureAt: number;
}

/**
 * Whether another aircraft may roll on this runway right now.
 * A previous departure only blocks the runway while it is still in the
 * takeoff corridor (close in, or still below 2,000 ft) — not for the rest
 * of its life.
 */
export function isRunwaySafeForDeparture(state: DepartureSeparationState): boolean {
  const { airport, runway, runwayConfig, planes, now, gameSpeed } = state;
  if (!runwayConfig[runway.id]?.departure) return false;

  const isReal = gameSpeed === 'real';
  const numSpeed = typeof gameSpeed === 'number' ? gameSpeed : 1;

  const lastRwyDep = state.lastDepartureByRunway[runway.id] || 0;
  const minRwyInterval = isReal ? 45000 : (20000 / numSpeed);
  if (now - lastRwyDep < minRwyInterval) return false;

  const minGlobalInterval = isReal ? 20000 : (10000 / numSpeed);
  if (now - state.lastDepartureAt < minGlobalInterval) return false;

  const rwyX = airport.x + (runway.offsetX || 0);
  const rwyY = airport.y + (runway.offsetY || 0);

  for (const plane of planes) {
    if (plane.status === 'crashed' || plane.markedForRemoval) continue;

    const distToRwy = Math.hypot(plane.x - rwyX, plane.y - rwyY);

    if (plane.type === 'departure' && plane.assignedRunwayId === runway.id) {
      if (distToRwy < 110 || plane.altitude < 2000) return false;
    }

    if (distToRwy < 75 && plane.altitude < 1200) return false;

    if (plane.type === 'arrival') {
      const onThisFinal = plane.establishedRunwayId === runway.id
        || (plane.assignedRunwayId === runway.id && plane.isEstablished);
      if (onThisFinal && (distToRwy < 125 || plane.altitude < 2800)) return false;
    }
  }

  return true;
}

/**
 * An uncleared departure that flies out of the scope is done.
 * Reaching the exit fix is a different event (`markedForRemoval`) and is the
 * only one that scores. Keeping these tracks alive used to fill `maxPlanes`
 * until the 2,500-unit map edge, so no further departure could spawn.
 */
export function departureLeftSector(plane: Plane, airport: Airport): boolean {
  if (plane.type !== 'departure' || plane.targetWaypoint || plane.status === 'crashed') return false;
  return Math.hypot(plane.x - airport.x, plane.y - airport.y) > DEPARTURE_SECTOR_RADIUS;
}
