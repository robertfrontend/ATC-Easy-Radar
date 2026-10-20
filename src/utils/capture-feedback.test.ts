import { describe, expect, it } from 'vitest';
import { field, fieldRunways, makePlane } from '../test/field';
import { checkIlsRunway, evaluateIlsCapture, inspectIlsReadiness } from './approach';

const approachPlane = (overrides: Parameters<typeof makePlane>[0] = {}) => makePlane({
  x: field.x,
  y: field.y + 200,
  heading: 0,
  altitude: 4000,
  ...overrides,
});

describe('ILS capture feedback', () => {
  it('uses exactly the simulation capture boundaries at every difficulty', () => {
    for (const width of [0.4, 0.2, 0.12]) {
      for (const along of [20, 20.001, 200, 519.99, 520]) {
        for (const cross of [0, along * width, along * width + 0.001]) {
          for (const heading of [0, 49.99, 50, 180, 310, 310.01, 359]) {
            for (const altitude of [10000, 10000.01]) {
              const plane = approachPlane({ x: field.x + cross, y: field.y + along, heading, altitude });
              const feedback = inspectIlsReadiness(plane, field, fieldRunways, width);
              const capture = evaluateIlsCapture(plane, field, fieldRunways, width);
              expect(feedback.status === 'ready').toBe(capture.justCaptured);
            }
          }
        }
      }
    }
  });

  it('explains each actual position, altitude and heading blocker independently', () => {
    const feedback = inspectIlsReadiness(
      approachPlane({ x: field.x + 100, altitude: 11000, heading: 90 }),
      field, fieldRunways, 0.2,
    );
    expect(feedback.status).toBe('blocked');
    expect(feedback.check).toMatchObject({
      inRange: true, inCone: false, altitudeReady: false, headingReady: false, headingDifference: 90,
    });
  });

  it('respects runway offsets and headings rather than using the airport center', () => {
    const south = field.runways[1];
    const plane = approachPlane({ x: field.x + 40, y: field.y - 200, heading: 180 });
    const check = checkIlsRunway(plane, field, south, 0.12);
    expect(check.ready).toBe(true);
    expect(check.alongTrack).toBeCloseTo(200);
    expect(check.crossTrack).toBeCloseTo(0);
  });

  it('uses the first capturable runway instead of a nearby but blocked one', () => {
    const runways = { ...fieldRunways, 'rwy-18': { landing: true, departure: false } };
    const feedback = inspectIlsReadiness(
      approachPlane({ x: field.x + 40, y: field.y - 200, heading: 180 }),
      field, runways, 0.4,
    );
    expect(feedback.status).toBe('ready');
    expect(feedback.check?.runway.id).toBe('rwy-18');
  });

  it('explains an inactive assignment instead of reporting another runway as ready', () => {
    const feedback = inspectIlsReadiness(approachPlane({ assignedRunwayId: 'rwy-18' }), field, fieldRunways, 0.4);
    expect(feedback.status).toBe('unavailable');
    expect(feedback.message).toContain('Assigned runway is not active');
    expect(feedback.check).toBeUndefined();
  });

  it('explains no landing runways, departures, go-arounds, and lost tracks', () => {
    expect(inspectIlsReadiness(approachPlane(), field, {}, 0.4).message).toContain('No landing runway');
    expect(inspectIlsReadiness(approachPlane({ type: 'departure' }), field, fieldRunways, 0.4).message).toContain('arrivals only');
    expect(inspectIlsReadiness(approachPlane({ goAround: true }), field, fieldRunways, 0.4).message).toContain('Go-around active');
    expect(inspectIlsReadiness(approachPlane({ status: 'crashed', isEstablished: true }), field, fieldRunways, 0.4).status).toBe('unavailable');
  });

  it('shows established guidance separately, and does not invent a speed restriction', () => {
    const feedback = inspectIlsReadiness(
      approachPlane({ isEstablished: true, establishedRunwayId: 'rwy-36' }), field, fieldRunways, 0.4,
    );
    expect(feedback.status).toBe('established');
    expect(feedback.message).toContain('ILS 36');
    expect(inspectIlsReadiness(approachPlane({ speed: 300 }), field, fieldRunways, 0.4).status).toBe('ready');
  });
});
