import { describe, expect, it } from 'vitest';
import { field, makeDeparture, makePlane } from '../test/field';
import { trackFate } from './approach';
import { departureLeftSector } from './departure';
import { resolveNavigation } from './navigation';

const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const discarded = { keep: false, score: false, accident: false, success: false };

describe('airport-centered square world bounds', () => {
  it.each(corners)('keeps departure corner (%s, %s) through the inclusive sector edge', (sx, sy) => {
    for (const extent of [599.99, 600]) {
      const plane = makeDeparture({ x: field.x + sx * extent, y: field.y + sy * extent });
      expect(departureLeftSector(plane, field)).toBe(false);
      expect(trackFate(plane, field).keep).toBe(true);
    }
    for (const [dx, dy] of [[600.01, 600], [600, 600.01]]) {
      const plane = makeDeparture({ x: field.x + sx * dx, y: field.y + sy * dy });
      expect(departureLeftSector(plane, field)).toBe(true);
      expect(trackFate(plane, field)).toEqual(discarded);
    }
  });

  it.each(corners)('uses the exclusive distant edge at corner (%s, %s)', (sx, sy) => {
    for (const kind of ['arrival', 'departure'] as const) {
      const plane = makePlane({ type: kind, targetWaypoint: kind === 'departure' ? 'east' : null });
      expect(trackFate({ ...plane, x: field.x + sx * 2499.99, y: field.y + sy * 2499.99 }, field).keep).toBe(true);
      for (const [dx, dy] of [[2500, 2499], [2499, 2500], [2500.01, 2500.01]]) {
        expect(trackFate({ ...plane, x: field.x + sx * dx, y: field.y + sy * dy }, field)).toEqual(discarded);
      }
    }
  });

  it.each(corners)('preserves axial thresholds (%s, %s)', (sx, sy) => {
    for (const [dx, dy] of [[sx, 0], [0, sy]]) {
      for (const [extent, left] of [[599.99, false], [600, false], [600.01, true]] as const) {
        expect(departureLeftSector(makeDeparture({ x: field.x + dx * extent, y: field.y + dy * extent }), field)).toBe(left);
      }
      for (const [extent, keep] of [[2499.99, true], [2500, false], [2500.01, false]] as const) {
        expect(trackFate(makePlane({ x: field.x + dx * extent, y: field.y + dy * extent }), field).keep).toBe(keep);
      }
    }
  });

  it.each([{ x: -8000, y: 3100 }, { x: 0, y: 0 }])('translates bounds with airport $x, $y', center => {
    const airport = { ...field, ...center };
    expect(departureLeftSector(makeDeparture({ x: center.x - 600, y: center.y + 600 }), airport)).toBe(false);
    expect(departureLeftSector(makeDeparture({ x: center.x - 600.01, y: center.y + 600 }), airport)).toBe(true);
    expect(trackFate(makePlane({ x: center.x + 2499, y: center.y - 2499 }), airport).keep).toBe(true);
    expect(trackFate(makePlane({ x: center.x + 2499, y: center.y - 2500 }), airport)).toEqual(discarded);
  });

  it('preserves arrival, cleared-direct and crashed departure sector exemptions', () => {
    const outside = { x: field.x + 601, y: field.y + 601 };
    for (const plane of [makePlane(outside), makeDeparture({ ...outside, targetWaypoint: 'east' }), makeDeparture({ ...outside, status: 'crashed' })]) {
      expect(departureLeftSector(plane, field)).toBe(false);
    }
  });

  it('accepts legacy serialized planes without migration or mutation', () => {
    const legacy = makeDeparture({ x: field.x + 590, y: field.y - 590 });
    delete legacy.headingAssigned;
    delete legacy.markedForRemoval;
    delete legacy.exitWaypointId;
    delete legacy.targetWaypoint;
    const restored = JSON.parse(JSON.stringify(legacy));
    expect(trackFate(restored, field).keep).toBe(true);
    expect(restored).toEqual(legacy);
    expect(trackFate({ ...restored, x: field.x + 601 }, field)).toEqual(discarded);
  });

  it('gives marked handoffs priority over bounds but never scores a crash or arrival', () => {
    const outside = { x: field.x + 2600, y: field.y + 2600, markedForRemoval: true };
    expect(trackFate(makeDeparture(outside), field)).toEqual({ ...discarded, score: true, success: true });
    expect(trackFate(makeDeparture({ ...outside, status: 'crashed' }), field)).toEqual(discarded);
    expect(trackFate(makePlane(outside), field)).toEqual(discarded);
  });

  it('retains the strict 35-unit direct-to handoff, including a fix in a square corner', () => {
    const airport = { ...field, waypoints: [{ id: 'corner', label: 'CORNER', x: field.x + 590, y: field.y + 590 }] };
    for (const [distance, handedOff] of [[34.99, true], [35, false], [35.01, false]] as const) {
      const plane = makeDeparture({ x: airport.waypoints[0].x - distance, y: airport.waypoints[0].y, targetWaypoint: 'corner' });
      const navigation = resolveNavigation(plane, airport);
      expect(navigation.markedForRemoval).toBe(handedOff);
      expect(trackFate({ ...plane, ...navigation }, airport)).toEqual(handedOff
        ? { ...discarded, score: true, success: true }
        : { ...discarded, keep: true });
    }
  });
});
