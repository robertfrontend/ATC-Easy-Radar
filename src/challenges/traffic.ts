import { Plane } from '../types';
import { applySeparation } from '../utils/separation';
import { advancePlane } from '../utils/sim';
import { trackFate } from '../utils/approach';
import { SpawnRequest, SpawnResult, spawnAircraft } from '../utils/spawn';
import { Intensity } from './model';

/** Reject entry conflicts over a 20-second reaction window using unchanged game physics. */
export function safeEntry(candidate: Plane, request: SpawnRequest): boolean {
  let entry = { ...candidate };
  let traffic = request.planes.map(plane => ({ ...plane }));
  for (let tick = 0; tick <= 400; tick++) {
    for (const plane of traffic) {
      const result = applySeparation([{ ...entry }, { ...plane }]);
      if (result.warning || result.collisions) return false;
    }
    entry = advancePlane(entry, request.airport, request.runwayConfig, .4, 1).plane;
    traffic = traffic.map(plane => advancePlane(plane, request.airport, request.runwayConfig, .4, 1).plane)
      .filter(plane => trackFate(plane, request.airport, request.domain).keep);
  }
  return true;
}

/** No catch-up burst and a hard cap including departures; failed entries commit no runway state. */
export function spawnIntensityTraffic(request: SpawnRequest, intensity: Intensity, sequence: number): SpawnResult {
  const unchanged = { plane: null, lastDepartureAt: request.lastDepartureAt };
  if (request.planes.length >= intensity.maxPlanes) return unchanged;
  for (let attempt = 0; attempt < 8; attempt++) {
    const runwayTimes = { ...request.lastDepartureByRunway };
    const candidateRequest = { ...request, lastDepartureByRunway: runwayTimes,
      departureProbability: intensity.departureProbability };
    const result = spawnAircraft(candidateRequest);
    if (!result.plane) continue;
    const candidate = { ...result.plane, id: `challenge-${sequence}` };
    if (request.planes.some(plane => plane.callsign === candidate.callsign) || !safeEntry(candidate, candidateRequest)) continue;
    Object.assign(request.lastDepartureByRunway, runwayTimes);
    return { ...result, plane: candidate };
  }
  return unchanged;
}
