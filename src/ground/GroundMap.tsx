import { GROUND_VIEW, EDGES, NODES, RUNWAYS, RUNWAY_WIDTH, STANDS } from './airport';
import type { Aircraft, GroundState, Point } from './model';
import { runwayOccupancy } from './simulation';
import { useEffect, useRef, useState } from 'react';
import { groundTrackPresentation } from './presentation';
import { scopeColor } from '../theme/radarTheme';
import { nearestTrack } from '../utils/trackPresentation';

const pointString = (points: Point[]) => points.map(point => `${point.x},${point.y}`).join(' ');
const runwayEntries = Object.values(RUNWAYS);
const holdPoints = ['hold-09', 'hold-36', 'cross-36-west', 'cross-36-east', 'cross-09-north', 'cross-09-south'];

function Runway({ runway, occupied, reserved }: {
  runway: typeof runwayEntries[number]; occupied: string[]; reserved: boolean;
}) {
  const length = Math.hypot(runway.end.x - runway.start.x, runway.end.y - runway.start.y);
  const angle = Math.atan2(runway.end.y - runway.start.y, runway.end.x - runway.start.x) * 180 / Math.PI;
  return <g data-runway={runway.id} transform={`translate(${runway.start.x} ${runway.start.y}) rotate(${angle})`}>
    <title>{`Runway ${runway.id}/${runway.reciprocal}: ${occupied.length ? `occupied by ${occupied.join(', ')}` : reserved ? 'reserved' : 'clear'}`}</title>
    <rect x={-20} y={-RUNWAY_WIDTH / 2 - 5} width={length + 40} height={RUNWAY_WIDTH + 10} rx={3} fill="#89918a" />
    <rect x={-18} y={-RUNWAY_WIDTH / 2} width={length + 36} height={RUNWAY_WIDTH} fill="#262e31" />
    <line x1={60} y1={0} x2={length - 60} y2={0} stroke="#f5f7f5" strokeWidth={2} strokeDasharray="22 16" />
    {[8, 14, 20, 26].map(offset => <g key={offset} fill="#f5f7f5">
      <rect x={offset} y={-18} width={3} height={12} /><rect x={offset} y={6} width={3} height={12} />
      <rect x={length - offset - 3} y={-18} width={3} height={12} /><rect x={length - offset - 3} y={6} width={3} height={12} />
    </g>)}
    <text x={45} y={5} textAnchor="middle" className="ground-runway-number">{runway.id}</text>
    <text x={length - 45} y={5} textAnchor="middle" className="ground-runway-number" transform={`rotate(180 ${length - 45} 0)`}>{runway.reciprocal}</text>
    {reserved && <rect x={-22} y={-RUNWAY_WIDTH / 2 - 9} width={length + 44} height={RUNWAY_WIDTH + 18} rx={4} fill="none" stroke="#e8c56a" strokeWidth={2} strokeDasharray="9 7" />}
  </g>;
}

