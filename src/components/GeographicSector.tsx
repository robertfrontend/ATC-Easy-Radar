import { memo, useId, useMemo } from 'react';
import type { GeographicAirport, AirportGeography, LocalizerReference, WorldPoint } from '../geography/types';
import type { AirportTerrainMap } from '../geography/map-types';
import type { RunwayConfig } from '../types';
import { scopeColor } from '../theme/radarTheme';
import { approachPoint } from '../geography/navigation';

/** Presentation length only; this is not a service volume, capture limit or published fix. */
export function localizerGuideEnd(localizer: LocalizerReference): WorldPoint {
  const bearing = localizer.trueCourse * Math.PI / 180;
  const length = localizer.illustrativeLengthNM * 22.4;
  return { x: localizer.antenna.x - Math.sin(bearing) * length, y: localizer.antenna.y + Math.cos(bearing) * length };
}

/** Keep source points fixed while placing their annotations inside the visible frame. */
export function referenceLabelSide(point: WorldPoint, label: string, view: { x: number; w: number }, scale: number) {
  return point.x + (label.length * 6.3 + 8) * scale > view.x + view.w - 4 * scale
    ? { x: -8, anchor: 'end' as const } : { x: 8, anchor: 'start' as const };
}

type SectorView = { x: number; y: number; w: number; h: number };
type CaptionOffset = { x: number; y: number; anchor: 'start' | 'end' };
function guidePoint(airport: GeographicAirport, localizer: LocalizerReference) {
  const runway = airport.runways.find(item => item.id === localizer.operativeRunwayId);
  return runway ? approachPoint(airport, runway, localizer.illustrativeLengthNM * 22.4) : localizerGuideEnd(localizer);
}

/** Availability controls the complete presentation, not source metadata or capture physics. */
export function activeLocalizers(airport: GeographicAirport, runwayConfig: RunwayConfig) {
  return airport.geographic?.localizers.filter(localizer => !localizer.referenceOnly &&
    !!localizer.operativeRunwayId && airport.runways.some(runway => runway.id === localizer.operativeRunwayId) &&
    runwayConfig[localizer.operativeRunwayId]?.landing === true) ?? [];
}

/** Screen-space captions move; the real fixes, runway endpoints and LOC axes never do. */
export function localizerCaptionOffsets(airport: GeographicAirport, scale: number, view: SectorView, runwayConfig: RunwayConfig): Record<string, CaptionOffset> {
  const geography = airport.geographic;
  if (!geography) return {};
  const reserved = [...airport.waypoints, ...geography.contextFixes].flatMap(fix => {
    const side = referenceLabelSide(fix, fix.label, view, scale);
    const width = fix.label.length * 6.3 * scale;
    return [{ x: fix.x + side.x * scale - (side.anchor === 'end' ? width : 0), y: fix.y - 10 * scale, w: width, h: 17 * scale },
      { x: fix.x - 5 * scale, y: fix.y - 5 * scale, w: 10 * scale, h: 10 * scale }];
  });
  const result: Record<string, CaptionOffset> = {};
  for (const localizer of activeLocalizers(airport, runwayConfig)) {
    const point = guidePoint(airport, localizer);
    const text = `ILS ${localizer.runwayEnd}${localizer.status.includes('RESTRICTED') ? '†' : ''}`;
    const width = text.length * 6.3 * scale;
    const candidates: CaptionOffset[] = [
      { x: 8, y: localizer.runwayEnd === '27' ? 18 : -5, anchor: 'start' },
      { x: -8, y: -5, anchor: 'end' }, { x: 8, y: 18, anchor: 'start' },
      { x: -8, y: 18, anchor: 'end' }, { x: 8, y: -25, anchor: 'start' },
      { x: -8, y: -25, anchor: 'end' }, { x: 8, y: 36, anchor: 'start' },
    ];
    let best = candidates[0], bestScore = Infinity;
    for (const candidate of candidates) {
      const box = { x: point.x + candidate.x * scale - (candidate.anchor === 'end' ? width : 0),
        y: point.y + (candidate.y - 11) * scale, w: width, h: 14 * scale };
      const outside = box.x < view.x || box.y < view.y || box.x + box.w > view.x + view.w || box.y + box.h > view.y + view.h;
      const score = (outside ? 1e9 : 0) + reserved.reduce((sum, other) => sum +
        Math.max(0, Math.min(box.x + box.w + 3 * scale, other.x + other.w) - Math.max(box.x - 3 * scale, other.x)) *
        Math.max(0, Math.min(box.y + box.h + 3 * scale, other.y + other.h) - Math.max(box.y - 3 * scale, other.y)), 0);
      if (score < bestScore) { best = candidate; bestScore = score; }
      if (score === 0) break;
    }
    result[localizer.runwayEnd] = best;
    reserved.push({ x: point.x + best.x * scale - (best.anchor === 'end' ? width : 0),
      y: point.y + (best.y - 11) * scale, w: width, h: 14 * scale });
  }
  return result;
}

