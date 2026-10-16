import { describe, expect, it } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { parseAtcCommand } from './commands';
import { applyClearance } from './navigation';
import { integrateMotion, motionProfile } from './motion';
import { advancePlane } from './sim';
import { trackFate } from './approach';

function fly(plane: ReturnType<typeof makeDeparture>, ticks: number) {
  let current = plane;
  for (let i = 0; i < ticks; i++) {
    current = advancePlane(current, field, fieldRunways, 0.4, 1).plane;
  }
  return current;
}

describe('motion', () => {
  it('turns the short way, climbs, and accelerates one arcade tick', () => {
    const profile = motionProfile(1, false);
    const moved = integrateMotion(
      makePlane({ heading: 10, altitude: 0, speed: 135, targetHeading: 350 }),
      { heading: 350, altitude: 11000, speed: 240 },
      profile,
    );
    expect(moved.heading).toBeCloseTo(9.4);
    expect(moved.altitude).toBe(18);
    expect(moved.speed).toBeCloseTo(135.25);

    const snapped = integrateMotion(
      makePlane({ heading: 10, altitude: 10, speed: 140 }),
      { heading: 10.5, altitude: 0, speed: 140 },
      profile,
    );
    expect(snapped.heading).toBe(10.5);
    expect(snapped.altitude).toBe(0);
  });

  it('uses the slower real-mode rates, including the glideslope descent', () => {
    const cruise = motionProfile('real', false);
    const moved = integrateMotion(
      makePlane({ heading: 0, altitude: 1000, speed: 200 }),
      { heading: 90, altitude: 2000, speed: 220 },
      cruise,
    );
    expect(moved.heading).toBeCloseTo(0.15);
    expect(moved.altitude).toBe(1002);
    expect(moved.speed).toBeCloseTo(200.06);

    const onGlide = motionProfile('real', true);
    const descending = integrateMotion(
      makePlane({ altitude: 100, speed: 160 }),
      { heading: 0, altitude: 0, speed: 140 },
      onGlide,
    );
    expect(descending.altitude).toBeCloseTo(99.35);
    expect(descending.speed).toBeCloseTo(159.94);
  });
});

describe('departure climb', () => {
  it('climbs on runway heading through and beyond the initial climb', () => {
    const climbed = fly(makeDeparture(), 200);
    expect(climbed.heading).toBe(0);
    expect(climbed.targetHeading).toBe(0);
    expect(climbed.altitude).toBe(3600);
    expect(climbed.speed).toBeCloseTo(185);
    expect(climbed.targetWaypoint).toBeNull();
    expect(climbed.y).toBeLessThan(field.y);
  });

  it('turns toward the exit as soon as DEP is issued, including below 2,500 ft', () => {
    const low = makeDeparture({ altitude: 400, targetAltitude: 11000 });
    const clearance = parseAtcCommand('DEP', { airport: field, runwayConfig: fieldRunways, plane: low });
    expect(clearance?.targetWaypoint).toBe('east');
    const cleared = applyClearance(low, clearance!);
    const stepped = advancePlane(cleared, field, fieldRunways, 0.4, 1).plane;
    expect(stepped.heading).toBeCloseTo(0.6);
    expect(stepped.targetWaypoint).toBe('east');
    expect(stepped.headingAssigned).toBe(false);

    const direct = parseAtcCommand('EAST', { airport: field, runwayConfig: fieldRunways, plane: low });
    const named = advancePlane(applyClearance(low, direct!), field, fieldRunways, 0.4, 1).plane;
    expect(named.heading).toBeCloseTo(0.6);
    expect(named.targetWaypoint).toBe('east');
  });

  it('keeps an assigned heading while the departure climbs', () => {
    const clearance = parseAtcCommand('H090', {
      airport: field,
      runwayConfig: fieldRunways,
      plane: makeDeparture(),
    });
    const vectored = applyClearance(makeDeparture(), clearance!);
    expect(vectored.headingAssigned).toBe(true);
    const later = fly(vectored, 200);
    expect(later.heading).toBe(90);
    expect(later.targetWaypoint).toBeNull();
    expect(later.altitude).toBe(3600);
  });

  it('removes a departure that reaches its exit and scores the handoff', () => {
    const atExit = makeDeparture({
      x: 890,
      y: 500,
      altitude: 8000,
      targetWaypoint: 'east',
      heading: 90,
      targetHeading: 90,
    });
    const stepped = advancePlane(atExit, field, fieldRunways, 0.4, 1).plane;
    expect(stepped.markedForRemoval).toBe(true);
    expect(trackFate(stepped, field).score).toBe(true);

    const short = advancePlane(makeDeparture({
      x: 850,
      y: 500,
      altitude: 8000,
      targetWaypoint: 'east',
      heading: 90,
      targetHeading: 90,
    }), field, fieldRunways, 0.4, 1).plane;
    expect(short.markedForRemoval).toBe(false);
  });

  it('clears the conflict flag on each step so separation can reapply it', () => {
    const stepped = advancePlane(makeDeparture({ conflict: true, altitude: 3000 }), field, fieldRunways, 0.4, 1);
    expect(stepped.plane.conflict).toBe(false);
  });
});
