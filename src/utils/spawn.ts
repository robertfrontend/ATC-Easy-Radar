import { Airport, Difficulty, GameSpeed, Plane, RunwayConfig } from '../types';
import { isRunwaySafeForDeparture } from './departure';
import { arrivalInwardHeading, DEFAULT_RADAR_DOMAIN, RadarDomain, sampleArrivalPerimeter } from './radarBounds';

export const DIFFICULTY_CONFIG: Record<Difficulty, {
  maxPlanes: number;
  minPlanes: number;
  spawnRate: number;
  ilsWidth: number;
}> = {
  easy:   { maxPlanes: 4,  minPlanes: 2, spawnRate: 20000, ilsWidth: 0.4 },
  medium: { maxPlanes: 8,  minPlanes: 4, spawnRate: 15000, ilsWidth: 0.2 },
  hard:   { maxPlanes: 12, minPlanes: 6, spawnRate: 8000,  ilsWidth: 0.12 },
};

export function isSpawnDue(input: {
  now: number;
  lastSpawnAt: number;
  planeCount: number;
  difficulty: Difficulty;
  gameSpeed: GameSpeed;
}): boolean {
  const { now, lastSpawnAt, planeCount, difficulty, gameSpeed } = input;
  const config = DIFFICULTY_CONFIG[difficulty];
  const isReal = gameSpeed === 'real';
  const numSpeed = typeof gameSpeed === 'number' ? gameSpeed : 1;
  const timeSinceLast = now - lastSpawnAt;
  const minSpawnInterval = isReal
    ? (planeCount < config.minPlanes ? 6000 : 25000)
    : (4000 / numSpeed);
  const effectiveSpawnRate = isReal
    ? (difficulty === 'easy' ? 80000 : difficulty === 'medium' ? 50000 : 30000)
    : (config.spawnRate / numSpeed);

  return timeSinceLast > minSpawnInterval
    && (planeCount < config.minPlanes || timeSinceLast > effectiveSpawnRate);
}

export interface SpawnRequest {
  domain?: RadarDomain;
  airport: Airport;
  runwayConfig: RunwayConfig;
  planes: Plane[];
  now: number;
  gameSpeed: GameSpeed;
  lastDepartureByRunway: Record<string, number>;
  lastDepartureAt: number;
  allowArrival: boolean;
  /** Defaults to Math.random. Injected so tests can replay a sequence. */
  random?: () => number;
  /** Challenge intake only; other modes retain their original 35% departure mix. */
  departureProbability?: number;
}

export interface SpawnResult {
  plane: Plane | null;
  lastDepartureAt: number;
}

function generateCallsignAndDetails(airport: Airport, random: () => number) {
  const totalWeight = airport.airlines.reduce((sum, a) => sum + a.weight, 0);
  let randomVal = random() * totalWeight;
  let selectedAirline = airport.airlines[0];

  for (const airline of airport.airlines) {
    randomVal -= airline.weight;
    if (randomVal <= 0) {
      selectedAirline = airline;
      break;
    }
  }

  const num = Math.floor(random() * 9000) + 1000;
  const models = selectedAirline.models && selectedAirline.models.length > 0 ? selectedAirline.models : ['A320', 'B738'];
  const model = models[Math.floor(random() * models.length)];

  const squawkDigit = () => Math.floor(random() * 7) + 1;
  const squawk = `${squawkDigit()}${Math.floor(random() * 8)}${Math.floor(random() * 8)}${Math.floor(random() * 8)}`;

  return {
    callsign: `${selectedAirline.code}${num}`,
    flag: selectedAirline.flag,
    model,
    squawk,
  };
}

/**
 * One spawn attempt. An empty scope with a legal runway always departs.
 * Otherwise a legal runway departs 35% of the time. When the board is full,
 * a missed departure roll spawns nothing instead of another arrival.
 * `lastDepartureByRunway` is updated in place, matching the loop's ref.
 */
