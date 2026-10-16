import { describe, expect, it } from 'vitest';
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

describe('data block', () => {
  it('shows the exit fix on an uncleared departure', () => {
    const climbing = trackReadout(plane(), airport);
    expect(climbing.line1).toBe('BAW123');
    expect(climbing.line2).toBe('A16 ↑110');
    expect(climbing.line3).toBe('160 OCKHM');
    expect(climbing.line3.length).toBeLessThanOrEqual(12);
  });

  it('keeps the exit after a direct clearance', () => {
    const cleared = trackReadout(plane({ targetWaypoint: ockhm.id, altitude: 6400, speed: 220 }), airport);
    expect(cleared.line3).toBe('220 OCKHM');
  });

  it('keeps the exit after a heading assignment', () => {
    const vectored = trackReadout(plane({ heading: 310, headingAssigned: true, speed: 180 }), airport);
    expect(vectored.line3).toBe('180 OCKHM');
  });

  it('shows heading for an arrival and does not borrow a departure fix', () => {
    const arrival = trackReadout(plane({
      type: 'arrival',
      callsign: 'AAL45',
      exitWaypointId: null,
      heading: 90,
      speed: 240,
      altitude: 8000,
      targetAltitude: 8000,
    }), airport);
    expect(arrival.line3).toBe('240H 090');
    expect(arrival.line3.includes('OCKHM')).toBe(false);
  });

  it('shows the localizer on final', () => {
    const onFinal = trackReadout(plane({
      type: 'arrival',
      exitWaypointId: null,
      isEstablished: true,
      establishedRunwayId: 'egll-27l',
      speed: 155,
      altitude: 2200,
      targetAltitude: 0,
    }), airport);
    expect(onFinal.line3).toBe('155 ILS27L');
  });
});
