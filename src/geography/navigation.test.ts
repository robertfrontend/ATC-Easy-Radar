import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { getGeographicAirport } from './kbos';
import { approachVectorPoint, approachPoint, runwayFrame } from './navigation';
import { parseAtcCommand } from '../utils/commands';
import { trackReadout } from '../utils/dataBlock';
import { checkIlsRunway, localizerGuidance, trackFate } from '../utils/approach';
import { advancePlane } from '../utils/sim';
import { makePlane } from '../test/field';
import { predictFlightPath } from '../utils/prediction';

const airport = getGeographicAirport(AIRPORTS.find(item => item.icao === 'KBOS')!);
const runway = airport.runways.find(item => item.label === '15R')!;
const config = Object.fromEntries(airport.runways.map(item => [item.id, { landing: item.id === runway.id, departure: false }]));

it('uses magnetic external headings and true internal navigation without altering legacy commands', () => {
  const plane = makePlane({ heading: 315 });
  expect(parseAtcCommand('H330', { airport, runwayConfig: config, plane })?.targetHeading).toBe(315);
  expect(parseAtcCommand('H330', { airport: AIRPORTS[0], runwayConfig: {}, plane })?.targetHeading).toBe(330);
  expect(trackReadout(plane, airport).line3).toContain('H 330');
});

it('shares the real offset localizer axis and displaced pavement threshold', () => {
  const frame = runwayFrame(airport, runway);
  expect(frame.approachHeading).toBeCloseTo(133.56);
  expect(frame.approachHeading).not.toBe(frame.pavementHeading);
  const plane = makePlane({ ...approachPoint(airport, runway, 200), heading: frame.approachHeading, altitude: 3000, assignedRunwayId: runway.id });
  const check = checkIlsRunway(plane, airport, runway, .4);
  expect(check.alongTrack).toBeCloseTo(200);
  expect(check.crossTrack).toBeCloseTo(0);
  expect(check.ready).toBe(true);
  const near = { ...plane, ...approachPoint(airport, runway, 15) };
  const expected = (Math.atan2(frame.threshold.x - near.x, near.y - frame.threshold.y) * 180 / Math.PI + 360) % 360;
  expect(localizerGuidance(near, airport, runway.id).targetHeading).toBeCloseTo(expected);
});

it('honors the restricted left side of 33L without disabling the operative localizer', () => {
  const rwy = airport.runways[0], frame = runwayFrame(airport, rwy), angle = frame.approachHeading * Math.PI / 180;
  const at = (cross: number) => makePlane({ x: frame.approachOrigin.x - 200 * Math.sin(angle) + cross * Math.cos(angle),
    y: frame.approachOrigin.y + 200 * Math.cos(angle) + cross * Math.sin(angle), heading: frame.approachHeading, altitude: 3000 });
  expect(checkIlsRunway(at(-200 * Math.tan(35 * Math.PI / 180)), airport, rwy, 2).ready).toBe(false);
  expect(checkIlsRunway(at(200 * Math.tan(35 * Math.PI / 180)), airport, rwy, 2).ready).toBe(true);
});

it('flies the offset approach into the actual threshold and predicts the same live trajectory', () => {
  const frame = runwayFrame(airport, runway);
  let plane = makePlane({ ...approachPoint(airport, runway, 180), heading: frame.approachHeading,
    targetHeading: frame.approachHeading, assignedRunwayId: runway.id, altitude: 3000, targetAltitude: 3000, speed: 180, targetSpeed: 180 });
  const prediction = predictFlightPath(plane, airport, config, .4, 1);
  let landed = false;
  for (let tick = 0; tick < 2000; tick++) {
    plane = advancePlane(plane, airport, config, .4, 1).plane;
    const fate = trackFate(plane, airport);
    if (!fate.keep) {
      expect(fate.success).toBe(true);
      expect(Math.hypot(plane.x - frame.threshold.x, plane.y - frame.threshold.y)).toBeLessThan(4);
      landed = true; break;
    }
    if (tick === 599) {
      const end = prediction.points.at(-1)!;
      expect(plane.x).toBeCloseTo(end.x); expect(plane.y).toBeCloseTo(end.y);
    }
  }
  expect(landed).toBe(true);
});

it('keeps reference-only localizers and outer context out of operational commands', () => {
  const plane = makePlane();
  for (const raw of ['ILS 22L', 'SOSYO', 'WHYBE']) expect(parseAtcCommand(raw, { airport, runwayConfig: config, plane })).toBeNull();
});

it('keeps simplified ILS vector targets inside the shared portrait core', () => {
  for (const rwy of airport.runways) {
    const point = approachVectorPoint(airport, rwy);
    expect(Math.abs(point.x - airport.x)).toBeLessThan(392);
    expect(Math.abs(point.y - airport.y)).toBeLessThan(392);
  }
});