function AircraftSymbol({ aircraft, selected, onSelect, scale, nearbyIndex, clusterSize }: {
  aircraft: Aircraft; selected: boolean; onSelect: (id: string) => void;
  scale: number; nearbyIndex: number; clusterSize: number;
}) {
  const metrics = groundTrackPresentation(aircraft, scale, nearbyIndex, clusterSize);
  const color = selected ? scopeColor.selected : aircraft.blocked ? scopeColor.alert : aircraft.kind === 'arrival' ? scopeColor.arrival : scopeColor.departure;
  return <g role="button" tabIndex={0} aria-label={`Select ${aircraft.id}`} aria-pressed={selected}
    data-aircraft-id={aircraft.id} data-aircraft-kind={aircraft.kind} data-aircraft-phase={aircraft.phase}
    transform={`translate(${aircraft.position.x} ${aircraft.position.y})`}
    className="ground-aircraft ground-radar-track" onClick={() => onSelect(aircraft.id)}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(aircraft.id); } }}>
    <title>{`${aircraft.id}: ${metrics.readout.line2}. ${aircraft.destination}`}</title>
    <circle data-ground-track-hit r={metrics.hitRadius} fill="transparent" />
    <g data-track-annotation data-inverse-scale={metrics.inverseScale} transform={`scale(${metrics.inverseScale})`}>
      {selected && <circle data-ground-track-selection="true" r={16} fill={scopeColor.selectedSoft} stroke={color} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />}
      <text data-ground-radar-target="true" x={0} y={3.5} fill={color} fontSize={metrics.symbolSize} fontFamily="monospace" fontWeight="bold" textAnchor="middle" className="symbol-glow">✳</text>
      {metrics.heading !== null && <g data-ground-heading-arrow transform={`rotate(${metrics.heading})`} pointerEvents="none">
        <path d="M0 -6V-20 M-2.5 -16L0 -20L2.5 -16" fill="none" stroke={color} strokeWidth={.85} strokeLinecap="round" strokeLinejoin="round" />
      </g>}
      <line x1={metrics.labelX > 0 ? 5 : -5} y1={metrics.labelY > 0 ? 5 : -5}
        x2={metrics.labelX} y2={metrics.labelY} stroke={color} strokeWidth={1} strokeDasharray="2 2" opacity={.65} pointerEvents="none" />
      <g data-ground-track-block transform={`translate(${metrics.labelX} ${metrics.labelY})`} className="ground-track-block">
        {[metrics.readout.line1, metrics.readout.line2, metrics.readout.line3].map((line, index) =>
          <text key={index} x={0} y={index * 14} fill={color} stroke="#000000" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke"
            fontSize={index === 0 ? metrics.callsignSize : metrics.readoutSize} fontFamily="monospace" fontWeight="bold">{line}</text>)}
      </g>
      {aircraft.blocked && <text data-ground-track-warning="true" x={-14} y={-12} fill={color} stroke="#000000" strokeWidth={3} paintOrder="stroke" fontSize={15}>!</text>}
    </g>
  </g>;
}

