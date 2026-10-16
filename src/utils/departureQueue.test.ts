import assert from 'node:assert/strict';
import { AIRPORTS } from '../config/airports';
import { Plane, RunwayConfig } from '../types';
import { parseAtcCommand } from './commands';
import { DEPARTURE_SECTOR_RADIUS, departureLeftSector, isRunwaySafeForDeparture } from './departure';
import { applyClearance, resolveNavigation } from './navigation';

const airport = AIRPORTS.find(a => a.id === 'london-lhr');
if (!airport) throw new Error('Heathrow fixture missing');

const runwayConfig: RunwayConfig = {};
airport.runways.forEach((r, idx) => {
  runwayConfig[r.id] = { landing: idx === 0, departure: idx === 0 };
});
const departureRunway = airport.runways[0];

const EASY = { maxPlanes: 4, minPlanes: 2, spawnRate: 20000, ilsWidth: 0.4 };
const TICK_MS = 50;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function headingDelta(a: number, b: number) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** Arcade movement, matching the 1x tick in useGameLoop. */
function stepPlane(plane: Plane, giveDep: boolean): Plane {
  if (giveDep && plane.type === 'departure' && !plane.targetWaypoint && plane.exitWaypointId && plane.altitude > 1500) {
    const updates = parseAtcCommand('DEP', { airport: airport!, runwayConfig, plane });
    if (updates) plane = applyClearance(plane, updates);
  }

  const nav = resolveNavigation(plane, airport!);
  let targetHeading = nav.targetHeading;
  let targetWaypoint = nav.targetWaypoint;
  let markedForRemoval = nav.markedForRemoval;
  let isEstablished = plane.isEstablished;
  let establishedRunwayId = plane.establishedRunwayId ?? null;
  let targetAltitude = plane.targetAltitude;
  let targetSpeed = plane.targetSpeed;

  if (!isEstablished && !plane.goAround && plane.status !== 'crashed' && plane.type === 'arrival') {
    const candidates = airport!.runways.filter(r => {
      if (plane.assignedRunwayId) return r.id === plane.assignedRunwayId && runwayConfig[r.id]?.landing;
      return !!runwayConfig[r.id]?.landing;
    });
    for (const rwy of candidates) {
      const rwyX = airport!.x + (rwy.offsetX || 0);
      const rwyY = airport!.y + (rwy.offsetY || 0);
      const dx = plane.x - rwyX;
      const dy = plane.y - rwyY;
      const rad = -rwy.heading * Math.PI / 180;
      const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const inCone = rotatedY > 20 && rotatedY < 520 && Math.abs(rotatedX) <= rotatedY * EASY.ilsWidth;
      const rel = (plane.heading - rwy.heading + 360) % 360;
      if (inCone && plane.altitude <= 10000 && (rel > 310 || rel < 50)) {
        isEstablished = true;
        establishedRunwayId = rwy.id;
        break;
      }
    }
  }

  if (isEstablished && plane.status !== 'crashed') {
    const rwy = airport!.runways.find(r => r.id === establishedRunwayId) || airport!.runways[0];
    const rwyX = airport!.x + (rwy.offsetX || 0);
    const rwyY = airport!.y + (rwy.offsetY || 0);
    const dx = plane.x - rwyX;
    const dy = plane.y - rwyY;
    const rad = -rwy.heading * Math.PI / 180;
    const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const correction = rotatedX < 0 ? Math.min(30, -rotatedX * 2) : -Math.min(30, rotatedX * 2);
    targetHeading = (rwy.heading + correction + 360) % 360;
    targetAltitude = 0;
    targetSpeed = 140;
  }

  const turnRate = 0.6;
  let heading = plane.heading;
  if (heading !== targetHeading) {
    let diff = targetHeading - heading;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    if (Math.abs(diff) < turnRate) heading = targetHeading;
    else heading = (heading + Math.sign(diff) * turnRate + 360) % 360;
  }

  const climbRate = 18;
  let altitude = plane.altitude;
  if (altitude !== targetAltitude) {
    const altDiff = targetAltitude - altitude;
    altitude = Math.abs(altDiff) < climbRate ? targetAltitude : altitude + Math.sign(altDiff) * climbRate;
  }

  const accelRate = 0.25;
  let speed = plane.speed;
  if (speed !== targetSpeed) {
    const speedDiff = targetSpeed - speed;
    speed = Math.abs(speedDiff) < accelRate ? targetSpeed : speed + Math.sign(speedDiff) * accelRate;
  }

  const speedMultiplier = 0.0015;
  return {
    ...plane,
    x: plane.x + speed * speedMultiplier * Math.sin(heading * Math.PI / 180),
    y: plane.y - speed * speedMultiplier * Math.cos(heading * Math.PI / 180),
    heading,
    altitude,
    speed,
    targetHeading,
    targetAltitude,
    targetSpeed,
    isEstablished,
    establishedRunwayId,
    targetWaypoint,
    markedForRemoval,
  };
}

