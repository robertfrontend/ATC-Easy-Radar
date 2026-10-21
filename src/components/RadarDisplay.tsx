import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plane, Airport, RunwayConfig, RadarLayers, GameSpeed } from '../types';
import { audioManager } from '../utils/audio';
import { trackReadout } from '../utils/dataBlock';
import { headingArrowOffset, nearestTrack, trackPresentation } from '../utils/trackPresentation';
import { scopeColor } from '../theme/radarTheme';
import { TrackRole, trackRole } from '../theme/trackRole';
import { FlightPrediction, PREDICTION_SECONDS, predictFlightPath } from '../utils/prediction';
import { inspectIlsReadiness } from '../utils/approach';
import { RadarDomain } from '../utils/radarBounds';

interface RadarDisplayProps {
  domain?: RadarDomain;
  onViewportAspect?: (aspect: number) => void;
  airport: Airport;
  runwayConfig: RunwayConfig;
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommand?: (id: string, updates: Partial<Plane>) => void;
  layers?: RadarLayers;
  gameSpeed?: GameSpeed;
  ilsWidth?: number;
}

const DEFAULT_LAYERS: RadarLayers = {
  showRangeRings: false,
  showFixes: true,
  showVectors: true,
  showTrails: true,
  showHalos: true,
  showExtendedCenterlines: true,
};

export const DEFAULT_SPAN = 1400;

// Scale: 560 units = 25 NM -> 1 NM = 22.4 units
const UNITS_PER_NM = 22.4;
const SCOPE_RADIUS = 560;
const RANGE_RING_NM = [5, 10, 15, 20, 25];

