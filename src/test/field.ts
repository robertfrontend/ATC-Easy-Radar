import { Airport, Plane, RunwayConfig } from '../types';

/** Small field with runway 36 active. North is on the runway heading; east is not. */
export const field: Airport = {
  id: 'test-field',
  name: 'Test Field',
  icao: 'TEST',
  countryFlag: '🏳️',
  x: 500,
  y: 500,
  runways: [
    { id: 'rwy-36', label: '36', heading: 0, length: 80, offsetX: 0, offsetY: 0 },
    { id: 'rwy-18', label: '18', heading: 180, length: 80, offsetX: 40, offsetY: 0 },
  ],
  waypoints: [
    { id: 'north', label: 'NORTH', x: 500, y: 100 },
    { id: 'east', label: 'EAST', x: 900, y: 500 },
    { id: 'south', label: 'SOUTH', x: 500, y: 900 },
  ],
  airlines: [{ code: 'TST', flag: '🏳️', weight: 1, models: ['A320'] }],
};

export const fieldRunways: RunwayConfig = {
  'rwy-36': { landing: true, departure: true },
  'rwy-18': { landing: false, departure: false },
};

export function makePlane(overrides: Partial<Plane> = {}): Plane {
  return {
    id: 'plane-1',
    callsign: 'TST100',
    model: 'A320',
    squawk: '1200',
    type: 'arrival',
    x: field.x,
    y: field.y,
    heading: 0,
    targetHeading: 0,
    altitude: 8000,
    targetAltitude: 8000,
    speed: 220,
    targetSpeed: 220,
    trail: [],
    status: 'normal',
    isEstablished: false,
    establishedRunwayId: null,
    assignedRunwayId: null,
    hasInstructions: true,
    originFlag: '🏳️',
    targetWaypoint: null,
    exitWaypointId: null,
    headingAssigned: false,
    markedForRemoval: false,
    conflict: false,
    ...overrides,
  };
}

export function makeDeparture(overrides: Partial<Plane> = {}): Plane {
  return makePlane({
    type: 'departure',
    altitude: 0,
    targetAltitude: 11000,
    speed: 135,
    targetSpeed: 240,
    assignedRunwayId: 'rwy-36',
    exitWaypointId: 'east',
    hasInstructions: true,
    headingAssigned: false,
    targetWaypoint: null,
    ...overrides,
  });
}
