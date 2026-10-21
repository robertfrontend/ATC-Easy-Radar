import { describe, expect, it } from 'vitest';
import { field } from '../test/field';
import {
  arrivalInwardHeading,
  createRadarDomain,
  DEFAULT_RADAR_DOMAIN,
  domainExtent,
  sampleArrivalPerimeter,
  squareExtent,
} from './radarBounds';

describe('frozen rectangular radar domain geometry', () => {
  it.each([
    [1, 600, 600], [2, 1200, 600], [0.5, 600, 1200], [4, 2400, 600],
  ])('expands aspect %s without shrinking either axis', (aspect, halfWidth, halfHeight) => {
    expect(createRadarDomain(aspect)).toEqual({ halfWidth, halfHeight });
  });

  it('accepts an explicit initial camera half-span without changing legacy defaults', () => {
    expect(createRadarDomain(2, 700)).toEqual({ halfWidth: 1400, halfHeight: 700 });
    expect(createRadarDomain(0.5, 700)).toEqual({ halfWidth: 700, halfHeight: 1400 });
    expect(createRadarDomain()).toEqual({ halfWidth: 600, halfHeight: 600 });
    expect(sampleArrivalPerimeter(field, createRadarDomain(2, 700), 0)).toEqual({ x: field.x - 1380, y: field.y - 680 });
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('falls back to the square for invalid aspect %s', aspect => {
    expect(createRadarDomain(aspect)).toEqual(DEFAULT_RADAR_DOMAIN);
  });

  it('preserves canonical square units and exact old thresholds', () => {
    for (const dx of [-2500, -600, 0, 600, 2500]) {
      for (const dy of [-2500, -600, 0, 600, 2500]) {
        const position = { x: field.x + dx, y: field.y + dy };
        expect(domainExtent(position, field)).toBe(squareExtent(position, field));
      }
    }
  });

  it.each([2, 0.5])('scales thresholds around a translated airport for aspect %s', aspect => {
    const domain = createRadarDomain(aspect);
    const center = { x: -9000, y: 4300 };
    for (const extent of [599.9, 600, 600.1, 2499.9, 2500, 2500.1]) {
      const position = { x: center.x - extent * domain.halfWidth / 600, y: center.y + extent * domain.halfHeight / 600 };
      expect(domainExtent(position, center, domain)).toBeCloseTo(extent, 9);
    }
  });
});

describe('uniform arrival intake perimeter', () => {
  it('hits every square corner and edge midpoint in clockwise order', () => {
    const expected = [[-580, -580], [0, -580], [580, -580], [580, 0], [580, 580], [0, 580], [-580, 580], [-580, 0], [-580, -580]];
    expected.forEach(([dx, dy], index) => {
      expect(sampleArrivalPerimeter(field, DEFAULT_RADAR_DOMAIN, index / 8)).toEqual({ x: field.x + dx, y: field.y + dy });
    });
  });

  it.each([1, 2, 0.5, 8])('weights edges by length, not by edge count, at aspect %s', aspect => {
    const domain = createRadarDomain(aspect);
    const width = domain.halfWidth - 20;
    const height = domain.halfHeight - 20;
    const perimeter = 4 * (width + height);
    const counts = { horizontal: 0, vertical: 0 };
    const samples = 20000;
    for (let i = 0; i < samples; i++) {
      const point = sampleArrivalPerimeter(field, domain, (i + 0.5) / samples);
      const dx = Math.abs(point.x - field.x);
      const dy = Math.abs(point.y - field.y);
      expect(dx).toBeLessThanOrEqual(width + 1e-9);
      expect(dy).toBeLessThanOrEqual(height + 1e-9);
      expect(Math.min(Math.abs(dx - width), Math.abs(dy - height))).toBeLessThan(1e-8);
      if (Math.abs(dy - height) < 1e-8) counts.horizontal++;
      else counts.vertical++;
    }
    expect(counts.horizontal / samples).toBeCloseTo(4 * width / perimeter, 3);
    expect(counts.vertical / samples).toBeCloseTo(4 * height / perimeter, 3);
  });

  it('uses airport-relative coordinates and reaches outside the former circular intake', () => {
    const center = { x: -2000, y: 7000 };
    const domain = createRadarDomain(3);
    const point = sampleArrivalPerimeter(center, domain, 0);
    expect(point).toEqual({ x: -3780, y: 6420 });
    expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeGreaterThan(580);
    expect(domainExtent(point, center, domain)).toBeLessThan(600);
  });
});

describe('inward arrival headings', () => {
  it.each([1, 2, 0.5, 20, 0.05])('points strictly inward on every sampled edge/corner at aspect %s', aspect => {
    const domain = createRadarDomain(aspect);
    const width = domain.halfWidth - 20;
    const height = domain.halfHeight - 20;
    const perimeter = 4 * (width + height);
    const cornerSamples = [0, 2 * width / perimeter, (2 * width + 2 * height) / perimeter, (4 * width + 2 * height) / perimeter];
    for (const sample of [...cornerSamples, ...Array.from({ length: 100 }, (_, i) => i / 100)]) {
      const point = sampleArrivalPerimeter(field, domain, sample);
      for (const jitter of [0, 0.5, 1]) {
        const heading = arrivalInwardHeading(point, field, domain, jitter);
        expect(heading).toBeGreaterThanOrEqual(0);
        expect(heading).toBeLessThan(360);
        const vx = Math.sin(heading * Math.PI / 180);
        const vy = -Math.cos(heading * Math.PI / 180);
        const dx = point.x - field.x;
        const dy = point.y - field.y;
        if (Math.abs(Math.abs(dx) - width) < 1e-7) expect(vx * Math.sign(dx)).toBeLessThan(0);
        if (Math.abs(Math.abs(dy) - height) < 1e-7) expect(vy * Math.sign(dy)).toBeLessThan(0);
      }
    }
  });

  it('retains ordinary center bearing and ±30 degree jitter when already inward', () => {
    const point = { x: field.x, y: field.y - 580 };
    expect(arrivalInwardHeading(point, field, DEFAULT_RADAR_DOMAIN, 0)).toBeCloseTo(150);
    expect(arrivalInwardHeading(point, field, DEFAULT_RADAR_DOMAIN, 0.5)).toBeCloseTo(180);
    expect(arrivalInwardHeading(point, field, DEFAULT_RADAR_DOMAIN, 1)).toBeCloseTo(210);
  });
});
