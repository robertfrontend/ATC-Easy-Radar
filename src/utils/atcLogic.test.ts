import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { Plane, RunwayConfig } from '../types';
import { parseAtcCommand } from './commands';
import { applyClearance, resolveNavigation } from './navigation';

const airport = AIRPORTS.find(a => a.id === 'logan-int');
if (!airport) throw new Error('Logan fixture missing');

const runway = airport.runways.find(r => r.id === 'bos-33l');
const exitFix = airport.waypoints.find(w => w.id === 'WP-B1');
if (!runway || !exitFix) throw new Error('Logan runway/fix fixture missing');

const runwayConfig: RunwayConfig = {
  'bos-33l': { landing: true, departure: true },
};

function departure(overrides: Partial<Plane> = {}): Plane {
  return {
    id: 'dep1',
    callsign: 'JBU1000',
    model: 'A320',
    squawk: '1234',
    type: 'departure',
    x: airport!.x + (runway!.offsetX || 0),
    y: airport!.y + (runway!.offsetY || 0),
    heading: runway!.heading,
    targetHeading: runway!.heading,
    altitude: 800,
    targetAltitude: 11000,
    speed: 160,
    targetSpeed: 240,
    trail: [],
    status: 'normal',
    isEstablished: false,
    assignedRunwayId: runway!.id,
    hasInstructions: true,
    originFlag: '🇺🇸',
    targetWaypoint: null,
    exitWaypointId: exitFix!.id,
    headingAssigned: false,
    ...overrides,
  };
}

const headingToExit = (() => {
  const plane = departure();
  let heading = (Math.atan2(exitFix.y - plane.y, exitFix.x - plane.x) * 180 / Math.PI) + 90;
  heading = (heading + 360) % 360;
  return heading;
})();

const commandContext = (plane: Plane) => ({ airport: airport!, runwayConfig, plane });

describe('departure navigation', () => {
  it('uses an exit fix that is not on the runway heading', () => {
    expect(Math.abs(headingToExit - runway.heading)).toBeGreaterThan(5);
  });

  it.each([400, 2600, 8000])('holds runway heading at %i ft until cleared', (altitude) => {
    const nav = resolveNavigation(departure({ altitude }), airport);
    expect(nav.targetHeading).toBe(runway.heading);
    expect(nav.targetWaypoint).toBeNull();
    expect(nav.markedForRemoval).toBe(false);
  });

  it('routes DEP to the exit immediately, including below 2,500 ft', () => {
    const depClearance = parseAtcCommand('DEP', commandContext(departure()));
    expect(depClearance).not.toBeNull();
    expect(depClearance!.targetWaypoint).toBe(exitFix.id);
    expect(depClearance!.assignedRunwayId).toBeUndefined();

    const cleared = applyClearance(departure({ altitude: 900 }), depClearance!);
    expect(cleared.targetWaypoint).toBe(exitFix.id);
    expect(cleared.headingAssigned).toBe(false);
    expect(cleared.assignedRunwayId).toBe(runway.id);

    const afterDep = resolveNavigation(cleared, airport);
    expect(Math.abs(afterDep.targetHeading - headingToExit)).toBeLessThan(1);

    const afterDepHigh = resolveNavigation(
      applyClearance(departure({ altitude: 6000 }), depClearance!),
      airport,
    );
    expect(Math.abs(afterDepHigh.targetHeading - headingToExit)).toBeLessThan(1);
  });

  it('follows a named fix the same way and does not override it on climb', () => {
    const named = parseAtcCommand(exitFix.label, commandContext(departure()));
    expect(named?.targetWaypoint).toBe(exitFix.id);
    const afterNamed = resolveNavigation(applyClearance(departure({ altitude: 500 }), named!), airport);
    expect(Math.abs(afterNamed.targetHeading - headingToExit)).toBeLessThan(1);
  });

  it('keeps an explicit heading during the climb', () => {
    const headingCmd = parseAtcCommand('H090', commandContext(departure()));
    expect(headingCmd?.targetHeading).toBe(90);
    expect(headingCmd?.targetWaypoint).toBeNull();
    const vectored = applyClearance(departure({ altitude: 700 }), headingCmd!);
    expect(vectored.headingAssigned).toBe(true);
    expect(resolveNavigation(vectored, airport).targetHeading).toBe(90);
  });

  it('does not cancel the runway track for an altitude-only clearance', () => {
    const climbCmd = parseAtcCommand('C10000', commandContext(departure()));
    expect(climbCmd?.targetAltitude).toBe(10000);
    expect(climbCmd?.targetHeading).toBeUndefined();
    const climbed = applyClearance(departure(), climbCmd!);
    expect(climbed.headingAssigned).toBe(false);
    expect(resolveNavigation(climbed, airport).targetHeading).toBe(runway.heading);
  });

  it('returns to runway heading when UPWIND cancels a direct', () => {
    const depClearance = parseAtcCommand('DEP', commandContext(departure()));
    const onDirect = applyClearance(departure({ altitude: 4000 }), depClearance!);
    const upwind = parseAtcCommand('UPWIND', commandContext(onDirect));
    expect(upwind?.targetHeading).toBe(runway.heading);
    expect(upwind?.targetWaypoint).toBeNull();
    const backOnRunway = applyClearance(onDirect, upwind!);
    expect(backOnRunway.headingAssigned).toBe(true);
    expect(backOnRunway.targetWaypoint).toBeNull();
    expect(resolveNavigation(backOnRunway, airport).targetHeading).toBe(runway.heading);
  });

  it('still vectors an approach clearance and does not read the runway as a speed', () => {
    const ils = parseAtcCommand('ILS 33L', commandContext(departure({
      type: 'arrival',
      exitWaypointId: null,
      altitude: 7000,
    })));
    expect(ils?.assignedRunwayId).toBe(runway.id);
    expect(ils?.targetAltitude).toBe(3000);
    expect(ils?.targetSpeed).toBe(180);
    expect(ils?.targetWaypoint).toBeNull();
    expect(typeof ils?.targetHeading).toBe('number');

    expect(parseAtcCommand('S210', commandContext(departure()))?.targetSpeed).toBe(210);
    const combined = parseAtcCommand('D3000 H270', commandContext(departure()));
    expect(combined?.targetHeading).toBe(270);
    expect(combined?.targetAltitude).toBe(3000);
  });

  it('does not treat unrecognized text as a clearance', () => {
    expect(parseAtcCommand('HOLA', commandContext(departure()))).toBeNull();
    expect(parseAtcCommand('DEP', commandContext(departure({
      type: 'arrival',
      exitWaypointId: null,
    })))).toBeNull();
  });
});
