import { describe, expect, it } from 'vitest';
import { field, fieldRunways, makeDeparture } from '../test/field';
import { isSpawnDue, spawnAircraft } from './spawn';

const NOW = 1_700_000_000_000;

function zeros() {
  return () => 0;
}

function spawn(overrides: Partial<Parameters<typeof spawnAircraft>[0]> = {}) {
  const lastDepartureByRunway: Record<string, number> = {};
  const result = spawnAircraft({
    airport: field,
    runwayConfig: fieldRunways,
    planes: [],
    now: NOW,
    gameSpeed: 1,
    lastDepartureByRunway,
    lastDepartureAt: 0,
    allowArrival: true,
    random: zeros(),
    ...overrides,
  });
  return { ...result, lastDepartureByRunway };
}

describe('spawning', () => {
  it('puts the first aircraft on the runway, climbing runway heading, with an exit stored', () => {
    const { plane, lastDepartureAt, lastDepartureByRunway } = spawn();
    expect(plane).not.toBeNull();
    expect(plane!.type).toBe('departure');
    expect(plane!.x).toBe(field.x);
    expect(plane!.y).toBe(field.y);
    expect(plane!.heading).toBe(0);
    expect(plane!.targetHeading).toBe(0);
    expect(plane!.altitude).toBe(0);
    expect(plane!.targetAltitude).toBe(11000);
    expect(plane!.speed).toBe(135);
    expect(plane!.targetSpeed).toBe(240);
    expect(plane!.targetWaypoint).toBeNull();
    expect(plane!.exitWaypointId).toBe('north');
    expect(plane!.headingAssigned).toBe(false);
    expect(plane!.hasInstructions).toBe(true);
    expect(plane!.assignedRunwayId).toBe('rwy-36');
    expect(plane!.callsign).toBe('TST1000');
    expect(plane!.squawk).toBe('1000');
    expect(lastDepartureAt).toBe(NOW);
    expect(lastDepartureByRunway['rwy-36']).toBe(NOW);
  });

  it('chooses the exit from the two fixes closest to runway heading', () => {
    const picksEast = [0, 0, 0, 0, 0, 0, 0, 0, 0.99];
    let index = 0;
    const { plane } = spawn({
      random: () => picksEast[index++] ?? 0,
    });
    expect(plane!.exitWaypointId).toBe('east');
    expect(plane!.targetWaypoint).toBeNull();
  });

  it('keeps an arrival heading in 0–359 when the inbound offset crosses north', () => {
    // South of the field the inbound heading is just above north. A full
    // left offset used to wrap through the JS remainder and store a negative
    // heading, which the data block printed as "-30".
    const values = [0, 0, 0, 0, 0, 0, 0, 0.625, 0];
    let index = 0;
    const { plane } = spawn({
      runwayConfig: {
        'rwy-36': { landing: true, departure: false },
        'rwy-18': { landing: false, departure: false },
      },
      random: () => values[index++] ?? 0,
    });
    expect(plane!.type).toBe('arrival');
    expect(plane!.heading).toBeCloseTo(330, 2);
    expect(plane!.heading).toBeGreaterThanOrEqual(0);
    expect(plane!.targetHeading).toBe(plane!.heading);
  });

  it('spawns an arrival on the perimeter when the departure roll misses', () => {
    let calls = 0;
    const { plane, lastDepartureAt } = spawn({
      planes: [makeDeparture({ id: 'already', altitude: 5000, x: field.x + 200 })],
      random: () => {
        calls += 1;
        return calls === 1 ? 0.9 : 0;
      },
    });
    expect(plane!.type).toBe('arrival');
    expect(Math.max(Math.abs(plane!.x - field.x), Math.abs(plane!.y - field.y))).toBeCloseTo(580);
    expect(plane!.x).toBeCloseTo(field.x - 580);
    expect(plane!.y).toBeCloseTo(field.y - 580);
    expect(plane!.heading).toBeCloseTo(105);
    expect(plane!.altitude).toBe(10000);
    expect(plane!.speed).toBe(240);
    expect(plane!.targetAltitude).toBe(plane!.altitude);
    expect(plane!.hasInstructions).toBe(false);
    expect(plane!.exitWaypointId).toBeNull();
    expect(plane!.assignedRunwayId).toBeNull();
    expect(lastDepartureAt).toBe(0);
  });

  it('spawns nothing when the board is full and the departure roll misses', () => {
    let calls = 0;
    const { plane } = spawn({
      planes: [makeDeparture({ id: 'already', altitude: 5000, x: field.x + 200 })],
      allowArrival: false,
      random: () => {
        calls += 1;
        return 0.9;
      },
    });
    expect(plane).toBeNull();
    expect(calls).toBe(1);
  });

  it('still departs when the roll would have missed but the scope is empty', () => {
    const { plane } = spawn({ random: () => 0.99 });
    expect(plane!.type).toBe('departure');
  });

  it('spawns an arrival when the runway is occupied by a rolling departure', () => {
    const rolling = makeDeparture({ altitude: 400, x: field.x, y: field.y });
    const { plane } = spawn({ planes: [rolling] });
    expect(plane!.type).toBe('arrival');
  });

  it('launches another departure once the previous one is airborne', () => {
    const airborne = makeDeparture({ altitude: 4000, x: field.x + 50, y: field.y });
    const { plane } = spawn({
      planes: [airborne],
      lastDepartureByRunway: { 'rwy-36': NOW - 25000 },
      lastDepartureAt: NOW - 25000,
      random: () => 0,
    });
    expect(plane!.type).toBe('departure');
    expect(plane!.assignedRunwayId).toBe('rwy-36');
  });

  it('spawns an arrival when no runway is open for departure', () => {
    const { plane } = spawn({
      runwayConfig: {
        'rwy-36': { landing: true, departure: false },
        'rwy-18': { landing: false, departure: false },
      },
    });
    expect(plane!.type).toBe('arrival');
  });
});

