type Point = { x: number; y: number };
type View = Point & { w: number; h: number };
type Readout = { line1: string; line2: string; line3: string };

/** Screen pixels for annotations only; geographic objects stay in world units. */
export function trackPresentation(point: Point, readout: Readout, view: View, projectionScale: number, nearbyIndex = 0) {
  const scale = Number.isFinite(projectionScale) && projectionScale > 0 ? projectionScale : 1;
  const inverseScale = 1 / scale;
  const labelWidth = Math.max(readout.line1.length * 7.6, readout.line2.length * 6.7, readout.line3.length * 6.7) + 4;
  const left = (view.x - point.x) * scale + 3;
  const right = (view.x + view.w - point.x) * scale - 3;
  const top = (view.y - point.y) * scale + 15;
  const bottom = (view.y + view.h - point.y) * scale - 33;
  const visible = point.x >= view.x && point.x <= view.x + view.w && point.y >= view.y && point.y <= view.y + view.h;
  // Four local quadrants reduce common small-cluster overlap without hiding labels.
  const quadrant = nearbyIndex % 4;
  const preferredX = quadrant === 1 || quadrant === 2 ? -14 - labelWidth : 14;
  const fittedX = preferredX < left ? 14 : preferredX + labelWidth > right ? -14 - labelWidth : preferredX;
  const preferredY = quadrant === 1 || quadrant === 3 ? 30 : -20;
  const fittedY = preferredY < top ? 30 : preferredY > bottom ? -20 : preferredY;
  return {
    inverseScale,
    hitRadius: 22 * inverseScale,
    symbolSize: 10,
    callsignSize: 12,
    readoutSize: 11,
    labelWidth,
    labelX: visible ? Math.max(left, Math.min(right - labelWidth, fittedX)) : 14,
    labelY: visible ? Math.max(top, Math.min(bottom, fittedY)) : -16,
  };
}

/** Enlarged overlapping targets must not let SVG paint order choose the track. */
export function nearestTrack<T extends Point>(tracks: T[], point: Point, radius: number): T | undefined {
  let nearest: T | undefined;
  let distance = radius * radius;
  for (const track of tracks) {
    const squared = (track.x - point.x) ** 2 + (track.y - point.y) ** 2;
    if (squared <= distance) {
      nearest = track;
      distance = squared;
    }
  }
  return nearest;
}

/** Keep a short screen-space heading glyph visible without moving the track or rotating its bearing. */
export function headingArrowOffset(point: Point, heading: number, view: View, inverseScale: number) {
  const angle = heading * Math.PI / 180;
  const vertices = [[0, -6], [0, -20], [-2.5, -16], [2.5, -16]];
  const xs = vertices.map(([x, y]) => x * Math.cos(angle) - y * Math.sin(angle));
  const ys = vertices.map(([x, y]) => x * Math.sin(angle) + y * Math.cos(angle));
  if (point.x < view.x || point.x > view.x + view.w || point.y < view.y || point.y > view.y + view.h) return { x: 0, y: 0 };
  const left = (view.x - point.x) / inverseScale + 0.5;
  const right = (view.x + view.w - point.x) / inverseScale - 0.5;
  const top = (view.y - point.y) / inverseScale + 0.5;
  const bottom = (view.y + view.h - point.y) / inverseScale - 0.5;
  return {
    x: Math.max(left - Math.min(...xs), Math.min(right - Math.max(...xs), 0)),
    y: Math.max(top - Math.min(...ys), Math.min(bottom - Math.max(...ys), 0)),
  };
}