const ringPoints = (ring: WorldPoint[]) => ring.map(point => `${point.x},${point.y}`).join(' ');

export const Terrain = memo(function Terrain({ geography }: { geography: Pick<AirportGeography, 'terrain' | 'coverage'> }) {
  const id = useId();
  const paths = useMemo(() => ({
    land: geography.terrain.landPaths.join(' '),
    neighbor: geography.terrain.neighborPaths.join(' '),
    water: geography.terrain.waterPaths.join(' '),
  }), [geography]);
  return <g data-geographic-terrain="true" pointerEvents="none">
    <defs>
      <clipPath id={`${id}-land`}><polygon points={ringPoints(geography.coverage.land.worldRing)} /></clipPath>
      <clipPath id={`${id}-water`}><polygon points={ringPoints(geography.coverage.water.worldRing)} /></clipPath>
    </defs>
    {/* Unqueried territory stays on the unknown black scope, never invented ocean. */}
    <polygon points={ringPoints(geography.coverage.water.worldRing)} fill="var(--color-geographic-water)" />
    <g clipPath={`url(#${id}-land)`} fill="var(--color-geographic-land)" fillRule="evenodd">
      <path d={paths.neighbor} />
      {/* One compound fill avoids antialias seams; no municipal boundary strokes. */}
      <path d={paths.land} />
    </g>
    <path d={paths.water} clipPath={`url(#${id}-water)`} fill="var(--color-geographic-water)"
      fillRule="evenodd" stroke="var(--color-geographic-coast)" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
  </g>;
});

interface GeographicSectorProps {
  airport: GeographicAirport;
  annotationScale: number;
  view?: SectorView;
  runwayConfig: RunwayConfig;
  showFixes?: boolean;
  showLocalizers?: boolean;
  canAssignLocalizer?: boolean;
  onAssignLocalizer?: (runwayId: string, point: WorldPoint) => void;
  isPointerDragging?: () => boolean;
}
export function GeographicSector({ airport, annotationScale, view, runwayConfig, showFixes = true,
  showLocalizers = true, canAssignLocalizer = false, onAssignLocalizer, isPointerDragging }: GeographicSectorProps) {
  const geography = airport.geographic;
  const halfRange = geography?.shortestHalfRange ?? 392;
  const frame = view ?? { x: airport.x - halfRange, y: airport.y - halfRange, w: 2 * halfRange, h: 2 * halfRange };
  const captions = useMemo(() => localizerCaptionOffsets(airport, annotationScale, frame, runwayConfig),
    [airport, runwayConfig, annotationScale, frame.x, frame.y, frame.w, frame.h]);
  if (!geography) return null;
  return <g data-geographic-sector="KBOS">
    <Terrain geography={geography} />
    <g pointerEvents="none">
      {geography.physicalRunways.map(runway => <line key={runway.id} data-physical-runway={runway.id}
        x1={runway.ends[0].position.x} y1={runway.ends[0].position.y}
        x2={runway.ends[1].position.x} y2={runway.ends[1].position.y}
        stroke={scopeColor.runway} strokeWidth="2.5" vectorEffect="non-scaling-stroke">
        <title>Physical runway {runway.id}; screen width exaggerated</title>
      </line>)}
    </g>
    {showLocalizers && activeLocalizers(airport, runwayConfig).map(localizer => {
      const end = guidePoint(airport, localizer);
      const caption = captions[localizer.runwayEnd];
      const actionable = canAssignLocalizer && !!onAssignLocalizer;
      const restricted = localizer.status.includes('RESTRICTED');
      const assign = () => {
        if (actionable && localizer.operativeRunwayId) onAssignLocalizer?.(localizer.operativeRunwayId, end);
      };
      return <g key={localizer.runwayEnd} data-localizer={localizer.runwayEnd}>
        <line x1={localizer.antenna.x} y1={localizer.antenna.y} x2={end.x} y2={end.y}
          stroke={scopeColor.map} strokeWidth={1.4}
          strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <g transform={`translate(${end.x}, ${end.y}) scale(${annotationScale})`}
          data-radar-action={actionable ? 'ils-fix' : undefined} role={actionable ? 'button' : undefined}
          tabIndex={actionable ? 0 : undefined}
          aria-label={actionable ? `Transmit heading toward ILS ${localizer.runwayEnd} guide and assign runway; altitude and speed unchanged` : undefined}
          onClick={event => { if (actionable) { event.stopPropagation(); if (!isPointerDragging?.()) assign(); } }}
          onKeyDown={event => { if (actionable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); assign(); } }}
          style={{ cursor: actionable ? 'pointer' : 'default' }}>
          <title>{`ILS ${localizer.runwayEnd}: ${localizer.frequencyMHz} MHz, ${localizer.magneticCourse}° M / ${localizer.trueCourse}° T. ${localizer.status}. ${localizer.restrictions.join(' ')} Guide length illustrative, not coverage or a published approach fix.`}</title>
          {actionable && <circle r="20" fill="transparent" />}
          <text x={caption.x} y={caption.y} textAnchor={caption.anchor} fill={scopeColor.fixLabel} fontSize="10" fontFamily="monospace">
            ILS {localizer.runwayEnd}{restricted ? '†' : ''}
          </text>
        </g>
      </g>;
    })}
    {showFixes && <g pointerEvents="none">
      {geography.contextFixes.map(fix => <g key={fix.id} data-context-fix={fix.label}
        transform={`translate(${fix.x}, ${fix.y}) scale(${annotationScale})`}>
        <circle r="3" fill="none" stroke={scopeColor.fix} />
        <text x="8" y="3" fill={scopeColor.fixLabel} fontSize="10" fontFamily="monospace">{fix.label}</text>
        <title>Regional context only; not a selectable exit or clearance</title>
      </g>)}
      {geography.holdReferences.map(fix => <g key={fix.id} data-hold-reference={fix.label}
        transform={`translate(${fix.x}, ${fix.y}) scale(${annotationScale})`}>
        <text x="8" y="16" fill={scopeColor.mapLabel} fontSize="8" fontFamily="monospace">HOLD*</text>
        <title>FAA holding entry exists; no holding path or automatic hold is represented</title>
      </g>)}
    </g>}
  </g>;
}

