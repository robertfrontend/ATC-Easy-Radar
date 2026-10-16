import assert from 'node:assert/strict';
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

assert.ok(
  Math.abs(headingToExit - runway.heading) > 5,
  'fixture exit fix must not lie on the runway heading'
);

// After takeoff, and after leaving the initial climb, a departure stays on
// runway heading. The stored exit is not an active route.
for (const altitude of [400, 2600, 8000]) {
  const nav = resolveNavigation(departure({ altitude }), airport);
  assert.equal(nav.targetHeading, runway.heading, `altitude ${altitude} should hold runway heading`);
  assert.equal(nav.targetWaypoint, null);
  assert.equal(nav.markedForRemoval, false);
}

// DEP after takeoff routes to the exit immediately, including below 2,500 ft.
const depClearance = parseAtcCommand('DEP', { airport, runwayConfig, plane: departure() });
assert.ok(depClearance, 'DEP must be recognized');
assert.equal(depClearance.targetWaypoint, exitFix.id);
assert.equal(depClearance.assignedRunwayId, undefined, 'DEP keeps the departure runway for separation');

const cleared = applyClearance(departure({ altitude: 900 }), depClearance);
assert.equal(cleared.targetWaypoint, exitFix.id);
assert.equal(cleared.headingAssigned, false);
assert.equal(cleared.assignedRunwayId, runway.id);

const afterDep = resolveNavigation(cleared, airport);
assert.ok(
  Math.abs(afterDep.targetHeading - headingToExit) < 1,
  `DEP should steer toward the exit (${headingToExit}), got ${afterDep.targetHeading}`
);

// The same clearance still works once the aircraft is above the climb gate.
const afterDepHigh = resolveNavigation(
  applyClearance(departure({ altitude: 6000 }), depClearance),
  airport
);
assert.ok(Math.abs(afterDepHigh.targetHeading - headingToExit) < 1);

// Typing the fix name is the same direct-to, and it is not overridden on climb.
const named = parseAtcCommand(exitFix.label, { airport, runwayConfig, plane: departure() });
assert.equal(named?.targetWaypoint, exitFix.id);
const afterNamed = resolveNavigation(applyClearance(departure({ altitude: 500 }), named!), airport);
assert.ok(Math.abs(afterNamed.targetHeading - headingToExit) < 1);

// An explicit heading during the climb is kept; the runway track does not steal it back.
const headingCmd = parseAtcCommand('H090', { airport, runwayConfig, plane: departure() });
assert.equal(headingCmd?.targetHeading, 90);
assert.equal(headingCmd?.targetWaypoint, null);
const vectored = applyClearance(departure({ altitude: 700 }), headingCmd!);
assert.equal(vectored.headingAssigned, true);
assert.equal(resolveNavigation(vectored, airport).targetHeading, 90);

// Altitude-only clearance does not cancel the runway track.
const climbCmd = parseAtcCommand('C10000', { airport, runwayConfig, plane: departure() });
assert.equal(climbCmd?.targetAltitude, 10000);
assert.equal(climbCmd?.targetHeading, undefined);
const climbed = applyClearance(departure(), climbCmd!);
assert.equal(climbed.headingAssigned, false);
assert.equal(resolveNavigation(climbed, airport).targetHeading, runway.heading);

// UPWIND cancels a direct and returns to runway heading.
const onDirect = applyClearance(departure({ altitude: 4000 }), depClearance!);
const upwind = parseAtcCommand('UPWIND', { airport, runwayConfig, plane: onDirect });
assert.equal(upwind?.targetHeading, runway.heading);
assert.equal(upwind?.targetWaypoint, null);
const backOnRunway = applyClearance(onDirect, upwind!);
assert.equal(backOnRunway.headingAssigned, true);
assert.equal(backOnRunway.targetWaypoint, null);
assert.equal(resolveNavigation(backOnRunway, airport).targetHeading, runway.heading);

// Approach clearances still vector, and the runway number is not parsed as a speed.
const ils = parseAtcCommand('ILS 33L', {
  airport,
  runwayConfig,
  plane: departure({ type: 'arrival', exitWaypointId: null, altitude: 7000 }),
});
assert.equal(ils?.assignedRunwayId, runway.id);
assert.equal(ils?.targetAltitude, 3000);
assert.equal(ils?.targetSpeed, 180);
assert.equal(ils?.targetWaypoint, null);
assert.equal(typeof ils?.targetHeading, 'number');

assert.equal(parseAtcCommand('S210', { airport, runwayConfig, plane: departure() })?.targetSpeed, 210);
assert.equal(parseAtcCommand('D3000 H270', { airport, runwayConfig, plane: departure() })?.targetHeading, 270);
assert.equal(parseAtcCommand('D3000 H270', { airport, runwayConfig, plane: departure() })?.targetAltitude, 3000);

// Unrecognized text is not a clearance (the console still clears the field).
assert.equal(parseAtcCommand('HOLA', { airport, runwayConfig, plane: departure() }), null);
assert.equal(parseAtcCommand('DEP', {
  airport,
  runwayConfig,
  plane: departure({ type: 'arrival', exitWaypointId: null }),
}), null);

console.log('atc logic checks passed');