export function GroundMap({ state, selectedId, onSelect }: {
  state: GroundState; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const next = svg.getScreenCTM?.()?.a;
      if (next && Number.isFinite(next) && next > 0) setScale(current => Math.abs(current - next) > .001 ? next : current);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const selected = state.aircraft.find(aircraft => aircraft.id === selectedId);
  const occupancy = runwayOccupancy(state);
  const remainingRoute = selected ? [selected.position, ...selected.route.slice(selected.routeIndex).map(id => NODES[id]).filter(Boolean)] : [];
  return <svg ref={svgRef} className="ground-map" viewBox={`${GROUND_VIEW.x} ${GROUND_VIEW.y} ${GROUND_VIEW.width} ${GROUND_VIEW.height}`} aria-label="Willow Field airport map"
    onClickCapture={event => {
      if (event.detail === 0 || !(event.target instanceof Element) || !event.target.hasAttribute('data-ground-track-hit')) return;
      const matrix = event.currentTarget.getScreenCTM?.();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const track = nearestTrack(state.aircraft.map(aircraft => ({ id: aircraft.id, ...aircraft.position })), point, 22 / scale);
      if (track) { event.stopPropagation(); onSelect(track.id); }
    }}>
    <title>Willow Field: two intersecting runways and connected taxiways</title>
    <desc>Select an aircraft here or in the flight list. Dashed blue lines show its cleared route. Double hold bars require a separate runway clearance.</desc>
    <defs>
      <pattern id="ground-grass" width={48} height={48} patternUnits="userSpaceOnUse">
        <rect width={48} height={48} fill="#314d3c" />
        <path d="M 5 12 l 3 -3 M 30 37 l 3 -3" stroke="#3a5744" strokeWidth={1} />
      </pattern>
      <pattern id="ground-shared" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={8} stroke="#e8c56a" strokeWidth={2} />
      </pattern>
    </defs>
    <rect x={GROUND_VIEW.x} y={GROUND_VIEW.y} width={GROUND_VIEW.width} height={GROUND_VIEW.height} fill="url(#ground-grass)" />
    <rect x={215} y={623} width={330} height={126} rx={20} fill="#626b68" />
    {EDGES.map(edge => <g key={`${edge.from}-${edge.to}`} data-taxi-pavement="true">
      <line x1={NODES[edge.from].x} y1={NODES[edge.from].y} x2={NODES[edge.to].x} y2={NODES[edge.to].y}
        stroke="#626b68" strokeWidth={35} strokeLinecap="round" />
    </g>)}
    {runwayEntries.map(runway => <g key={runway.id}>
      <polyline points={pointString([NODES[runway.hold], NODES[runway.threshold]])} stroke="#626b68" fill="none" strokeWidth={35} />
      <polyline points={pointString([NODES[runway.rollout], NODES[runway.exit]])} stroke="#626b68" fill="none" strokeWidth={35} />
    </g>)}
    {runwayEntries.map(runway => <Runway key={runway.id} runway={runway} occupied={occupancy[runway.id]} reserved={!!state.reservation} />)}
    <rect x={578} y={298} width={44} height={44} fill={state.reservation ? 'url(#ground-shared)' : '#e8c56a15'} />
    <g className="ground-map-caption"><text x={647} y={275}>Shared intersection</text><path d="M 635 278 L 620 298" stroke="#f5f7f5" fill="none" /></g>
    {holdPoints.map(id => {
      const point = NODES[id];
      const runway = runwayEntries.find(candidate => candidate.hold === id);
      const angle = runway ? Math.atan2(runway.start.y - point.y, runway.start.x - point.x) * 180 / Math.PI
        : id.startsWith('cross-36') ? 0 : 90;
      return <g key={id} data-hold-point={id} transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
        <path d="M -4 -19 V 19 M 2 -19 V 19" stroke="#f5f7f5" strokeWidth={2.5} />
        <path d="M 8 -19 V 19 M 14 -19 V 19" stroke="#f5f7f5" strokeWidth={2} strokeDasharray="4 3" />
      </g>;
    })}
    {STANDS.map((id, index) => <g key={id} data-boarding-gate={id} transform={`translate(${NODES[id].x} ${NODES[id].y})`}>
      <path d="M -23 -24 V 22 H 23 V -24" fill="none" stroke="#becbc8" strokeWidth={1.5} />
      <path d="M 12 18 V 46" fill="none" stroke="#c4cecb" strokeWidth={7} />
      <path d="M 12 18 V 46" fill="none" stroke="#758884" strokeWidth={2} />
      <text x={-8} y={40} textAnchor="middle" className="ground-map-caption">Gate {index + 1}</text>
    </g>)}
    <rect x={215} y={766} width={330} height={30} rx={3} fill="#182c28" stroke="#7f9990" />
    <text x={380} y={786} textAnchor="middle" className="ground-map-caption">Willow Field terminal</text>
    <g transform="translate(1000 125)" className="ground-map-caption"><path d="M 0 20 V -20 M -7 -12 L 0 -22 L 7 -12" fill="none" stroke="#f5f7f5" strokeWidth={2} /><text y={-32} textAnchor="middle">N</text></g>
    {remainingRoute.length > 1 && <polyline data-selected-route="true" points={pointString(remainingRoute)} fill="none" stroke="#b2e5ff" strokeWidth={4} strokeDasharray="9 6" strokeLinejoin="round" />}
    {state.aircraft.map((aircraft, index) => {
      const closeTo = (other: Aircraft) => Math.hypot(other.position.x - aircraft.position.x, other.position.y - aircraft.position.y) * scale < 115;
      const nearbyIndex = state.aircraft.slice(0, index).filter(closeTo).length;
      return <AircraftSymbol key={aircraft.id} aircraft={aircraft} selected={aircraft.id === selectedId} onSelect={onSelect}
        scale={scale} nearbyIndex={nearbyIndex} clusterSize={state.aircraft.filter(closeTo).length} />;
    })}
  </svg>;
}