function pickExit(rnd: () => number) {
  const rwy = departureRunway;
  const rwyX = airport!.x + (rwy.offsetX || 0);
  const rwyY = airport!.y + (rwy.offsetY || 0);
  const scored = airport!.waypoints.map(wp => {
    const angle = (Math.atan2(wp.y - rwyY, wp.x - rwyX) * 180 / Math.PI) + 90;
    const normalized = (angle + 360) % 360;
    let diff = Math.abs(normalized - rwy.heading);
    if (diff > 180) diff = 360 - diff;
    return { wp, diff };
  }).sort((a, b) => a.diff - b.diff);
  const best = scored.slice(0, 2);
  return best[Math.floor(rnd() * best.length)].wp;
}

interface RunStats {
  spawned: number;
  leftSector: number;
  reachedExit: number;
  maxHeadingError: number;
}

function simulate(options: {
  minutes: number;
  seed: number;
  giveDep: boolean;
  alwaysDepart?: boolean;
}): RunStats {
  const rnd = mulberry32(options.seed);
  let planes: Plane[] = [];
  let lastSpawn = 0;
  let initialized = false;
  const lastDepartureByRunway: Record<string, number> = {};
  let lastDepartureAt = 0;
  const stats: RunStats = { spawned: 0, leftSector: 0, reachedExit: 0, maxHeadingError: 0 };
  let idn = 1;
  const t0 = 1_700_000_000_000;
  const ticks = Math.round((options.minutes * 60 * 1000) / TICK_MS);

  const spawn = (now: number) => {
    const safe = airport!.runways.filter(runway => isRunwaySafeForDeparture({
      airport: airport!,
      runway,
      runwayConfig,
      planes,
      now,
      gameSpeed: 1,
      lastDepartureByRunway,
      lastDepartureAt,
    }));
    const isDeparture = safe.length > 0 && (planes.length === 0 || options.alwaysDepart || rnd() < 0.35);
    const rwy = isDeparture ? safe[0] : null;
    let x = 0;
    let y = 0;
    let heading = 0;
    let altitude = 0;
    let targetAltitude = 0;
    let speed = 0;
    let targetSpeed = 0;
    let assignedRunwayId: string | null = null;
    let exitWaypointId: string | null = null;

    if (rwy) {
      lastDepartureByRunway[rwy.id] = now;
      lastDepartureAt = now;
      x = airport!.x + (rwy.offsetX || 0);
      y = airport!.y + (rwy.offsetY || 0);
      heading = rwy.heading;
      exitWaypointId = pickExit(rnd).id;
      assignedRunwayId = rwy.id;
      altitude = 0;
      targetAltitude = 11000 + Math.floor(rnd() * 6) * 1000;
      speed = 135;
      targetSpeed = 240;
      stats.spawned++;
    } else {
      const angle = rnd() * Math.PI * 2;
      x = airport!.x + Math.cos(angle) * 580;
      y = airport!.y + Math.sin(angle) * 580;
      const angleToCenter = Math.atan2(airport!.y - y, airport!.x - x);
      heading = (angleToCenter * 180 / Math.PI) + 90;
      if (heading < 0) heading += 360;
      heading = (heading + (rnd() * 60 - 30) + 360) % 360;
      altitude = 10000 + Math.floor(rnd() * 16) * 1000;
      targetAltitude = altitude;
      speed = 240 + Math.floor(rnd() * 8) * 10;
      targetSpeed = speed;
    }

    planes.push({
      id: String(idn++),
      callsign: (isDeparture ? 'D' : 'A') + idn,
      model: 'A320',
      squawk: '1234',
      type: isDeparture ? 'departure' : 'arrival',
      originFlag: '🇬🇧',
      x,
      y,
      heading,
      targetHeading: heading,
      altitude,
      targetAltitude,
      speed,
      targetSpeed,
      trail: [],
      status: 'normal',
      isEstablished: false,
      assignedRunwayId,
      hasInstructions: !!isDeparture,
      targetWaypoint: null,
      exitWaypointId,
      headingAssigned: false,
    });
  };

  for (let t = 0; t < ticks; t++) {
    const now = t0 + t * TICK_MS;
    if (!initialized) {
      spawn(now);
      initialized = true;
      lastSpawn = now;
    }
    const since = now - lastSpawn;
    if (
      since > 4000 &&
      (planes.length < EASY.minPlanes || (planes.length < EASY.maxPlanes && since > EASY.spawnRate))
    ) {
      spawn(now);
      lastSpawn = now;
    }

    const next: Plane[] = [];
    for (const plane of planes) {
      const moved = stepPlane(plane, options.giveDep);
      if (moved.type === 'departure' && !moved.targetWaypoint) {
        stats.maxHeadingError = Math.max(stats.maxHeadingError, headingDelta(moved.heading, departureRunway.heading));
      }
      if (moved.markedForRemoval) {
        if (moved.type === 'departure') stats.reachedExit++;
        continue;
      }
      if (departureLeftSector(moved, airport!)) {
        stats.leftSector++;
        continue;
      }
      if (moved.type === 'arrival') {
        const rwy = airport!.runways.find(r => r.id === moved.establishedRunwayId);
        const rwyX = airport!.x + (rwy?.offsetX || 0);
        const rwyY = airport!.y + (rwy?.offsetY || 0);
        const distToRwy = Math.hypot(moved.x - rwyX, moved.y - rwyY);
        if (distToRwy < 30 && (moved.isEstablished || moved.altitude <= 2000)) continue;
      }
      if (Math.hypot(moved.x - airport!.x, moved.y - airport!.y) >= 2500) continue;
      next.push(moved);
    }
    planes = next;
  }
  return stats;
}