function themeHex(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function bloomAlpha(plane: Plane, selected: boolean, now: number) {
  const conflict = plane.conflict || plane.status === 'warning' || plane.status === 'crashed';
  if (conflict) {
    const phase = (now % 450) / 450;
    const wave = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    return 0.2 + 0.8 * (1 - wave);
  }
  if (!plane.hasInstructions && !selected && !plane.isEstablished) {
    const phase = (now % 900) / 900;
    const wave = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    return 0.3 + 0.7 * (1 - wave);
  }
  return 1;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({
  airport,
  domain,
  onViewportAspect,
  runwayConfig,
  planes,
  selectedId,
  onSelect,
  onCommand,
  layers = DEFAULT_LAYERS,
  gameSpeed = 1 as GameSpeed,
  ilsWidth = 0.4,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const phosphorRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPlaneId, setHoveredPlaneId] = useState<string | null>(null);
  // The camera is a pure fit of the frozen sector, never an interactive world transform.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const aspect = viewport.width > 0 && viewport.height > 0 ? viewport.width / viewport.height : 1;
  const fitSpan = domain ? Math.max(2 * domain.halfWidth / Math.max(1, aspect), 2 * domain.halfHeight / Math.max(1, 1 / aspect)) : DEFAULT_SPAN;
  const viewWidth = fitSpan * Math.max(1, aspect);
  const viewHeight = fitSpan * Math.max(1, 1 / aspect);
  const view = { x: airport.x - viewWidth / 2, y: airport.y - viewHeight / 2, w: viewWidth, h: viewHeight };
  const projectionScale = Math.min(viewport.width / view.w, viewport.height / view.h);
  const fixAnnotationScale = projectionScale > 0 ? 1 / projectionScale : 1;
  const [prediction, setPrediction] = useState<{ planeId: string; result: FlightPrediction } | null>(null);
  const predictionContextRef = useRef<{
    planeId: string; airport: Airport; runwayConfig: RunwayConfig; gameSpeed: GameSpeed; ilsWidth: number; clearanceKey: string; domain?: RadarDomain; at: number;
  } | null>(null);

  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const phosphorState = useRef({ airport, planes, selectedId, showRangeRings: layers.showRangeRings });
  phosphorState.current = { airport, planes, selectedId, showRangeRings: layers.showRangeRings };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width > 0 && height > 0 && Number.isFinite(width / height)) {
        onViewportAspect?.(width / height);
        setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [onViewportAspect]);

  // Canvas paints range rings and a faint halo behind target symbols.
  // Data-block text is SVG only, with no bloom, so the readout stays sharp.
  useEffect(() => {
    const canvas = phosphorRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const bounds = svg.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(bounds.width * dpr));
      const h = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${bounds.width}px`;
        canvas.style.height = `${bounds.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, bounds.width, bounds.height);

      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const toScreen = (x: number, y: number) => {
        const pt = svg.createSVGPoint();
        pt.x = x;
        pt.y = y;
        const sp = pt.matrixTransform(ctm);
        return { x: sp.x - bounds.left, y: sp.y - bounds.top };
      };

      const { airport: scope, planes: tracks, selectedId: activeId, showRangeRings } = phosphorState.current;
      const phosphor = themeHex('--color-target', '#5FD35F');
      const roleColor: Record<TrackRole, string> = {
        arrival: phosphor,
        departure: themeHex('--color-departure', '#62B0DC'),
        uncontrolled: themeHex('--color-uncontrolled', '#9AA4A8'),
        selected: themeHex('--color-selected', '#e8c56a'),
        alert: themeHex('--color-alert', '#e0b04a'),
        conflict: themeHex('--color-conflict', '#ef6464'),
      };
      const center = toScreen(scope.x, scope.y);
      const rim = toScreen(scope.x + SCOPE_RADIUS, scope.y);
      const radius = Math.hypot(rim.x - center.x, rim.y - center.y);
      if (!isFinite(radius) || radius < 8) return;
      const scale = radius / SCOPE_RADIUS;
      const now = performance.now();

      ctx.save();

      if (showRangeRings) {
        for (const nm of RANGE_RING_NM) {
          const ringR = nm * UNITS_PER_NM;
          const edge = toScreen(scope.x + ringR, scope.y);
          const rr = Math.hypot(edge.x - center.x, edge.y - center.y);
          ctx.beginPath();
          ctx.arc(center.x, center.y, rr, 0, Math.PI * 2);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = phosphor;
          ctx.globalAlpha = 0.14;
          ctx.lineWidth = 1;
          ctx.setLineDash([3 * scale, 6 * scale]);
          ctx.stroke();
          ctx.setLineDash([]);
          const label = toScreen(scope.x + ringR * 0.707 + 4, scope.y - ringR * 0.707 - 4);
          ctx.font = `bold ${Math.max(9, 10 * scale)}px ui-monospace, monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = phosphor;
          ctx.globalAlpha = 0.28;
          ctx.fillText(`${nm}NM`, label.x, label.y);
        }
      }

      ctx.textBaseline = 'alphabetic';
      for (const plane of tracks) {
        const selected = plane.id === activeId;
        const color = roleColor[trackRole(plane, selected)];
        const alpha = bloomAlpha(plane, selected, now);
        const symbol = toScreen(plane.x, plane.y);
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.globalAlpha = alpha * 0.28;
        ctx.fillText('✳', symbol.x, symbol.y + 3.5);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
  }, []);

  const getCoordinates = useCallback((e: React.MouseEvent) => {
    const pt = getSvgPoint(e.clientX, e.clientY);
    return pt ? { x: pt.x, y: pt.y } : null;
  }, [getSvgPoint]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCoordinates(e);
    if (coords) setMousePos(coords);
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    if (!hasDraggedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      hasDraggedRef.current = true;
    }

  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const clickedAircraft = !!target?.closest('[data-aircraft], [data-aircraft-hit]');
    const clickedAction = !!target?.closest('[data-radar-action]');
    // A click on a track selects it. It must not also be treated as a heading vector,
    // which would deselect the aircraft before a typed clearance can be entered.
    if (!hasDraggedRef.current && !clickedAircraft && !clickedAction && selectedId && mousePos && onCommand) {
      const plane = planes.find(p => p.id === selectedId);
      if (plane && !plane.isEstablished) {
        let headingToMouse = (Math.atan2(mousePos.y - plane.y, mousePos.x - plane.x) * 180 / Math.PI) + 90;
        headingToMouse = (headingToMouse + 360) % 360;
        
        onCommand(selectedId, { 
          targetHeading: Math.round(headingToMouse),
          targetWaypoint: null 
        });
        audioManager.playRadio();
        onSelect(null); // Smooth auto-deselect after vectoring
      }
    }
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    dragStartRef.current = null;
  };

  const trackMetrics = planes.map((plane, index) => {
    const nearbyIndex = planes.slice(0, index).filter(other =>
      Math.hypot(other.x - plane.x, other.y - plane.y) * projectionScale < 90).length;
    return trackPresentation(plane, trackReadout(plane, airport), view, projectionScale, nearbyIndex);
  });

  const selectedPlane = planes.find(p => p.id === selectedId);
  const captureRunwayId = selectedPlane?.type === 'arrival'
    ? inspectIlsReadiness(selectedPlane, airport, runwayConfig, ilsWidth).check?.runway.id
    : undefined;

  useEffect(() => {
    if (!selectedPlane || !layers.showVectors) {
      predictionContextRef.current = null;
      setPrediction(null);
      return;
    }
    const clearanceKey = [selectedPlane.targetWaypoint, selectedPlane.assignedRunwayId, selectedPlane.isEstablished,
      selectedPlane.targetWaypoint || selectedPlane.isEstablished ? 'auto' : selectedPlane.targetHeading,
      selectedPlane.targetAltitude, selectedPlane.targetSpeed, selectedPlane.goAround].join(':');
    const previous = predictionContextRef.current;
    const now = performance.now();
    const sameContext = previous?.planeId === selectedPlane.id
      && previous.airport === airport && previous.runwayConfig === runwayConfig
      && previous.gameSpeed === gameSpeed && previous.ilsWidth === ilsWidth && previous.clearanceKey === clearanceKey && previous.domain === domain;
    // Replaying up to 2,400 ticks is only useful for the selected aircraft,
    // and never needs to run at the live simulation's 20–80 Hz frequency.
    if (sameContext && now - previous.at < 500) return;
    predictionContextRef.current = { planeId: selectedPlane.id, airport, runwayConfig, gameSpeed, ilsWidth, clearanceKey, domain, at: now };
    setPrediction({ planeId: selectedPlane.id, result: predictFlightPath(selectedPlane, airport, runwayConfig, ilsWidth, gameSpeed, PREDICTION_SECONDS, domain) });
  }, [selectedPlane, airport, runwayConfig, gameSpeed, ilsWidth, layers.showVectors, domain]);

  const activePrediction = prediction?.planeId === selectedId && layers.showVectors ? prediction.result : null;
  const predictionEnd = activePrediction?.points.at(-1);

  const transmitIlsFix = (runwayId: string, point: { x: number; y: number }) => {
    if (!selectedPlane || !onCommand || selectedPlane.isEstablished || selectedPlane.type !== 'arrival') return;
    const angle = (Math.atan2(point.y - selectedPlane.y, point.x - selectedPlane.x) * 180 / Math.PI) + 90;
    onCommand(selectedPlane.id, {
      targetHeading: Math.round((angle + 360) % 360),
      targetWaypoint: null,
      assignedRunwayId: runwayId,
    });
    audioManager.playRadio();
    onSelect(null);
  };

  const transmitDirect = (waypointId: string) => {
    if (!selectedPlane || !onCommand || selectedPlane.isEstablished) return;
    onCommand(selectedPlane.id, { targetWaypoint: waypointId });
    audioManager.playRadio();
    onSelect(null);
  };

  // Mouse vector calculations for selected aircraft
  const selectedMouseVector = useMemo(() => {
    if (!selectedPlane || !mousePos || selectedPlane.isEstablished) return null;
    const dx = mousePos.x - selectedPlane.x;
    const dy = mousePos.y - selectedPlane.y;
    let heading = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
    heading = (heading + 360) % 360;
    return {
      heading: Math.round(heading),
    };
  }, [selectedPlane, mousePos]);
  // Authentic live radio phraseology line at the bottom
  const liveVoiceReadback = useMemo(() => {
    if (!selectedPlane) {
      const alerts = planes.filter(plane => plane.conflict || plane.status === 'warning' || plane.status === 'crashed' || plane.status === 'bad_approach').length;
      return `STANDBY ON RADAR FREQUENCY 119.725 MHz · SECTOR ACTIVE${alerts ? ` · ${alerts} TRACK ALERT${alerts === 1 ? '' : 'S'}` : ''}`;
    }
    const curAltHundreds = Math.round(selectedPlane.altitude / 100);
    const tgtAltHundreds = Math.round(selectedPlane.targetAltitude / 100);
    const altStr = selectedPlane.altitude >= 6000 ? `FL${curAltHundreds}` : `${Math.round(selectedPlane.altitude)} feet`;
    const tgtAltStr = selectedPlane.targetAltitude >= 6000 ? `FL${tgtAltHundreds}` : `${Math.round(selectedPlane.targetAltitude)} feet`;

    if (selectedPlane.isEstablished) {
      const estRwy = airport.runways.find(r => r.id === selectedPlane.establishedRunwayId);
      const dist = (Math.hypot(selectedPlane.x - airport.x, selectedPlane.y - airport.y) / UNITS_PER_NM).toFixed(1);
      return `${selectedPlane.callsign} (${selectedPlane.model}), established ILS ${estRwy?.label ?? ''}, automatic descent, speed ${Math.round(selectedPlane.speed)}, heading ${Math.round(selectedPlane.heading)}. ${dist} NM from field.`;
    }

    if (selectedPlane.targetWaypoint) {
      const wp = airport.waypoints.find(w => w.id === selectedPlane.targetWaypoint);
      return `${selectedPlane.callsign} (${selectedPlane.model}), routing direct ${wp ? wp.label : 'FIX'}, maintaining ${altStr}, speed ${Math.round(selectedPlane.speed)}.`;
    }

    const altDiff = selectedPlane.targetAltitude - selectedPlane.altitude;
    const altAction = altDiff < -150 ? `descending to ${tgtAltStr}` :
                      altDiff > 150 ? `climbing to ${tgtAltStr}` :
                      `maintaining ${altStr}`;

    if (selectedPlane.type === 'departure' && selectedPlane.exitWaypointId) {
      const exitLabel = airport.waypoints.find(w => w.id === selectedPlane.exitWaypointId)?.label ?? 'FIX';
      return `${selectedPlane.callsign} (${selectedPlane.model}), ${altAction}, heading ${Math.round(selectedPlane.targetHeading).toString().padStart(3, '0')}. Exit ${exitLabel} — transmit DEP to proceed direct.`;
    }

    return `${selectedPlane.callsign} (${selectedPlane.model}), ${altAction}, speed ${Math.round(selectedPlane.speed)}, heading ${Math.round(selectedPlane.targetHeading).toString().padStart(3, '0')}.`;
  }, [selectedPlane, airport, planes]);

  return (
    <div className="relative isolate w-full h-full flex flex-col select-none bg-scope overflow-hidden">
      <canvas
        ref={phosphorRef}
        className="pointer-events-none absolute top-0 left-0 z-0"
        aria-hidden="true"
      />
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative z-10 w-full h-auto aspect-square md:aspect-auto md:h-full md:flex-1 min-h-0"
        style={{ overflow: 'hidden', cursor: selectedPlane ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Transparent full-frame hit surface preserves the black scope and canvas glow. */}
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="transparent" pointerEvents="all" />

        {/* Real airport geometry retains its existing world coordinates. */}
        <g>
          {/* Subtle Sector Airspace Polygons (TMA, CTR Boundaries) */}
          {airport.airspacePolygons?.map(poly => (
            <polygon
              key={poly.id}
              points={poly.points}
              fill="none"
              stroke={poly.dashed ? scopeColor.airspaceDim : scopeColor.airspace}
              strokeWidth="1.2"
              strokeDasharray={poly.dashed ? "4,6" : undefined}
            />
          ))}

          {/* Holding Stacks (Racetrack Boxes with Fixes) */}
          {airport.holdingStacks?.map(stack => {
            const hw = stack.width / 2;
            const hh = stack.height / 2;
            return (
              <g key={stack.id} transform={`translate(${stack.x}, ${stack.y}) rotate(${stack.rotation})`}>
                <rect
                  x={-hw}
                  y={-hh}
                  width={stack.width}
                  height={stack.height}
                  rx="24"
                  ry="24"
                  fill="none"
                  stroke={scopeColor.airspace}
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="-8"
                  fill={scopeColor.fixLabel}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={`rotate(${-stack.rotation}, 0, -8)`}
                >
                  {stack.label}
                </text>
              </g>
            );
          })}

          {/* Range rings are drawn on the phosphor canvas. */}

          {/* Render ALL Airport Runways and their Authentic Tick Ladder ILS Feathers */}
          {airport.runways.map(rwy => {
            const isLanding = !!runwayConfig[rwy.id]?.landing;
            const isDeparture = !!runwayConfig[rwy.id]?.departure;
            const rwyX = airport.x + (rwy.offsetX || 0);
            const rwyY = airport.y + (rwy.offsetY || 0);
            const rwyLength = rwy.length || 85;
            const halfLen = rwyLength / 2;

            const rad = (rwy.heading * Math.PI) / 180;
            const fafPoint = {
              x: rwyX - 450 * Math.sin(rad),
              y: rwyY + 450 * Math.cos(rad)
            };

            return (
              <g key={rwy.id}>
                <g transform={`translate(${rwyX}, ${rwyY}) rotate(${rwy.heading})`}>
                  {isLanding && layers.showExtendedCenterlines && captureRunwayId === rwy.id && (
                    <polygon
                      points={`${-20 * ilsWidth},20 ${20 * ilsWidth},20 ${520 * ilsWidth},520 ${-520 * ilsWidth},520`}
                      fill={scopeColor.selected}
                      fillOpacity="0.045"
                      stroke={scopeColor.selected}
                      strokeOpacity="0.5"
                      strokeWidth="1"
                      strokeDasharray="3,6"
                      pointerEvents="none"
                    >
                      <title>Actual ILS capture cone for the current difficulty; heading and altitude must also match</title>
                    </polygon>
                  )}
                  {/* ILS Localizer Tick Ladder (Authentic British/European ATC Style) */}
                  {isLanding && layers.showExtendedCenterlines && (
                    <>
                      {/* Approach Gate Rectangle / Box */}
                      <rect
                        x="-45"
                        y={halfLen}
                        width="90"
                        height="440"
                        fill="none"
                        stroke={scopeColor.mapDim}
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />

                      {/* Solid Centerline Line */}
                      <line x1="0" y1={halfLen} x2="0" y2="440" stroke={scopeColor.map} strokeWidth="1.8" />

                      {/* Perpendicular Ladder Cross-Ticks every 1 NM (22.4 units) */}
                      {Array.from({ length: 11 }, (_, i) => {
                        const nm = i + 1;
                        const yPos = halfLen + nm * UNITS_PER_NM;
                        const isMajor = nm % 5 === 0;
                        const tickSpan = isMajor ? 12 : 7;
                        return (
                          <g key={nm}>
                            <line
                              x1={-tickSpan}
                              y1={yPos}
                              x2={tickSpan}
                              y2={yPos}
                              stroke={scopeColor.map}
                              strokeWidth="1.4"
                            />
                          </g>
                        );
                      })}

                      {/* Outer End-Cap Bar at 11-12 NM */}
                      <line x1="-24" y1="440" x2="24" y2="440" stroke={scopeColor.map} strokeWidth="2.5" />
                    </>
                  )}

                  {/* Departure Corridor (if active departure) */}
                  {isDeparture && layers.showExtendedCenterlines && (
                    <line x1="0" y1={-halfLen} x2="0" y2="-400" stroke={scopeColor.mapDim} strokeWidth="1.2" strokeDasharray="6,6" />
                  )}

                  {/* Subdued gray runway bar. Active pavement is a step lighter. */}
                  <rect
                    x="-4"
                    y={-halfLen}
                    width="8"
                    height={rwyLength}
                    fill={isLanding || isDeparture ? scopeColor.runway : scopeColor.runwayIdle}
                    rx="1"
                  />
                  
                  {/* Centerline notch */}
                  <line x1="0" y1={-halfLen + 4} x2="0" y2={halfLen - 4} stroke={scopeColor.centerline} strokeWidth="1" opacity="0.9" />
                </g>

                {/* Final Approach Fix (FAF) Marker for active landing runway */}
                {isLanding && (
                  <g
                    transform={`translate(${fafPoint.x}, ${fafPoint.y})`}
                    data-radar-action="ils-fix"
                    role="button"
                    tabIndex={selectedPlane?.type === 'arrival' && !selectedPlane.isEstablished ? 0 : -1}
                    aria-label={`Transmit heading toward ILS ${rwy.label} fix and assign runway; altitude and speed unchanged`}
                    style={{ cursor: selectedPlane?.type === 'arrival' && !selectedPlane.isEstablished ? 'pointer' : 'default' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasDraggedRef.current) transmitIlsFix(rwy.id, fafPoint);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        transmitIlsFix(rwy.id, fafPoint);
                      }
                    }}
                  >
                    <title>Transmit heading to ILS {rwy.label}; altitude and speed stay unchanged</title>
                    <circle cx="0" cy="0" r="18" fill="transparent" />
                    <circle cx="0" cy="0" r="4.5" fill="none" stroke={scopeColor.fix} strokeWidth="1.4" />
                    <circle cx="0" cy="0" r="1.5" fill={scopeColor.fix} />
                    <text x="8" y="3" fill={scopeColor.fixLabel} fontSize="10" fontFamily="monospace" fontWeight="bold">
                      ILS {rwy.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Aeronautical Waypoints / Fixes (Authentic Double-Circle Symbol ◎) */}
          {layers.showFixes && airport.waypoints.map(wp => {
            const isHovered = mousePos && Math.hypot(mousePos.x - wp.x, mousePos.y - wp.y) * projectionScale < 22;
            return (
              <g
                key={wp.id}
                transform={`translate(${wp.x}, ${wp.y})`}
                data-radar-action="direct-fix"
                role="button"
                tabIndex={selectedPlane && !selectedPlane.isEstablished ? 0 : -1}
                aria-label={`Transmit direct to ${wp.label}`}
                style={{ cursor: selectedPlane && !selectedPlane.isEstablished ? 'pointer' : 'default' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasDraggedRef.current) transmitDirect(wp.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    transmitDirect(wp.id);
                  }
                }}
              >
                <title>Transmit direct to {wp.label}</title>
                <g data-fix-annotation transform={`scale(${fixAnnotationScale})`}>
                  {/* Hit area */}
                  <circle cx="0" cy="0" r="22" fill="transparent" />
                
                  {/* Double circle waypoint fix symbol ◎ */}
                  <circle cx="0" cy="0" r="4" fill="none" stroke={scopeColor.fix} strokeWidth="1.2" />
                  <circle cx="0" cy="0" r="1.5" fill={scopeColor.fix} />
                
                  {/* Fix Label */}
                  <text
                    x="8"
                    y="3"
                    fill={isHovered ? scopeColor.ink : scopeColor.fixLabel}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {wp.label}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* Forecast follows the actual turn, acceleration and navigation math. */}
        {activePrediction && predictionEnd && activePrediction.points.length > 1 && (
          <g style={{ pointerEvents: 'none' }} aria-label={`${PREDICTION_SECONDS}-second forecast using active clearance, not other traffic`}>
            <polyline
              points={activePrediction.points.map(point => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={scopeColor.selected}
              opacity="0.8"
              strokeWidth="1.8"
              strokeDasharray="7,4"
            />
            <circle cx={predictionEnd.x} cy={predictionEnd.y} r="4" fill="none" stroke={scopeColor.selected} strokeWidth="1.5" />
            <text
              x={predictionEnd.x + 8}
              y={predictionEnd.y + 14}
              fill={scopeColor.selected}
              stroke="#000000"
              strokeWidth="3"
              paintOrder="stroke"
              fontSize="10"
              fontFamily="monospace"
            >
              +{Math.round(predictionEnd.seconds)}s{activePrediction.ended ? ' END' : ` · ${Math.round(predictionEnd.altitude / 100) * 100} FT`}
            </text>
          </g>
        )}

        {/* Hit areas precede every annotation so they cannot cover a visible callsign. */}
        <g data-track-hit-layer>
          {planes.map((plane, index) => {
            const { hitRadius } = trackMetrics[index];
            return (
              <circle key={plane.id} data-track-hit data-aircraft-hit={plane.id}
                cx={plane.x} cy={plane.y} r={hitRadius} fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPlaneId(plane.id)}
                onMouseLeave={() => setHoveredPlaneId(null)}
                onClick={e => {
                  e.stopPropagation();
                  if (hasDraggedRef.current) return;
                  const point = svgRef.current?.getScreenCTM?.() ? getCoordinates(e) : null;
                  onSelect(point ? nearestTrack(planes, point, hitRadius)?.id ?? plane.id : plane.id);
                  audioManager.playSelect();
                }}
              />
            );
          })}
        </g>

        {/* Aircraft Radar Targets & Authentic 3-Line Data Blocks */}
        {planes.map((plane, index) => {
          const isSelected = plane.id === selectedId;
          const isHovered = plane.id === hoveredPlaneId;
          const isConflict = plane.conflict || plane.status === 'warning' || plane.status === 'crashed';
          const isUncontrolled = !plane.hasInstructions;
          const role = trackRole(plane, isSelected);
          const targetColor = scopeColor[role];

          // Existing short velocity vectors are heading cues, not the forecast.
          const isReal = gameSpeed === 'real';
          const vectorLen1Min = isReal
            ? ((plane.speed * UNITS_PER_NM) / 60)
            : ((plane.speed / 10) * 1.5);
          const headingRad = plane.heading * Math.PI / 180;
          const vx1 = plane.x + vectorLen1Min * Math.sin(headingRad);
          const vy1 = plane.y - vectorLen1Min * Math.cos(headingRad);

          // Altitude formatting matching reference:
          // A20 =20 (level at 2000ft), A36 ↓30 (at 3600ft descending to 3000ft), F120 ↑140 (climbing to FL140)
          const readout = trackReadout(plane, airport);
          const metrics = trackMetrics[index];
          const { labelX: tagX, labelY: tagY } = metrics;
          const arrowHeading = isSelected && selectedMouseVector ? selectedMouseVector.heading
            : plane.headingAssigned === true && !plane.targetWaypoint && !plane.isEstablished ? plane.targetHeading : null;
          const arrowOffset = arrowHeading === null ? null : headingArrowOffset(plane, arrowHeading, view, metrics.inverseScale);

          // Animation class: conflict flashes rapidly, uncontrolled blinks smoothly
          const animClass = isConflict
            ? 'animate-conflict-flash'
            : (isUncontrolled && !isSelected && !plane.isEstablished)
              ? 'animate-radar-blink'
              : '';

          return (
            <g
              key={plane.id}
              data-aircraft={plane.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${plane.callsign}, ${plane.type}, ${Math.round(plane.altitude)} feet, heading ${Math.round(plane.heading)} degrees, ${Math.round(plane.speed)} knots${isConflict ? ', conflict alert' : ''}`}
              aria-pressed={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasDraggedRef.current) {
                  onSelect(plane.id);
                  audioManager.playSelect();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(plane.id);
                  audioManager.playSelect();
                }
              }}
              onMouseEnter={() => setHoveredPlaneId(plane.id)}
              onMouseLeave={() => setHoveredPlaneId(null)}
              style={{ cursor: 'pointer' }}
              className={animClass}
            >
              {/* 2 NM Separation Halo. Radius is visual only; STCA distance is unchanged. */}
              {(layers.showHalos || isSelected || isHovered || isConflict) && (
                <circle
                  cx={plane.x}
                  cy={plane.y}
                  pointerEvents="none"
                  r={2 * UNITS_PER_NM}
                  fill={isConflict ? scopeColor.conflictSoft : isSelected ? scopeColor.selectedSoft : targetColor}
                  fillOpacity={isConflict || isSelected ? 1 : 0.08}
                  stroke={targetColor}
                  strokeOpacity={isConflict || isSelected ? 1 : 0.45}
                  strokeWidth="1"
                />
              )}

              {/* Phosphor History Trail (Small square/round dots ▪ ▪ ▪) */}
              {layers.showTrails && plane.trail.map((p, i, arr) => {
                const ratio = (i + 1) / arr.length;
                const trailFill = targetColor;
                return (
                  <rect
                    key={i}
                    pointerEvents="none"
                    x={p.x - 1}
                    y={p.y - 1}
                    width="2.5"
                    height="2.5"
                    fill={trailFill}
                    opacity={ratio * 0.75}
                  />
                );
              })}

              {/* Heading vector. The selected track uses the selection accent. */}
              {layers.showVectors && (
                <line
                  pointerEvents="none"
                  x1={plane.x}
                  y1={plane.y}
                  x2={vx1}
                  y2={vy1}
                  stroke={targetColor}
                  strokeWidth={isSelected ? "1.6" : "1"}
                  strokeDasharray={isSelected ? undefined : "2,3"}
                />
              )}

              <g data-track-annotation data-inverse-scale={metrics.inverseScale}
                transform={`translate(${plane.x}, ${plane.y}) scale(${metrics.inverseScale})`}>
                {/* Screen-space symbol and readout; world position is unchanged. */}
                <text
                  x="0"
                  y="3.5"
                  fill={targetColor}
                  fontSize={metrics.symbolSize}
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="symbol-glow"
                >
                  ✳
                </text>

                {arrowHeading !== null && arrowOffset && (
                  <g data-heading-arrow pointerEvents="none"
                    transform={`translate(${arrowOffset.x}, ${arrowOffset.y}) rotate(${arrowHeading})`}>
                    <path d="M0 -6V-20 M-2.5 -16L0 -20L2.5 -16" fill="none" stroke={targetColor}
                      strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )}

                {/* Dotted Leader Line to Data Block */}
                <line
                  x1={tagX > 0 ? 5 : -5}
                  y1={tagY > 0 ? 5 : -5}
                  x2={tagX}
                  y2={tagY}
                  stroke={targetColor}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  opacity="0.65"
                />

                {/* Authentic 3-Line Data Block (Monospace, Sharp Text) */}
                <g transform={`translate(${tagX}, ${tagY})`}>
                  {/* Line 1: Callsign */}
                  <text
                    x="0"
                    y="0"
                    fill={targetColor}
                    stroke="#000000"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    fontSize={metrics.callsignSize}
                    fontFamily="monospace"
                    fontWeight="bold"
                    letterSpacing="0"
                  >
                    {readout.line1}
                  </text>

                  {/* Line 2: Altitude Actual + Trend Target (e.g. A36 ↓30) */}
                  <text
                    x="0"
                    y="14"
                    fill={targetColor}
                    stroke="#000000"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    fontSize={metrics.readoutSize}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {readout.line2}
                  </text>

                  {/* Line 3: Speed + exit fix / heading / LOC (e.g. 160 OCKHM, 200 ILS27L) */}
                  <text
                    x="0"
                    y="27"
                    fill={targetColor}
                    stroke="#000000"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    fontSize={metrics.readoutSize}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {readout.line3}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Scope readback line */}
      <div className="relative shrink-0 px-3 py-1 z-20 min-w-0 pointer-events-none select-none">
        <div className="text-xs font-mono font-bold text-phosphor truncate">
          {liveVoiceReadback}
        </div>
      </div>


    </div>
  );
};

