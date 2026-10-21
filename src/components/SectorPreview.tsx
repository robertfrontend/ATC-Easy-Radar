import { useId } from 'react';
import type { AIRPORTS } from '../config/airports';
import type { RunwayConfig } from '../types';
import { scopeColor } from '../theme/radarTheme';

interface SectorPreviewProps {
  airport: (typeof AIRPORTS)[number];
  runwayConfig: RunwayConfig;
  compact?: boolean;
}

/** Static airport geometry only: no game loop, traffic simulation or animation. */
export function SectorPreview({ airport, runwayConfig, compact = false }: SectorPreviewProps) {
  const previewId = useId();
  const landingRunways = airport.runways.filter(runway => runwayConfig[runway.id]?.landing);
  const departureRunways = airport.runways.filter(runway => runwayConfig[runway.id]?.departure);

  return (
    <div className={`bg-panel border border-line rounded-lg p-4 space-y-3 ${compact ? 'w-full max-w-xs justify-self-center md:justify-self-end' : ''}`}>
      <div className="flex flex-wrap gap-2 items-center justify-between pb-2 border-b border-line text-xs">
        <span className="font-bold text-ink uppercase tracking-widest flex items-center gap-2">
          <span className="text-phosphor">◉</span> Static sector preview
        </span>
        <span className="text-phosphor font-bold">{airport.icao} / {airport.name}</span>
      </div>

      {/* Mini SVG Radar Display (Dynamic Multi-Runway ILS / DEP) */}
      <div className="w-full aspect-square bg-scope rounded-lg border border-line relative overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 1000 1000" role="img" aria-labelledby={`${previewId}-title`}
          aria-describedby={`${previewId}-description`} className="w-full h-full p-2">
          <title id={`${previewId}-title`}>{airport.icao} radar sector preview</title>
          <desc id={`${previewId}-description`}>Static airport layout with runways, approach guides, range rings and navigation fixes. No live traffic.</desc>
          {/* Square sector background; circles below are range guides only. */}
          <rect x="0" y="0" width="1000" height="1000" fill={scopeColor.scope} />

          {/* Range Rings */}
          <circle cx="500" cy="500" r="160" fill="none" stroke={scopeColor.phosphor} strokeDasharray="4,6" opacity="0.25" />
          <circle cx="500" cy="500" r="320" fill="none" stroke={scopeColor.phosphor} strokeDasharray="4,6" opacity="0.25" />
          <circle cx="500" cy="500" r="470" fill="none" stroke={scopeColor.phosphor} strokeDasharray="4,6" opacity="0.25" />

          {/* Airspace Boundary Polygons */}
          {airport.airspacePolygons?.map(poly => (
            <polygon
              key={poly.id}
              points={poly.points}
              fill="none"
              stroke={poly.dashed ? scopeColor.airspaceDim : scopeColor.airspace}
              strokeWidth="1.5"
              strokeDasharray={poly.dashed ? "4,6" : undefined}
            />
          ))}

          {/* Holding Stacks (Racetracks) */}
          {airport.holdingStacks?.map(stack => (
            <g key={stack.id} transform={`translate(${stack.x}, ${stack.y}) rotate(${stack.rotation})`}>
              <rect
                x={-stack.width / 2}
                y={-stack.height / 2}
                width={stack.width}
                height={stack.height}
                rx="20"
                ry="20"
                fill="none"
                stroke={scopeColor.airspace}
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="-8"
                fill={scopeColor.fixLabel}
                fontSize="16"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(${-stack.rotation}, 0, -8)`}
              >
                {stack.label}
              </text>
            </g>
          ))}

          {/* All Airport Runways with Dynamic ILS Tick Ladders & Departure Corridors */}
          {airport.runways.map(rwy => {
            const isLanding = !!runwayConfig[rwy.id]?.landing;
            const isDep = !!runwayConfig[rwy.id]?.departure;
            const rwyX = airport.x + (rwy.offsetX || 0);
            const rwyY = airport.y + (rwy.offsetY || 0);
            const rwyLength = rwy.length || 85;
            const halfLen = rwyLength / 2;

            return (
              <g key={rwy.id || rwy.label} transform={`translate(${rwyX}, ${rwyY}) rotate(${rwy.heading})`}>
                {/* ILS Tick Ladder for Active Landing Runways */}
                {isLanding && (
                  <>
                    <line x1="0" y1={halfLen} x2="0" y2="420" stroke={scopeColor.map} strokeWidth="2.5" />
                    {Array.from({ length: 10 }, (_, i) => {
                      const yPos = halfLen + (i + 1) * 36;
                      return (
                        <line key={i} x1="-12" y1={yPos} x2="12" y2={yPos} stroke={scopeColor.map} strokeWidth="1.8" />
                      );
                    })}
                    <line x1="-24" y1="420" x2="24" y2="420" stroke={scopeColor.map} strokeWidth="3" />
                  </>
                )}

                {/* Departure Line for Active Departure Runways */}
                {isDep && (
                  <line x1="0" y1={-halfLen} x2="0" y2="-380" stroke={scopeColor.mapDim} strokeWidth="2" strokeDasharray="6,6" />
                )}

                {/* Subdued gray runway bar */}
                <rect
                  x="-6"
                  y={-halfLen}
                  width="12"
                  height={rwyLength}
                  fill={isLanding || isDep ? scopeColor.runway : scopeColor.runwayIdle}
                  rx="1.5"
                />
                <line x1="0" y1={-halfLen + 4} x2="0" y2={halfLen - 4} stroke={scopeColor.centerline} strokeWidth="1.5" />
              </g>
            );
          })}

          {/* Waypoint Fixes (◎ Double Circle) */}
          {airport.waypoints.map(wp => (
            <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
              <circle cx="0" cy="0" r="7" fill="none" stroke={scopeColor.fix} strokeWidth="1.8" />
              <circle cx="0" cy="0" r="2.5" fill={scopeColor.fix} />
              <text x="12" y="5" fill={scopeColor.fixLabel} fontSize="16" fontFamily="monospace" fontWeight="bold">
                {wp.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Scope Overlay Badge */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-ink-dim">
          <span className="text-phosphor font-bold">
            ACTIVE ILS: {landingRunways.map(r => r.label).join(', ') || 'NONE'}
          </span>
          <span className="text-ink font-bold">
            DEP: {departureRunways.map(r => r.label).join(', ') || 'NONE'}
          </span>
        </div>
      </div>
    </div>
  );
}
