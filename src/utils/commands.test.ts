import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { Plane, RunwayConfig } from '../types';
import { parseAtcCommand } from './commands';

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
    x: airport!.x,
    y: airport!.y,
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

const ctx = (plane: Plane = departure()) => ({ airport: airport!, runwayConfig, plane });

describe('command parsing', () => {
  it('parses a heading and wraps 360 back to north', () => {
    expect(parseAtcCommand('H090', ctx())?.targetHeading).toBe(90);
    expect(parseAtcCommand('h270', ctx())?.targetHeading).toBe(270);
    expect(parseAtcCommand('H 180', ctx())?.targetHeading).toBe(180);
    expect(parseAtcCommand('H360', ctx())?.targetHeading).toBe(0);
    expect(parseAtcCommand('H370', ctx())?.targetHeading).toBe(10);
    expect(parseAtcCommand('H090', ctx())?.targetWaypoint).toBeNull();
  });

  it('parses climb and descent altitudes', () => {
    expect(parseAtcCommand('C10000', ctx())?.targetAltitude).toBe(10000);
    expect(parseAtcCommand('D3000', ctx())?.targetAltitude).toBe(3000);
    expect(parseAtcCommand('C 5000', ctx())?.targetAltitude).toBe(5000);
    expect(parseAtcCommand('C10000', ctx())?.targetHeading).toBeUndefined();
  });

  it('parses a speed', () => {
    expect(parseAtcCommand('S210', ctx())?.targetSpeed).toBe(210);
    expect(parseAtcCommand('S 180', ctx())?.targetSpeed).toBe(180);
  });

  it('parses heading, altitude, and speed from one line', () => {
    const updates = parseAtcCommand('D3000 H270 S210', ctx());
    expect(updates?.targetAltitude).toBe(3000);
    expect(updates?.targetHeading).toBe(270);
    expect(updates?.targetSpeed).toBe(210);
  });

  it('clears a departure direct to its exit with DEP', () => {
    const updates = parseAtcCommand('DEP', ctx());
    expect(updates?.targetWaypoint).toBe(exitFix!.id);
    expect(updates?.targetHeading).toBeUndefined();
    expect(updates?.assignedRunwayId).toBeUndefined();
  });

  it('treats a fix name as direct-to, including lowercase', () => {
    expect(parseAtcCommand(exitFix!.label, ctx())?.targetWaypoint).toBe(exitFix!.id);
    expect(parseAtcCommand(exitFix!.label.toLowerCase(), ctx())?.targetWaypoint).toBe(exitFix!.id);
  });

  it('clears an arrival runway assignment on a direct-to', () => {
    const arrival = departure({
      type: 'arrival',
      exitWaypointId: null,
      assignedRunwayId: runway!.id,
    });
    const updates = parseAtcCommand(exitFix!.label, ctx(arrival));
    expect(updates?.targetWaypoint).toBe(exitFix!.id);
    expect(updates?.assignedRunwayId).toBeNull();
  });

  it('vectors an ILS clearance without reading the runway as a speed', () => {
    const arrival = departure({ type: 'arrival', exitWaypointId: null, altitude: 7000 });
    const updates = parseAtcCommand('ILS 33L', ctx(arrival));
    expect(updates?.assignedRunwayId).toBe(runway!.id);
    expect(updates?.targetAltitude).toBe(3000);
    expect(updates?.targetSpeed).toBe(180);
    expect(updates?.targetWaypoint).toBeNull();
    expect(typeof updates?.targetHeading).toBe('number');
  });

  it('uses the active landing runway when ILS has no number', () => {
    const updates = parseAtcCommand('ILS', ctx(departure({ type: 'arrival' })));
    expect(updates?.assignedRunwayId).toBe(runway!.id);
    expect(updates?.targetAltitude).toBe(3000);
  });

  it('rejects empty text, unknown words, a bad runway, and DEP for an arrival', () => {
    expect(parseAtcCommand('', ctx())).toBeNull();
    expect(parseAtcCommand('   ', ctx())).toBeNull();
    expect(parseAtcCommand('HOLA', ctx())).toBeNull();
    expect(parseAtcCommand('HEADING 90', ctx())).toBeNull();
    expect(parseAtcCommand('ILS 99', ctx())).toBeNull();
    expect(parseAtcCommand('DEP', ctx(departure({ type: 'arrival', exitWaypointId: null })))).toBeNull();
  });
});
