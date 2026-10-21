type Point = { x: number; y: number };
type View = Point & { w: number; h: number };
type Readout = { line1: string; line2: string; line3: string };

/** Screen pixels for annotations only; geographic objects stay in world units. */
export function trackPresentation(point: Point, readout: Readout, view: View, projectionScale: number) {
  const scale = Number.isFinite(projectionScale) && projectionScale > 0 ? projectionScale : 1;
  const inverseScale = 1 / scale;
  const labelWidth = Math.max(readout.line1.length * 7.6, readout.line2.length * 6.7, readout.line3.length * 6.7) + 4;
  const left = (view.x - point.x) * scale + 3;
  const right = (view.x + view.w - point.x) * scale - 3;
  const top = (view.y - point.y) * scale + 15;
  const bottom = (view.y + view.h - point.y) * scale - 33;
  const visible = point.x >= view.x && point.x <= view.x + view.w && point.y >= view.y && point.y <= view.y + view.h;
  const preferredX = 14 + labelWidth > right ? -14 - labelWidth : 14;
  const preferredY = -16 < top ? 26 : -16;
  return {
    inverseScale,
    hitRadius: 22 * inverseScale,
    symbolSize: 10,
    callsignSize: 12,
    readoutSize: 11,
    labelWidth,
    labelX: visible ? Math.max(left, Math.min(right - labelWidth, preferredX)) : 14,
    labelY: visible ? Math.max(top, Math.min(bottom, preferredY)) : -16,
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
