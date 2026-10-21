import { Airport, GameSpeed, Plane, Runway, RunwayConfig } from '../types';
import { DEPARTURE_SECTOR_HALF_EXTENT, domainExtent, RadarDomain } from './radarBounds';

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
 * A previous departure blocks the strip only during the takeoff roll
 * (still over the pavement and below 1,500 ft). After liftoff it keeps
 * runway heading until DEP, but it must not occupy the runway for the
 * rest of that flight — including while it is still inside 5 NM or below
 * 2,000 ft, which used to stop the queue after a single takeoff.
 */
export function isRunwaySafeForDeparture(state: DepartureSeparationState): boolean {
  const { airport, runway, runwayConfig, planes, now, gameSpeed } = state;
  if (!runwayConfig[runway.id]?.departure) return false;

  const isReal = gameSpeed === 'real';
  const numSpeed = typeof gameSpeed === 'number' ? gameSpeed : 1;

  const lastRwyDep = state.lastDepartureByRunway[runway.id] ?? -Infinity;
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
      const pavement = runway.length || 85;
      if (distToRwy < pavement && plane.altitude < 1500) return false;
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
 * An uncleared departure beyond either square sector edge is done.
 * Reaching the exit fix is a different event (`markedForRemoval`) and is the
 * only one that scores. Keeping these tracks alive used to fill `maxPlanes`
 * until the 2,500-unit map edge, so no further departure could spawn.
 */
export function departureLeftSector(plane: Plane, airport: Airport, domain?: RadarDomain): boolean {
  if (plane.type !== 'departure' || plane.targetWaypoint || plane.status === 'crashed') return false;
  return domainExtent(plane, airport, domain) > DEPARTURE_SECTOR_HALF_EXTENT;
}
