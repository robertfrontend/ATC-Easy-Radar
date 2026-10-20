import { describe, expect, it } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { GameSpeed } from '../types';
import { advancePlane } from './sim';
import { predictFlightPath } from './prediction';

describe('flight-path prediction', () => {
  it.each<GameSpeed>(['real', 0.5, 1, 2, 4])('matches actual simulation steps at %s speed', gameSpeed => {
    const original = makePlane({
      x: field.x + 700, y: field.y + 700, heading: 340, targetHeading: 45,
      speed: 200, targetSpeed: 250, targetAltitude: 10000, goAround: true,
    });
    const prediction = predictFlightPath(original, field, fieldRunways, 0.2, gameSpeed, 10);
    let expected = original;
    const ticks = Math.round(10 / (0.05 / (gameSpeed === 'real' ? 1 : gameSpeed)));
    for (let i = 0; i < ticks; i++) expected = advancePlane(expected, field, fieldRunways, 0.2, gameSpeed).plane;
    expect(prediction.ended).toBe(false);
    expect(prediction.seconds).toBeCloseTo(10);
    expect(prediction.points.at(-1)).toMatchObject({
      x: expected.x, y: expected.y, heading: expected.heading,
      altitude: expected.altitude, speed: expected.speed, isEstablished: expected.isEstablished,
    });
  });

  it('draws a turn and acceleration rather than instantly following the assigned vector', () => {
    const plane = makePlane({ x: field.x + 700, y: field.y + 700, targetHeading: 90, speed: 180, targetSpeed: 250 });
    const prediction = predictFlightPath(plane, field, fieldRunways, 0.4, 1, 2);
    const early = prediction.points[1];
    expect(early.heading).toBeCloseTo(12);
    expect(early.heading).toBeLessThan(plane.targetHeading);
    expect(early.speed).toBe(185);
    expect(early.x).toBeGreaterThan(plane.x);
    expect(early.y).toBeLessThan(plane.y);
  });

  it('follows direct-to navigation and finishes at the departure handoff', () => {
    const plane = makeDeparture({
      x: 850, y: 500, altitude: 8000, targetAltitude: 8000,
      heading: 90, targetHeading: 90, speed: 220, targetSpeed: 220, targetWaypoint: 'east',
    });
    const prediction = predictFlightPath(plane, field, fieldRunways, 0.4, 1);
    expect(prediction.ended).toBe(true);
    expect(prediction.seconds).toBeLessThan(30);
    expect(prediction.points.at(-1)!.x).toBeGreaterThan(865);
    expect(prediction.points.at(-1)!.x).toBeLessThan(900);
  });

  it('captures the ILS and ends at landing instead of extending through the runway', () => {
    const plane = makePlane({
      x: field.x, y: field.y + 100, heading: 0, targetHeading: 0,
      speed: 180, targetSpeed: 180, altitude: 3000, targetAltitude: 3000,
    });
    const prediction = predictFlightPath(plane, field, fieldRunways, 0.4, 1);
    expect(prediction.points.some(point => point.isEstablished)).toBe(true);
    expect(prediction.ended).toBe(true);
    expect(prediction.seconds).toBeLessThan(30);
    expect(prediction.points.at(-1)!.y).toBeGreaterThan(field.y);
    expect(prediction.points.at(-1)!.y).toBeLessThan(field.y + 30);
  });

  it('does not predict a lost or removed track', () => {
    for (const plane of [makePlane({ status: 'crashed' }), makePlane({ markedForRemoval: true })]) {
      expect(predictFlightPath(plane, field, fieldRunways, 0.4, 4)).toMatchObject({ seconds: 0, ended: true });
      expect(predictFlightPath(plane, field, fieldRunways, 0.4, 4).points).toHaveLength(1);
    }
  });

  it('does not mutate live data or include traffic conflicts in the forecast', () => {
    const plane = makePlane({
      x: field.x + 700, y: field.y + 700,
      trail: [{ x: 1180, y: 1200 }], conflict: true, status: 'warning',
    });
    const before = structuredClone(plane);
    const prediction = predictFlightPath(plane, field, fieldRunways, 0.4, 1);
    expect(plane).toEqual(before);
    expect(prediction.points[0]).not.toHaveProperty('conflict');
  });

  it('keeps one sample per running second and includes the final partial second', () => {
    const plane = makePlane({ x: field.x + 800, y: field.y + 800 });
    const prediction = predictFlightPath(plane, field, fieldRunways, 0.4, 4, 2.5);
    expect(prediction.points.map(point => point.seconds)).toEqual([0, 1, 2, 2.5]);
    expect(predictFlightPath(plane, field, fieldRunways, 0.4, 1, 0).points).toHaveLength(1);
  });
});