export function spawnAircraft(request: SpawnRequest): SpawnResult {
  const random = request.random ?? Math.random;
  const {
    airport,
    runwayConfig,
    planes,
    now,
    gameSpeed,
    lastDepartureByRunway,
    allowArrival,
  } = request;
  let lastDepartureAt = request.lastDepartureAt;

  const safeDepartureRunways = airport.runways.filter(runway =>
    isRunwaySafeForDeparture({
      airport,
      runway,
      runwayConfig,
      planes,
      now,
      gameSpeed,
      lastDepartureByRunway,
      lastDepartureAt,
    })
  );

  const isDeparture = safeDepartureRunways.length > 0 && (planes.length === 0 ? true : random() < (request.departureProbability ?? 0.35));
  if (!isDeparture && !allowArrival) return { plane: null, lastDepartureAt };

  const { callsign, flag, model, squawk } = generateCallsignAndDetails(airport, random);

  let x = 0;
  let y = 0;
  let heading = 0;
  let targetHeading = 0;
  let altitude = 0;
  let targetAltitude = 0;
  let speed = 0;
  let targetSpeed = 0;
  let targetWaypoint: string | null = null;
  let exitWaypointId: string | null = null;
  let assignedRunwayId: string | null = null;

  if (isDeparture) {
    const activeDepRunway = safeDepartureRunways[Math.floor(random() * safeDepartureRunways.length)];
    lastDepartureByRunway[activeDepRunway.id] = now;
    lastDepartureAt = now;

    const rwyX = airport.x + (activeDepRunway.offsetX || 0);
    const rwyY = airport.y + (activeDepRunway.offsetY || 0);
    x = rwyX;
    y = rwyY;

    const departureHeading = activeDepRunway.heading;

    const waypointsWithScore = airport.waypoints.map(wp => {
      const angleToWp = (Math.atan2(wp.y - rwyY, wp.x - rwyX) * 180 / Math.PI) + 90;
      const normalizedAngle = (angleToWp + 360) % 360;
      let diff = Math.abs(normalizedAngle - departureHeading);
      if (diff > 180) diff = 360 - diff;
      return { wp, diff };
    });

    waypointsWithScore.sort((a, b) => a.diff - b.diff);
    const bestWaypoints = waypointsWithScore.slice(0, 2);
    const selectedWp = bestWaypoints.length > 0
      ? bestWaypoints[Math.floor(random() * bestWaypoints.length)].wp
      : airport.waypoints[0];

    exitWaypointId = selectedWp?.id || null;
    targetWaypoint = null;
    heading = departureHeading;
    targetHeading = heading;
    assignedRunwayId = activeDepRunway.id;

    altitude = 0;
    targetAltitude = 11000 + Math.floor(random() * 6) * 1000;
    speed = 135;
    targetSpeed = 240;
  } else {
    const domain = request.domain ?? DEFAULT_RADAR_DOMAIN;
    ({ x, y } = sampleArrivalPerimeter(airport, domain, random()));
    heading = arrivalInwardHeading({ x, y }, airport, domain, random());
    targetHeading = heading;

    altitude = 10000 + Math.floor(random() * 16) * 1000;
    targetAltitude = altitude;
    speed = 240 + Math.floor(random() * 8) * 10;
    targetSpeed = speed;
  }

  const plane: Plane = {
    id: random().toString(36).substring(7),
    callsign,
    model,
    squawk,
    type: isDeparture ? 'departure' : 'arrival',
    originFlag: flag,
    x,
    y,
    heading,
    targetHeading,
    altitude,
    targetAltitude,
    speed,
    targetSpeed,
    trail: [],
    status: 'normal',
    isEstablished: false,
    establishedRunwayId: null,
    assignedRunwayId,
    hasInstructions: isDeparture,
    targetWaypoint,
    exitWaypointId,
    headingAssigned: false,
    conflict: false,
  };

  return { plane, lastDepartureAt };
}