export function GeographicNotice({ airport, runwayConfig }: { airport: GeographicAirport; runwayConfig: RunwayConfig }) {
  if (!airport.geographic) return null;
  const localizers = activeLocalizers(airport, runwayConfig);
  return <div className="shrink-0 px-3 py-1 text-[10px] leading-relaxed text-ink-dim" data-geographic-notice="true">
    <p>FAA {airport.geographic.source.effectiveDate} / MassGIS · unofficial · not for navigation</p>
    <p>Active LOC axes: illustrative lengths, not procedures or coverage.
      {localizers.some(localizer => localizer.runwayEnd === '33L') ? ' 33L† source restricted.' : ''}
      {localizers.some(localizer => localizer.runwayEnd === '15R') ? ' 15R offset.' : ''} HOLD*: existence only.</p>
    <details>
      <summary className="cursor-pointer">Map sources and limitations</summary>
      <p>{airport.geographic.source.attribution}</p>
      <p>Black outside sourced map coverage. Runway screen widths exaggerated. No ILS beam or glideslope cone.</p>
      <p>GS angles below are source references only; descent remains simplified simulation, not a published procedure.</p>
      <ul>{localizers.map(localizer => <li key={localizer.runwayEnd}>
        ILS {localizer.runwayEnd}: {localizer.frequencyMHz} MHz · {localizer.magneticCourse}° M / {localizer.trueCourse}° T · GS {localizer.glideslopeDegrees}°.
        {localizer.runwayEnd === '15R' ? ' Offset localizer.' : ''} {localizer.status}. {localizer.restrictions.join(' ')}
      </li>)}</ul>
      <p>{airport.geographic.source.notice}</p>
      {airport.geographic.source.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block underline break-all">{source.url}</a>)}
    </details>
  </div>;
}


export function TerrainMapNotice({ map }: { map?: AirportTerrainMap }) {
  if (!map) return null;
  return <div data-map-notice className="shrink-0 px-3 py-1 text-[10px] leading-relaxed text-ink-dim">
    <p>Approximate real map / synthetic navigation and airspace · not for navigation</p>
    <details>
      <summary className="cursor-pointer">Map sources and limitations</summary>
      <p>{map.source.attribution}</p>
      <p>{map.source.notice} Black outside sourced coverage. Pavement screen width exaggerated.</p>
      <p>Runway-aligned ILS controls are simplified gameplay, not verified equipment or procedures. Heading numbers retain simplified game semantics, not verified magnetic bearings.</p>
      {map.source.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block underline break-all">{source.url}</a>)}
    </details>
  </div>;
}
