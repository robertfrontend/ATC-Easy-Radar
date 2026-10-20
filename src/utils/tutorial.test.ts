import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { GameSpeed } from '../types';
import { field } from '../test/field';
import { trackFate } from './approach';
import { parseAtcCommand } from './commands';
import { applyClearance } from './navigation';
import { applySeparation } from './separation';
import { advancePlane } from './sim';
import {
  createTutorialScenario,
  hasTutorialSeparation,
  isTutorialArrivalCleared,
  isTutorialDescentCleared,
  isTutorialHeadingCleared,
  isTutorialSeparationCleared,
  isTutorialSpeedCleared,
} from './tutorial';

describe('deterministic arrival practice', () => {
  it('restarts with independent tracks and only the primary landing runway enabled', () => {
    const first = createTutorialScenario(field);
    const restarted = createTutorialScenario(field);
    expect(first).toEqual(restarted);
    first.planes[0].trail.push({ x: 1, y: 2 });
    first.planes[0].altitude = 0;
    expect(restarted.planes[0].trail).toEqual([]);
    expect(restarted.planes[0].altitude).toBe(11000);
    expect(restarted.runwayConfig).toEqual({
      'rwy-36': { landing: true, departure: false },
      'rwy-18': { landing: false, departure: false },
    });
    expect(restarted.planes[0]).toMatchObject({ x: 500, y: 860, heading: 60, targetHeading: 60 });
  });

  it('requires real heading, descent, and speed clearances for the selected training track', () => {
    const scenario = createTutorialScenario(field);
    const initial = scenario.planes[0];
    expect(isTutorialArrivalCleared(initial, scenario)).toBe(false);
    expect(isTutorialHeadingCleared(initial, scenario)).toBe(false);
    expect(isTutorialDescentCleared(initial, scenario)).toBe(false);
    expect(isTutorialSpeedCleared(initial, scenario)).toBe(false);
    const headed = applyClearance(initial, { targetHeading: 0 });
    expect(isTutorialHeadingCleared(headed, scenario)).toBe(true);
    const descending = applyClearance(headed, { targetAltitude: 3000 });
    expect(isTutorialDescentCleared(descending, scenario)).toBe(true);
    const ready = applyClearance(descending, { targetSpeed: 180 });
    expect(isTutorialArrivalCleared(ready, scenario)).toBe(true);
    expect(isTutorialArrivalCleared({ ...ready, id: 'unrelated' }, scenario)).toBe(false);
    expect(isTutorialArrivalCleared(undefined, scenario)).toBe(false);
    expect(isTutorialDescentCleared({ ...ready, targetAltitude: 0 }, scenario)).toBe(false);
    expect(isTutorialSpeedCleared({ ...ready, targetSpeed: 0 }, scenario)).toBe(false);
    expect(isTutorialHeadingCleared({ ...ready, targetHeading: 355 }, scenario)).toBe(true);
  });

  for (const airport of AIRPORTS) {
    for (const gameSpeed of [1, 'real'] as GameSpeed[]) {
      it(`flies H/runway D3000 S180 to capture and a successful landing at ${airport.icao} (${gameSpeed})`, () => {
        const scenario = createTutorialScenario(airport);
        let plane = scenario.planes[0];
        const clearance = parseAtcCommand(`H${scenario.runwayHeading} D3000 S180`, {
          airport,
          runwayConfig: scenario.runwayConfig,
          plane,
        });
        expect(clearance).not.toBeNull();
        plane = applyClearance(plane, clearance!);
        expect(isTutorialArrivalCleared(plane, scenario)).toBe(true);
        let captured = false;
        let landed = false;
        for (let tick = 0; tick < 12000; tick++) {
          const step = advancePlane(plane, airport, scenario.runwayConfig, 0.12, gameSpeed);
          plane = step.plane;
          captured ||= step.justCaptured;
          const fate = trackFate(plane, airport);
          expect(fate.accident).toBe(false);
          if (!fate.keep) {
            landed = fate.success;
            break;
          }
        }
        expect(captured).toBe(true);
        expect(landed).toBe(true);
        expect(plane.establishedRunwayId).toBe(scenario.runwayId);
      });
    }
  }
});

describe('live separation practice', () => {
  it('checks actual vertical separation, not just a target or missing aircraft', () => {
    const scenario = createTutorialScenario(field, 'separation');
    const planes = scenario.planes;
    expect(isTutorialSeparationCleared(planes, scenario)).toBe(false);
    expect(hasTutorialSeparation(planes, scenario)).toBe(false);
    planes[0] = applyClearance(planes[0], { targetAltitude: 5000 });
    expect(isTutorialSeparationCleared(planes, scenario)).toBe(true);
    expect(hasTutorialSeparation(planes, scenario)).toBe(false);
    planes[0] = { ...planes[0], altitude: 5000 };
    expect(hasTutorialSeparation(planes, scenario)).toBe(true);
    expect(hasTutorialSeparation([planes[0]], scenario)).toBe(false);
    expect(hasTutorialSeparation([{ ...planes[0], status: 'crashed' }, planes[1]], scenario)).toBe(false);
    expect(hasTutorialSeparation([{ ...planes[0], markedForRemoval: true }, planes[1]], scenario)).toBe(false);
  });

  for (const airport of AIRPORTS) {
    for (const gameSpeed of [1, 'real'] as GameSpeed[]) {
      it(`lets the commanded climb protect converging traffic at ${airport.icao} (${gameSpeed})`, () => {
        const scenario = createTutorialScenario(airport, 'separation');
        let planes = scenario.planes.map((plane, index) => index === 0
          ? applyClearance(plane, { targetAltitude: 5000 })
          : plane);
        expect(isTutorialSeparationCleared(planes, scenario)).toBe(true);
        let hadActualSeparation = false;
        let closestDistance = Infinity;
        const ticks = gameSpeed === 'real' ? 1800 : 400;
        for (let tick = 0; tick < ticks; tick++) {
          planes = planes.map(p => advancePlane(p, airport, scenario.runwayConfig, 0.4, gameSpeed).plane);
          const separation = applySeparation(planes);
          expect(separation.collisions).toBe(0);
          expect(separation.warning).toBe(false);
          hadActualSeparation ||= hasTutorialSeparation(planes, scenario);
          closestDistance = Math.min(closestDistance, Math.hypot(planes[0].x - planes[1].x, planes[0].y - planes[1].y));
          expect(planes.some(p => p.isEstablished)).toBe(false);
        }
        expect(hadActualSeparation).toBe(true);
        expect(closestDistance).toBeLessThan(20);
      });
    }
  }

  it('really converges into a live warning if the altitude clearance is omitted', () => {
    const scenario = createTutorialScenario(field, 'separation');
    let planes = scenario.planes;
    let warning = false;
    for (let tick = 0; tick < 280; tick++) {
      planes = planes.map(p => advancePlane(p, field, scenario.runwayConfig, 0.4, 1).plane);
      const separation = applySeparation(planes);
      warning ||= separation.warning;
      expect(separation.collisions).toBe(0);
    }
    expect(warning).toBe(true);
    expect(hasTutorialSeparation(planes, scenario)).toBe(false);
  });
});
