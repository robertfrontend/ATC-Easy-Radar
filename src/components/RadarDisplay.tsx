import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plane, Airport, RunwayConfig, RadarLayers, GameSpeed } from '../types';
import { audioManager } from '../utils/audio';

interface RadarDisplayProps {
  airport: Airport;
  runwayConfig: RunwayConfig;
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCommand?: (id: string, updates: Partial<Plane>) => void;
  layers?: RadarLayers;
  gameSpeed?: GameSpeed;
}

const DEFAULT_LAYERS: RadarLayers = {
  showRangeRings: true,
  showFixes: true,
  showVectors: true,
  showTrails: true,
  showHalos: true,
  showExtendedCenterlines: true,
};

const INIT_VB = { x: -200, y: -200, w: 1400, h: 1400 };
const MIN_VB = 400;
const MAX_VB = 2600;

// Scale: 560 units = 25 NM -> 1 NM = 22.4 units
const UNITS_PER_NM = 22.4;

export const RadarDisplay: React.FC<RadarDisplayProps> = ({
  airport,
  runwayConfig,
  planes,
  selectedId,
  onSelect,
  onCommand,
  layers = DEFAULT_LAYERS,
  gameSpeed = 1
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPlaneId, setHoveredPlaneId] = useState<string | null>(null);
  const [vb, setVb] = useState(INIT_VB);

  const panRef = useRef<{ clientX: number; clientY: number; vbX: number; vbY: number } | null>(null);
  const hasDraggedRef = useRef(false);

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

  // Smooth, gradual mouse wheel zooming
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      if (!isFinite(svgPt.x) || !isFinite(svgPt.y)) return;

      // Gentle sensitivity: clamp delta and scale by 0.0008
      const clampedDelta = Math.max(-40, Math.min(40, e.deltaY));
      const factor = 1 + (clampedDelta * 0.00085);

      setVb(prev => {
        const targetW = Math.max(MIN_VB, Math.min(MAX_VB, prev.w * factor));
        const actualFactor = targetW / prev.w;
        return {
          x: svgPt.x - (svgPt.x - prev.x) * actualFactor,
          y: svgPt.y - (svgPt.y - prev.y) * actualFactor,
          w: targetW,
          h: targetW,
        };
      });
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = { clientX: e.clientX, clientY: e.clientY, vbX: vb.x, vbY: vb.y };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCoordinates(e);
    if (coords) setMousePos(coords);
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.clientX;
    const dy = e.clientY - panRef.current.clientY;
    if (!hasDraggedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      hasDraggedRef.current = true;
    }
    if (hasDraggedRef.current && panRef.current) {
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm || !isFinite(ctm.a) || ctm.a === 0) return;
      const newX = panRef.current.vbX - dx / ctm.a;
      const newY = panRef.current.vbY - dy / ctm.d;
      setVb(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!hasDraggedRef.current && selectedId && mousePos && onCommand) {
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
    panRef.current = null;
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    panRef.current = null;
  };

  const selectedPlane = planes.find(p => p.id === selectedId);

  // Smooth zoom actions
  const zoomIn = () => {
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    setVb(prev => {
      const targetW = Math.max(MIN_VB, prev.w * 0.8);
      const actualFactor = targetW / prev.w;
      return {
        x: cx - (cx - prev.x) * actualFactor,
        y: cy - (cy - prev.y) * actualFactor,
        w: targetW,
        h: targetW,
      };
    });
  };

  const zoomOut = () => {
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    setVb(prev => {
      const targetW = Math.min(MAX_VB, prev.w * 1.25);
      const actualFactor = targetW / prev.w;
      return {
        x: cx - (cx - prev.x) * actualFactor,
        y: cy - (cy - prev.y) * actualFactor,
        w: targetW,
        h: targetW,
      };
    });
  };

  const resetView = () => {
    setVb(INIT_VB);
  };


  // Range rings (5, 10, 15, 20, 25 NM)
  const rangeRings = [
    { nm: 5, r: 5 * UNITS_PER_NM },
    { nm: 10, r: 10 * UNITS_PER_NM },
    { nm: 15, r: 15 * UNITS_PER_NM },
    { nm: 20, r: 20 * UNITS_PER_NM },
    { nm: 25, r: 25 * UNITS_PER_NM }
  ];

  // Mouse vector calculations for selected aircraft
  const selectedMouseVector = useMemo(() => {
    if (!selectedPlane || !mousePos || selectedPlane.isEstablished) return null;
    const dx = mousePos.x - selectedPlane.x;
    const dy = mousePos.y - selectedPlane.y;
    let heading = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
    heading = (heading + 360) % 360;
    const distNm = Math.hypot(dx, dy) / UNITS_PER_NM;
    return {
      heading: Math.round(heading),
      distance: distNm.toFixed(1),
    };
  }, [selectedPlane, mousePos]);
  // Authentic live radio phraseology line at the bottom
  const liveVoiceReadback = useMemo(() => {
    if (!selectedPlane) {
      return `STANDBY ON RADAR FREQUENCY 119.725 MHz · SECTOR ACTIVE · ALL TRACKS NORMAL`;
    }
    const curAltHundreds = Math.round(selectedPlane.altitude / 100);
    const tgtAltHundreds = Math.round(selectedPlane.targetAltitude / 100);
    const altStr = selectedPlane.altitude >= 6000 ? `FL${curAltHundreds}` : `${Math.round(selectedPlane.altitude)} feet`;
    const tgtAltStr = selectedPlane.targetAltitude >= 6000 ? `FL${tgtAltHundreds}` : `${Math.round(selectedPlane.targetAltitude)} feet`;

    if (selectedPlane.isEstablished) {
      const estRwy = airport.runways.find(r => r.id === selectedPlane.establishedRunwayId);
      const dist = (Math.hypot(selectedPlane.x - airport.x, selectedPlane.y - airport.y) / UNITS_PER_NM).toFixed(1);
      return `${selectedPlane.callsign} (${selectedPlane.model}), maintaining ${Math.round(selectedPlane.altitude)} feet till the glide, speed ${Math.round(selectedPlane.speed)}, heading ${Math.round(selectedPlane.heading)}. On the loc, ${dist} miles.`;
    }

    if (selectedPlane.targetWaypoint) {
      const wp = airport.waypoints.find(w => w.id === selectedPlane.targetWaypoint);
      return `${selectedPlane.callsign} (${selectedPlane.model}), routing direct ${wp ? wp.label : 'FIX'}, maintaining ${altStr}, speed ${Math.round(selectedPlane.speed)}.`;
    }

    const altDiff = selectedPlane.targetAltitude - selectedPlane.altitude;
    const altAction = altDiff < -150 ? `descending to ${tgtAltStr}` :
                      altDiff > 150 ? `climbing to ${tgtAltStr}` :
                      `maintaining ${altStr}`;

    return `${selectedPlane.callsign} (${selectedPlane.model}), ${altAction}, speed ${Math.round(selectedPlane.speed)}, heading ${Math.round(selectedPlane.targetHeading).toString().padStart(3, '0')}.`;
  }, [selectedPlane, airport]);

  return (
    <div className="relative w-full h-full select-none bg-[#00030a] overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ overflow: 'visible', cursor: hasDraggedRef.current ? 'grabbing' : selectedPlane ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <clipPath id="radarClip">
            <circle cx={airport.x} cy={airport.y} r="560" />
          </clipPath>
        </defs>

        {/* Deep midnight base */}
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="#00030a" />

        {/* Scope Interior (25 NM Radius) */}
        <circle cx={airport.x} cy={airport.y} r="560" fill="#020510" />

        {/* Inside Scope Visuals */}
        <g clipPath="url(#radarClip)">
          {/* Subtle Sector Airspace Polygons (TMA, CTR Boundaries) */}
          {airport.airspacePolygons?.map(poly => (
            <polygon
              key={poly.id}
              points={poly.points}
              fill="none"
              stroke={poly.dashed ? "rgba(100, 116, 139, 0.45)" : "rgba(148, 163, 184, 0.55)"}
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
                  stroke="rgba(100, 116, 139, 0.5)"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="-8"
                  fill="rgba(203, 213, 225, 0.75)"
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

          {/* Concentric Range Rings */}
          {layers.showRangeRings && rangeRings.map(ring => (
            <g key={ring.nm}>
              <circle
                cx={airport.x}
                cy={airport.y}
                r={ring.r}
                fill="none"
                stroke="rgba(51, 65, 85, 0.45)"
                strokeWidth={ring.nm === 25 ? "1.2" : "0.8"}
                strokeDasharray={ring.nm === 25 ? undefined : "3,6"}
              />
              {/* Range Distance Label */}
              <text
                x={airport.x + ring.r * 0.707 + 4}
                y={airport.y - ring.r * 0.707 - 4}
                fill="rgba(100, 116, 139, 0.6)"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {ring.nm}NM
              </text>
            </g>
          ))}

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
                        stroke="rgba(56, 189, 248, 0.22)"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />

                      {/* Solid Centerline Line */}
                      <line x1="0" y1={halfLen} x2="0" y2="440" stroke="#38bdf8" strokeWidth="1.8" />

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
                              stroke="#38bdf8"
                              strokeWidth="1.4"
                            />
                          </g>
                        );
                      })}

                      {/* Outer End-Cap Bar at 11-12 NM */}
                      <line x1="-24" y1="440" x2="24" y2="440" stroke="#38bdf8" strokeWidth="2.5" />
                    </>
                  )}

                  {/* Departure Corridor (if active departure) */}
                  {isDeparture && layers.showExtendedCenterlines && (
                    <line x1="0" y1={-halfLen} x2="0" y2="-400" stroke="#fb923c" strokeWidth="1.2" strokeDasharray="6,6" opacity="0.4" />
                  )}

                  {/* Solid Bright Blue Runway Bar */}
                  <rect
                    x="-4"
                    y={-halfLen}
                    width="8"
                    height={rwyLength}
                    fill={isLanding ? "#38bdf8" : isDeparture ? "#fb923c" : "rgba(148, 163, 184, 0.4)"}
                    rx="1"
                  />
                  
                  {/* Centerline white notch */}
                  <line x1="0" y1={-halfLen + 4} x2="0" y2={halfLen - 4} stroke="#ffffff" strokeWidth="1" opacity="0.9" />
                </g>

                {/* Final Approach Fix (FAF) Marker for active landing runway */}
                {isLanding && (
                  <g
                    transform={`translate(${fafPoint.x}, ${fafPoint.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedId && onCommand && selectedPlane) {
                        const angle = (Math.atan2(fafPoint.y - selectedPlane.y, fafPoint.x - selectedPlane.x) * 180 / Math.PI) + 90;
                        onCommand(selectedId, {
                          targetHeading: Math.round((angle + 360) % 360),
                          targetWaypoint: null,
                          assignedRunwayId: rwy.id
                        });
                        audioManager.playRadio();
                        onSelect(null);
                      }
                    }}
                  >
                    <circle cx="0" cy="0" r="4.5" fill="none" stroke="#38bdf8" strokeWidth="1.4" />
                    <circle cx="0" cy="0" r="1.5" fill="#38bdf8" />
                    <text x="8" y="3" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      ILS {rwy.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Aeronautical Waypoints / Fixes (Authentic Double-Circle Symbol ◎) */}
          {layers.showFixes && airport.waypoints.map(wp => {
            const isHovered = mousePos && Math.hypot(mousePos.x - wp.x, mousePos.y - wp.y) < 30;
            return (
              <g
                key={wp.id}
                transform={`translate(${wp.x}, ${wp.y})`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedId && onCommand) {
                    onCommand(selectedId, { targetWaypoint: wp.id });
                    audioManager.playRadio();
                    onSelect(null);
                  }
                }}
              >
                {/* Hit area */}
                <circle cx="0" cy="0" r="24" fill="transparent" />
                
                {/* Double circle waypoint fix symbol ◎ */}
                <circle cx="0" cy="0" r="4.5" fill="none" stroke="rgba(203, 213, 225, 0.6)" strokeWidth="1.2" />
                <circle cx="0" cy="0" r="1.5" fill="#e2e8f0" />
                
                {/* Fix Label */}
                <text
                  x="8"
                  y="3"
                  fill={isHovered ? "#ffffff" : "rgba(226, 232, 240, 0.85)"}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {wp.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Outer 360° Azimuth Scale / Compass Ring */}
        <circle cx={airport.x} cy={airport.y} r="560" fill="none" stroke="rgba(51, 65, 85, 0.6)" strokeWidth="1.2" />
        
        {/* Azimuth Ticks every 1°, 5°, 10° */}
        {Array.from({ length: 360 }, (_, deg) => {
          const isCardinal = deg % 90 === 0;
          const isDeca = deg % 30 === 0;
          const isMajor = deg % 10 === 0;
          const isMedium = deg % 5 === 0;
          
          const tickLen = isCardinal ? 12 : isDeca ? 10 : isMajor ? 7 : isMedium ? 5 : 2.5;
          const strokeWidth = isCardinal ? 1.5 : isMajor ? 1 : 0.6;
          const opacity = isCardinal ? 0.8 : isMajor ? 0.5 : isMedium ? 0.3 : 0.15;
          
          const rad = deg * Math.PI / 180;
          const x1 = airport.x + 560 * Math.sin(rad);
          const y1 = airport.y - 560 * Math.cos(rad);
          const x2 = airport.x + (560 - tickLen) * Math.sin(rad);
          const y2 = airport.y - (560 - tickLen) * Math.cos(rad);
          
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(148, 163, 184, 1)"
              strokeWidth={strokeWidth}
              opacity={opacity}
            />
          );
        })}

        {/* Azimuth Degree Numbers every 30° */}
        {Array.from({ length: 12 }, (_, i) => {
          const deg = i * 30;
          const rad = deg * Math.PI / 180;
          const labelDist = 540;
          const lx = airport.x + labelDist * Math.sin(rad);
          const ly = airport.y - labelDist * Math.cos(rad);
          const label = deg === 0 ? '360' : deg.toString().padStart(3, '0');
          return (
            <text
              key={deg}
              x={lx}
              y={ly + 3.5}
              fill="rgba(148, 163, 184, 0.6)"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}

        {/* Target Heading Line from Selected Aircraft */}
        {selectedPlane && (
          <line
            x1={selectedPlane.x}
            y1={selectedPlane.y}
            x2={selectedPlane.x + 2000 * Math.sin(selectedPlane.targetHeading * Math.PI / 180)}
            y2={selectedPlane.y - 2000 * Math.cos(selectedPlane.targetHeading * Math.PI / 180)}
            stroke="rgba(250, 204, 21, 0.4)"
            strokeWidth="1.2"
            strokeDasharray="6,6"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Dynamic Vectoring Cursor Guide (Yellow/Green) */}
        {selectedPlane && !selectedPlane.isEstablished && mousePos && (
          <g style={{ pointerEvents: 'none' }}>
            <line 
              x1={selectedPlane.x} 
              y1={selectedPlane.y} 
              x2={mousePos.x} 
              y2={mousePos.y} 
              stroke="#facc15" 
              strokeWidth="1.5" 
              strokeDasharray="4,4"
              opacity="0.85" 
            />
            <circle cx={mousePos.x} cy={mousePos.y} r="5" fill="none" stroke="#facc15" strokeWidth="1.5" />
            <circle cx={mousePos.x} cy={mousePos.y} r="1.5" fill="#facc15" />
            
            {/* Live Heading & Distance Tooltip */}
            {selectedMouseVector && (
              <g transform={`translate(${mousePos.x + 12}, ${mousePos.y - 12})`}>
                <rect x="0" y="-14" width="105" height="28" fill="rgba(6, 12, 24, 0.9)" rx="3" stroke="#facc15" strokeWidth="1" />
                <text x="6" y="-1" fill="#facc15" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  HDG {selectedMouseVector.heading.toString().padStart(3, '0')}°
                </text>
                <text x="6" y="10" fill="#ffffff" fontSize="9" fontFamily="monospace">
                  DIST {selectedMouseVector.distance} NM
                </text>
              </g>
            )}
          </g>
        )}

        {/* Aircraft Radar Targets & Authentic 3-Line Data Blocks */}
        {planes.map(plane => {
          const isSelected = plane.id === selectedId;
          const isHovered = plane.id === hoveredPlaneId;
          const isConflict = plane.conflict || plane.status === 'warning' || plane.status === 'crashed';
          const isDeparture = plane.type === 'departure';
          const isEstablished = plane.isEstablished;
          const isUncontrolled = !plane.hasInstructions;
          
          // Authentic target coloring:
          // 1. Conflict: Flashing Red (#ef4444)
          // 2. Selected: Bright Yellow (#facc15)
          // 3. Established on ILS Localizer: Vivid Electric Aqua Blue (#00e5ff)
          // 4. Departures (Outbound): Warm Amber/Orange (#fb923c)
          // 5. Inbound Arrivals: Crisp White (#ffffff)
          const baseColor = isEstablished
            ? '#00e5ff'
            : isDeparture
              ? '#fb923c'
              : '#ffffff';

          const targetColor = 
            isConflict ? '#ef4444' :
            isSelected ? '#facc15' : baseColor;

          // Velocity Vector Projections (1 min = 60s)
          const isReal = gameSpeed === 'real';
          const vectorLen1Min = isReal
            ? ((plane.speed * UNITS_PER_NM) / 60)
            : ((plane.speed / 10) * 1.5);
          const headingRad = plane.heading * Math.PI / 180;
          const vx1 = plane.x + vectorLen1Min * Math.sin(headingRad);
          const vy1 = plane.y - vectorLen1Min * Math.cos(headingRad);

          // Data block position with Leader Line
          const leaderDx = 24;
          const leaderDy = -24;
          const tagX = plane.x + leaderDx;
          const tagY = plane.y + leaderDy;

          // Altitude formatting matching reference:
          // A20 =20 (level at 2000ft), A36 ↓30 (at 3600ft descending to 3000ft), F120 ↑140 (climbing to FL140)
          const curHundreds = Math.round(plane.altitude / 100);
          const tgtHundreds = Math.round(plane.targetAltitude / 100);
          const prefix = plane.altitude >= 6000 ? 'F' : 'A';
          const curAltStr = `${prefix}${curHundreds}`;
          
          const altDiff = plane.targetAltitude - plane.altitude;
          const trendSign = altDiff < -150 ? `↓${tgtHundreds}` :
                            altDiff > 150 ? `↑${tgtHundreds}` :
                            `=${curHundreds}`;

          // Line 3: Speed + Status/LOC/Heading/Fix (e.g. "196 LOC", "254H 265", "214 MAYFI")
          const estRwy = airport.runways.find(r => r.id === plane.establishedRunwayId);
          let statusLine = '';
          if (plane.isEstablished) {
            statusLine = `ILS${estRwy ? estRwy.label : 'LOC'}`;
          } else if (plane.targetWaypoint) {
            statusLine = airport.waypoints.find(w => w.id === plane.targetWaypoint)?.label || 'DIR';
          } else {
            statusLine = `${Math.round(plane.heading).toString().padStart(3, '0')}`;
          }

          const line3Text = plane.isEstablished || plane.targetWaypoint
            ? `${Math.round(plane.speed)} ${statusLine}`
            : `${Math.round(plane.speed)}H ${statusLine}`;

          // Animation class: conflict flashes rapidly, uncontrolled blinks smoothly
          const animClass = isConflict
            ? 'animate-conflict-flash'
            : (isUncontrolled && !isSelected && !isEstablished)
              ? 'animate-radar-blink'
              : '';

          return (
            <g
              key={plane.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasDraggedRef.current) {
                  onSelect(plane.id);
                  audioManager.playSelect();
                }
              }}
              onMouseEnter={() => setHoveredPlaneId(plane.id)}
              onMouseLeave={() => setHoveredPlaneId(null)}
              style={{ cursor: 'pointer' }}
              className={animClass}
            >
              {/* Click Target Area */}
              <circle cx={plane.x} cy={plane.y} r="24" fill="transparent" />

              {/* 3 NM Separation Halo */}
              {(layers.showHalos || isSelected || isHovered || isConflict) && (
                <circle
                  cx={plane.x}
                  cy={plane.y}
                  r={3 * UNITS_PER_NM}
                  fill={isConflict ? "rgba(239, 68, 68, 0.08)" : isSelected ? "rgba(250, 204, 21, 0.05)" : isEstablished ? "rgba(0, 229, 255, 0.06)" : isDeparture ? "rgba(251, 146, 60, 0.04)" : "rgba(148, 163, 184, 0.04)"}
                  stroke={isConflict ? "#ef4444" : isSelected ? "rgba(250, 204, 21, 0.5)" : isEstablished ? "rgba(0, 229, 255, 0.45)" : isDeparture ? "rgba(251, 146, 60, 0.4)" : "rgba(148, 163, 184, 0.3)"}
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
              )}

              {/* Phosphor History Trail (Small square/round dots ▪ ▪ ▪) */}
              {layers.showTrails && plane.trail.map((p, i, arr) => {
                const ratio = (i + 1) / arr.length;
                const trailFill = isSelected
                  ? "#facc15"
                  : isEstablished
                    ? "rgba(0, 229, 255, 0.8)"
                    : isDeparture
                      ? "rgba(251, 146, 60, 0.75)"
                      : "rgba(226, 232, 240, 0.75)";
                return (
                  <rect
                    key={i}
                    x={p.x - 1}
                    y={p.y - 1}
                    width="2.5"
                    height="2.5"
                    fill={trailFill}
                    opacity={ratio * 0.75}
                  />
                );
              })}

              {/* Heading Vector (Yellow line when selected, as in screenshot) */}
              {layers.showVectors && (
                <line
                  x1={plane.x}
                  y1={plane.y}
                  x2={vx1}
                  y2={vy1}
                  stroke={isSelected ? "#facc15" : isEstablished ? "rgba(0, 229, 255, 0.6)" : isDeparture ? "rgba(251, 146, 60, 0.5)" : "rgba(226, 232, 240, 0.45)"}
                  strokeWidth={isSelected ? "1.6" : "1"}
                  strokeDasharray={isSelected ? undefined : "2,3"}
                />
              )}

              {/* Authentic Asterisk Target Symbol (✳) */}
              <text
                x={plane.x}
                y={plane.y + 4.5}
                fill={targetColor}
                fontSize="16"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                ✳
              </text>

              {/* Dotted Leader Line to Data Block */}
              <line
                x1={plane.x + (leaderDx > 0 ? 5 : -5)}
                y1={plane.y + (leaderDy > 0 ? 5 : -5)}
                x2={tagX}
                y2={tagY}
                stroke={targetColor}
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.65"
              />

              {/* Authentic 3-Line Data Block (Monospace, Sharp Text) */}
              <g transform={`translate(${tagX}, ${tagY})`} style={{ pointerEvents: 'none' }}>
                {/* Subtle dark backdrop for legibility over lines */}
                <rect
                  x="-2"
                  y="-11"
                  width="85"
                  height="38"
                  fill="rgba(0, 3, 10, 0.75)"
                  rx="2"
                />

                {/* Line 1: Callsign + (DEP indicator if departure) */}
                <text
                  x="0"
                  y="0"
                  fill={targetColor}
                  fontSize="11.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  letterSpacing="0.5"
                >
                  {plane.callsign}
                </text>

                {/* Line 2: Altitude Actual + Trend Target (e.g. A36 ↓30) */}
                <text
                  x="0"
                  y="12"
                  fill={targetColor}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {curAltStr} {trendSign}
                </text>

                {/* Line 3: Speed + Heading / Fix / LOC (e.g. 200 ILS09L, 254H 265) */}
                <text
                  x="0"
                  y="23"
                  fill={targetColor}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {line3Text}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Authentic Green Voice Readback Line at Bottom */}
      <div className="absolute bottom-2 left-4 right-28 pointer-events-none select-none">
        <div className="text-xs font-mono font-bold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)] truncate">
          {liveVoiceReadback}
        </div>
      </div>

      {/* Smooth Mini Radar Zoom & Center Widget */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/60 rounded px-2.5 py-1 select-none shadow-xl backdrop-blur-sm z-10 text-xs">
        <button
          onClick={zoomIn}
          disabled={vb.w <= MIN_VB}
          className="w-6 h-6 flex items-center justify-center text-slate-300 font-bold text-base rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={resetView}
          className="px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded border border-slate-700 transition-colors tracking-wider"
          title="Click to Reset View to Center (25 NM)"
        >
          {Math.round(vb.w / UNITS_PER_NM)} NM
        </button>
        <button
          onClick={zoomOut}
          disabled={vb.w >= MAX_VB}
          className="w-6 h-6 flex items-center justify-center text-slate-300 font-bold text-base rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
          title="Zoom Out (−)"
        >
          −
        </button>
      </div>
    </div>
  );
};

