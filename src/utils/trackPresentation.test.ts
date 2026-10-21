import { describe, expect, it } from 'vitest';
import { nearestTrack, trackPresentation } from './trackPresentation';

const readout = { line1: 'BAW1234', line2: 'F120 ↓100', line3: '250 OCKHM' };
describe('screen-space track presentation', () => {
  it.each([[390, 700, 400], [390, 700, 1400], [1180, 650, 2600]])('keeps annotations stable at %s×%s / span %s', (width, height, span) => {
    const scale = Math.min(width, height) / span;
    const view = { x: -span, y: -span, w: width / scale, h: height / scale };
    const metrics = trackPresentation({ x: 0, y: 0 }, readout, view, scale);
    expect(metrics.inverseScale * scale).toBeCloseTo(1);
    expect(metrics.hitRadius * scale).toBeCloseTo(22);
    expect(metrics.symbolSize).toBe(10);
    expect(metrics.callsignSize).toBe(12);
    expect(metrics.readoutSize).toBe(11);
  });
  it.each([[0, 0], [390, 0], [0, 600], [390, 600]])('keeps all three label lines inside corner %s,%s', (x, y) => {
    const metrics = trackPresentation({ x, y }, readout, { x: 0, y: 0, w: 390, h: 600 }, 1);
    expect(x + metrics.labelX).toBeGreaterThanOrEqual(3);
    expect(x + metrics.labelX + metrics.labelWidth).toBeLessThanOrEqual(387);
    expect(y + metrics.labelY - 12).toBeGreaterThanOrEqual(3);
    expect(y + metrics.labelY + 30).toBeLessThanOrEqual(597);
  });
  it.each([0, NaN, Infinity])('has finite sizing before a usable measurement (%s)', scale => {
    expect(Object.values(trackPresentation({ x: 0, y: 0 }, readout, { x: -700, y: -700, w: 1400, h: 1400 }, scale)).every(Number.isFinite)).toBe(true);
  });
  it('does not pin offscreen traffic labels into the visible radar', () => {
    const metrics = trackPresentation({ x: 1000, y: 1000 }, readout, { x: 0, y: 0, w: 390, h: 600 }, 1);
    expect(metrics.labelX).toBe(14);
    expect(metrics.labelY).toBe(-16);
  });
  it('picks the nearest actual track rather than the last overlapping hit target', () => {
    const tracks = [{ id: 'near', x: 0, y: 0 }, { id: 'last', x: 15, y: 0 }];
    expect(nearestTrack(tracks, { x: 2, y: 0 }, 22)?.id).toBe('near');
    expect(nearestTrack([...tracks].reverse(), { x: 2, y: 0 }, 22)?.id).toBe('near');
    expect(nearestTrack(tracks, { x: 100, y: 0 }, 22)).toBeUndefined();
  });
});


it('stacks two to four nearby labels into distinct quadrants without changing track centers', () => {
  const view = { x: 0, y: 0, w: 1180, h: 700 };
  const centers = [{ x: 500, y: 350 }, { x: 510, y: 350 }, { x: 520, y: 350 }, { x: 530, y: 350 }];
  const original = structuredClone(centers);
  const labels = centers.map((point, index) => {
    const metrics = trackPresentation(point, readout, view, 1, index);
    return { x: point.x + metrics.labelX, y: point.y + metrics.labelY - 12, w: metrics.labelWidth, h: 42 };
  });
  for (let count = 2; count <= 4; count++) {
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = labels[i], b = labels[j];
        expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
      }
    }
  }
  expect(centers).toEqual(original);
});