describe('spawn timing', () => {
  it('fills an easy arcade scope after 4 seconds and otherwise waits out the spawn rate', () => {
    const belowMinimum = { now: 5000, lastSpawnAt: 0, planeCount: 1, difficulty: 'easy' as const, gameSpeed: 1 as const };
    expect(isSpawnDue({ ...belowMinimum, now: 4000 })).toBe(false);
    expect(isSpawnDue({ ...belowMinimum, now: 4001 })).toBe(true);

    const atMinimum = { ...belowMinimum, planeCount: 2 };
    expect(isSpawnDue({ ...atMinimum, now: 20000 })).toBe(false);
    expect(isSpawnDue({ ...atMinimum, now: 20001 })).toBe(true);
  });

  it('uses the real-mode intervals and scales arcade time with game speed', () => {
    expect(isSpawnDue({
      now: 6000,
      lastSpawnAt: 0,
      planeCount: 0,
      difficulty: 'easy',
      gameSpeed: 'real',
    })).toBe(false);
    expect(isSpawnDue({
      now: 6001,
      lastSpawnAt: 0,
      planeCount: 0,
      difficulty: 'easy',
      gameSpeed: 'real',
    })).toBe(true);
    expect(isSpawnDue({
      now: 80000,
      lastSpawnAt: 0,
      planeCount: 2,
      difficulty: 'easy',
      gameSpeed: 'real',
    })).toBe(false);
    expect(isSpawnDue({
      now: 80001,
      lastSpawnAt: 0,
      planeCount: 2,
      difficulty: 'easy',
      gameSpeed: 'real',
    })).toBe(true);
    expect(isSpawnDue({
      now: 50001,
      lastSpawnAt: 0,
      planeCount: 8,
      difficulty: 'medium',
      gameSpeed: 'real',
    })).toBe(true);
    expect(isSpawnDue({
      now: 30001,
      lastSpawnAt: 0,
      planeCount: 12,
      difficulty: 'hard',
      gameSpeed: 'real',
    })).toBe(true);

    expect(isSpawnDue({
      now: 10000,
      lastSpawnAt: 0,
      planeCount: 2,
      difficulty: 'easy',
      gameSpeed: 2,
    })).toBe(false);
    expect(isSpawnDue({
      now: 10001,
      lastSpawnAt: 0,
      planeCount: 2,
      difficulty: 'easy',
      gameSpeed: 2,
    })).toBe(true);
  });
});
