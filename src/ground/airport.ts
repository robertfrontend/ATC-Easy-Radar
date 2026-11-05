import type { Point, RunwayId } from './model';

export const AIRPORT = { name: 'Willow Field', width: 1100, height: 800 };
export const GROUND_VIEW = { x: -240, y: -240, width: 1580, height: 1280 };
export const RUNWAY_WIDTH = 44;
export const AIRCRAFT_RADIUS = 21;
export const NODES: Record<string, Point> = {
  'stand-1': { x: 260, y: 720 },
  'stand-2': { x: 340, y: 720 },
  'stand-3': { x: 420, y: 720 },
  'stand-4': { x: 500, y: 720 },
  'apron-1': { x: 260, y: 650 },
  'apron-2': { x: 340, y: 650 },
  'apron-3': { x: 420, y: 650 },
  'apron-4': { x: 500, y: 650 },
  'west-south': { x: 260, y: 500 },
  'west-corner': { x: 120, y: 500 },
  'hold-09': { x: 120, y: 380 },
  'cross-36-west': { x: 520, y: 500 },
  'cross-36-east': { x: 680, y: 500 },
  'east-corner': { x: 720, y: 500 },
  'east-south': { x: 720, y: 650 },
  'hold-36': { x: 660, y: 600 },
  'exit-09': { x: 800, y: 400 },
  'exit-09-join': { x: 800, y: 500 },
  'exit-36': { x: 520, y: 180 },
  'north-corner': { x: 420, y: 180 },
  'cross-09-north': { x: 420, y: 260 },
  'cross-09-south': { x: 420, y: 380 },
  'west-join': { x: 420, y: 500 },
  'threshold-09': { x: 160, y: 320 },
  'rollout-09': { x: 800, y: 320 },
  'end-09': { x: 940, y: 320 },
  'depart-09': { x: 1400, y: 320 },
  'threshold-36': { x: 600, y: 600 },
  'rollout-36': { x: 600, y: 180 },
  'end-36': { x: 600, y: 100 },
  'depart-36': { x: 600, y: -300 },
  'approach-09': { x: -130, y: 320 },
  'decision-09': { x: 140, y: 320 },
  'circuit-09-a': { x: -20, y: 150 },
  'circuit-09-b': { x: -130, y: 150 },
  'approach-36': { x: 600, y: 930 },
  'decision-36': { x: 600, y: 620 },
  'circuit-36-a': { x: 790, y: 820 },
  'circuit-36-b': { x: 790, y: 930 },
};
export interface TaxiEdge { from: string; to: string; label: string; runway?: RunwayId }
export const EDGES: TaxiEdge[] = [
  ...[1, 2, 3, 4].map(i => ({ from: `stand-${i}`, to: `apron-${i}`, label: 'Apron' })),
  { from: 'apron-1', to: 'apron-2', label: 'A' },
  { from: 'apron-2', to: 'apron-3', label: 'A' },
  { from: 'apron-3', to: 'apron-4', label: 'A' },
  { from: 'apron-1', to: 'west-south', label: 'A' },
  { from: 'west-south', to: 'west-corner', label: 'B' },
  { from: 'west-corner', to: 'hold-09', label: 'B' },
  { from: 'west-south', to: 'west-join', label: 'C' },
  { from: 'west-join', to: 'cross-36-west', label: 'C' },
  { from: 'cross-36-west', to: 'cross-36-east', label: 'C', runway: '36' },
  { from: 'cross-36-east', to: 'east-corner', label: 'C' },
  { from: 'east-corner', to: 'east-south', label: 'D' },
  { from: 'east-south', to: 'hold-36', label: 'D' },
  { from: 'cross-36-east', to: 'exit-09-join', label: 'C' },
  { from: 'exit-09-join', to: 'exit-09', label: 'E' },
  { from: 'exit-36', to: 'north-corner', label: 'F' },
  { from: 'north-corner', to: 'cross-09-north', label: 'F' },
  { from: 'cross-09-north', to: 'cross-09-south', label: 'F', runway: '09' },
  { from: 'cross-09-south', to: 'west-join', label: 'F' },
];
export const STANDS = ['stand-1', 'stand-2', 'stand-3', 'stand-4'];
export const RUNWAYS: Record<RunwayId, {
  id: RunwayId; reciprocal: string; start: Point; end: Point; hold: string;
  approach: string; decision: string; threshold: string; rollout: string;
  exit: string; departure: string; circuit: string[];
}> = {
  '09': {
    id: '09', reciprocal: '27', start: NODES['threshold-09'], end: NODES['end-09'],
    hold: 'hold-09', approach: 'approach-09', decision: 'decision-09', threshold: 'threshold-09',
    rollout: 'rollout-09', exit: 'exit-09', departure: 'depart-09',
    circuit: ['circuit-09-a', 'circuit-09-b', 'approach-09'],
  },
  '36': {
    id: '36', reciprocal: '18', start: NODES['threshold-36'], end: NODES['end-36'],
    hold: 'hold-36', approach: 'approach-36', decision: 'decision-36', threshold: 'threshold-36',
    rollout: 'rollout-36', exit: 'exit-36', departure: 'depart-36',
    circuit: ['circuit-36-a', 'circuit-36-b', 'approach-36'],
  },
};
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function crossingBetween(from: string, to: string): RunwayId | undefined {
  return EDGES.find(e => e.from === from && e.to === to || e.to === from && e.from === to)?.runway;
}
/** Dijkstra on the authored graph, never a straight-line shortcut through grass. */
export function findRoute(from: string, to: string): string[] {
  if (!NODES[from] || !NODES[to]) return [];
  const costs = new Map([[from, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set([from]);
  while (pending.size) {
    const current = [...pending].reduce((a, b) => costs.get(a)! < costs.get(b)! ? a : b);
    pending.delete(current);
    if (current === to) {
      const result = [to];
      while (previous.has(result[0])) result.unshift(previous.get(result[0])!);
      return result;
    }
    for (const edge of EDGES) {
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next) continue;
      const cost = costs.get(current)! + distance(NODES[current], NODES[next]);
      if (cost < (costs.get(next) ?? Infinity)) {
        costs.set(next, cost);
        previous.set(next, current);
        pending.add(next);
      }
    }
  }
  return [];
}