const onRunway = departureLeftSector({
  id: 'dep',
  callsign: 'BAW1',
  model: 'A320',
  squawk: '1234',
  type: 'departure',
  originFlag: '🇬🇧',
  x: airport.x,
  y: airport.y,
  heading: departureRunway.heading,
  targetHeading: departureRunway.heading,
  altitude: 500,
  targetAltitude: 11000,
  speed: 160,
  targetSpeed: 240,
  trail: [],
  status: 'normal',
  isEstablished: false,
  assignedRunwayId: departureRunway.id,
  hasInstructions: true,
  targetWaypoint: null,
  exitWaypointId: 'WP-L5',
  headingAssigned: false,
}, airport);
assert.equal(onRunway, false, 'a departure still on the airport has not left the sector');

const outside = departureLeftSector({
  id: 'dep',
  callsign: 'BAW1',
  model: 'A320',
  squawk: '1234',
  type: 'departure',
  originFlag: '🇬🇧',
  x: airport.x + DEPARTURE_SECTOR_RADIUS + 40,
  y: airport.y,
  heading: departureRunway.heading,
  targetHeading: departureRunway.heading,
  altitude: 8000,
  targetAltitude: 11000,
  speed: 240,
  targetSpeed: 240,
  trail: [],
  status: 'normal',
  isEstablished: false,
  assignedRunwayId: departureRunway.id,
  hasInstructions: true,
  targetWaypoint: null,
  exitWaypointId: 'WP-L5',
  headingAssigned: false,
}, airport);
assert.equal(outside, true, 'an uncleared departure past the scope frees its slot');

