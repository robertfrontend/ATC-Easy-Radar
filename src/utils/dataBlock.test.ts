import assert from 'node:assert/strict';
import { AIRPORTS } from '../config/airports';
import { Plane } from '../types';
import { trackReadout } from './dataBlock';

const airport = AIRPORTS.find(a => a.id === 'london-lhr');
if (!airport) throw new Error('Heathrow fixture missing');
const ockhm = airport.waypoints.find(w => w.label === 'OCKHM');
if (!ockhm) throw new Error('OCKHM fixture missing');

function plane(overrides: Partial<Plane> = {}): Plane {
  return {
    id: '1',
    callsign: 'BAW123',
    model: 'A320',
    squawk: '1234',
    type: 'departure',
    x: airport!.x,
    y: airport!.y,
    heading: 270,
    targetHeading: 270,
    altitude: 1600,
    targetAltitude: 11000,
    speed: 160,
    targetSpeed: 240,
    trail: [],
    status: 'normal',
    isEstablished: false,
    hasInstructions: true,
    originFlag: '🇬🇧',
    targetWaypoint: null,
    exitWaypointId: ockhm!.id,
    ...overrides,
  };
}

const climbing = trackReadout(plane(), airport);
assert.equal(climbing.line1, 'BAW123');
assert.equal(climbing.line2, 'A16 ↑110');
assert.equal(climbing.line3, '160 OCKHM', 'an uncleared departure shows its exit fix');
assert.ok(climbing.line3.length <= 12, 'the exit fix stays on the existing third line');

const cleared = trackReadout(plane({ targetWaypoint: ockhm.id, altitude: 6400, speed: 220 }), airport);
assert.equal(cleared.line3, '220 OCKHM', 'a departure cleared direct still shows the exit');

const vectored = trackReadout(plane({ heading: 310, headingAssigned: true, speed: 180 }), airport);
assert.equal(vectored.line3, '180 OCKHM', 'a heading assignment does not hide the exit fix');

const arrival = trackReadout(plane({
  type: 'arrival',
  callsign: 'AAL45',
  exitWaypointId: null,
  heading: 90,
  speed: 240,
  altitude: 8000,
  targetAltitude: 8000,
}), airport);
assert.equal(arrival.line3, '240H 090');
assert.equal(arrival.line3.includes('OCKHM'), false);

const onFinal = trackReadout(plane({
  type: 'arrival',
  exitWaypointId: null,
  isEstablished: true,
  establishedRunwayId: 'egll-27l',
  speed: 155,
  altitude: 2200,
  targetAltitude: 0,
}), airport);
assert.equal(onFinal.line3, '155 ILS27L');

console.log('data block checks passed');