const clearedOutside = departureLeftSector({
  id: 'dep',
  callsign: 'BAW1',
  model: 'A320',
  squawk: '1234',
  type: 'departure',
  originFlag: '🇬🇧',
  x: airport.x + DEPARTURE_SECTOR_RADIUS + 40,
  y: airport.y,
  heading: 90,
  targetHeading: 90,
  altitude: 8000,
  targetAltitude: 11000,
  speed: 240,
  targetSpeed: 240,
  trail: [],
  status: 'normal',
  isEstablished: false,
  assignedRunwayId: departureRunway.id,
  hasInstructions: true,
  targetWaypoint: 'WP-L5',
  exitWaypointId: 'WP-L5',
  headingAssigned: false,
}, airport);
assert.equal(clearedOutside, false, 'a departure cleared direct is not dropped on the way to the exit');

function runwayAvailable(plane: Plane) {
  const now = 1_700_000_000_000;
  return isRunwaySafeForDeparture({
    airport: airport!,
    runway: departureRunway,
    runwayConfig,
    planes: [plane],
    now,
    gameSpeed: 1,
    lastDepartureByRunway: { [departureRunway.id]: now - 25000 },
    lastDepartureAt: now - 25000,
  });
}

const rwyX = airport.x + (departureRunway.offsetX || 0);
const rwyY = airport.y + (departureRunway.offsetY || 0);
const track = {
  id: 'dep',
  callsign: 'BAW1',
  model: 'A320',
  squawk: '1234',
  type: 'departure' as const,
  originFlag: '🇬🇧',
  x: rwyX,
  y: rwyY,
  heading: departureRunway.heading,
  targetHeading: departureRunway.heading,
  altitude: 400,
  targetAltitude: 11000,
  speed: 150,
  targetSpeed: 240,
  trail: [],
  status: 'normal' as const,
  isEstablished: false,
  assignedRunwayId: departureRunway.id,
  hasInstructions: true,
  targetWaypoint: null,
  exitWaypointId: 'WP-L5',
  headingAssigned: false,
};
assert.equal(runwayAvailable(track), false, 'a departure still on the roll occupies the runway');
assert.equal(
  runwayAvailable({ ...track, altitude: 4000, x: rwyX + 50 }),
  true,
  'an airborne departure inside the old 5 NM bubble must release the runway'
);

// The runway stays available whenever it is legally free. This is the path
// that used to die after a single takeoff, because that aircraft occupied a
// slot until the 2,500-unit map edge.
for (const giveDep of [false, true]) {
  const stats = simulate({ minutes: 6, seed: 1, giveDep, alwaysDepart: true });
  const departed = giveDep ? stats.reachedExit : stats.leftSector;
  assert.ok(stats.spawned >= 8, `expected a stream of departures (DEP=${giveDep}), spawned ${stats.spawned}`);
  assert.ok(departed >= 5, `expected departures to leave (DEP=${giveDep}), departed ${departed}`);
  if (!giveDep) {
    assert.equal(stats.reachedExit, 0, 'without DEP a departure must not score the exit');
    assert.ok(stats.maxHeadingError < 1, `runway heading drifted by ${stats.maxHeadingError}`);
  }
}

// Same mix the game uses (about 35% departures). Twelve minutes is enough
// for several takeoffs; none of the seeds stall after the first one.
function sample(giveDep: boolean) {
  const spawned: number[] = [];
  const departed: number[] = [];
  for (let seed = 1; seed <= 20; seed++) {
    const stats = simulate({ minutes: 12, seed, giveDep });
    spawned.push(stats.spawned);
    departed.push(giveDep ? stats.reachedExit : stats.leftSector);
  }
  spawned.sort((a, b) => a - b);
  departed.sort((a, b) => a - b);
  return {
    minSpawned: spawned[0],
    medianSpawned: spawned[Math.floor(spawned.length / 2)],
    minDeparted: departed[0],
    medianDeparted: departed[Math.floor(departed.length / 2)],
  };
}

for (const giveDep of [false, true]) {
  const sampleStats = sample(giveDep);
  assert.ok(sampleStats.minSpawned >= 2, `a session stalled after one departure (DEP=${giveDep}): ${JSON.stringify(sampleStats)}`);
  assert.ok(sampleStats.medianSpawned >= 5, `typical session should launch 4-5 departures (DEP=${giveDep}): ${JSON.stringify(sampleStats)}`);
  assert.ok(sampleStats.medianDeparted >= 4, `typical departures should leave (DEP=${giveDep}): ${JSON.stringify(sampleStats)}`);
}

console.log('departure queue checks passed');
