import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plane } from '../types';
import { WAYPOINTS } from '../hooks/useGameLoop';

interface RadarDisplayProps {
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetHeading?: (id: string, heading: number) => void;
  onSetWaypoint?: (id: string, waypointId: string) => void;
}

const INIT_VB = { x: -200, y: -200, w: 1400, h: 1400 };
const ZOOM_LEVELS = [400, 600, 900, 1400, 1900, 2800]; // viewBox widths, small = zoomed in
const INIT_ZOOM_IDX = 3; // 1400

export const RadarDisplay: React.FC<RadarDisplayProps> = ({ planes, selectedId, onSelect, onSetHeading, onSetWaypoint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [vb, setVb] = useState(INIT_VB);
  const [zoomIdx, setZoomIdx] = useState(INIT_ZOOM_IDX);
  const zoomIdxRef = useRef(INIT_ZOOM_IDX);

  const applyZoomAt = useCallback((nextIdx: number, cx: number, cy: number) => {
    if (nextIdx === zoomIdxRef.current) return;
    zoomIdxRef.current = nextIdx;
    setZoomIdx(nextIdx);
    const newSize = ZOOM_LEVELS[nextIdx];
    setVb(prev => {
      const factor = newSize / prev.w;
      return {
        x: cx - (cx - prev.x) * factor,
        y: cy - (cy - prev.y) * factor,
        w: newSize,
        h: newSize,
      };
    });
  }, []);

  // Pan tracking
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

  // Non-passive wheel listener for zoom
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
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIdxRef.current + dir));
      applyZoomAt(nextIdx, svgPt.x, svgPt.y);
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
    // Track mouse for heading helper line
    if (selectedId) {
      const coords = getCoordinates(e);
      if (coords) setMousePos(coords);
    } else {
      if (mousePos) setMousePos(null);
    }

    // Pan
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

  const handleMouseUp = () => {
    panRef.current = null;
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    panRef.current = null;
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) return;
    if (!selectedId || !onSetHeading) return;
    const selectedPlane = planes.find(p => p.id === selectedId);
    if (!selectedPlane || selectedPlane.isEstablished) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    let heading = (Math.atan2(coords.y - selectedPlane.y, coords.x - selectedPlane.x) * 180 / Math.PI) + 90;
    heading = (Math.round(heading) + 360) % 360;
    onSetHeading(selectedId, heading);
  };

  const selectedPlane = planes.find(p => p.id === selectedId);

  const zoomIn  = () => applyZoomAt(Math.max(0, zoomIdxRef.current - 1), vb.x + vb.w / 2, vb.y + vb.h / 2);
  const zoomOut = () => applyZoomAt(Math.min(ZOOM_LEVELS.length - 1, zoomIdxRef.current + 1), vb.x + vb.w / 2, vb.y + vb.h / 2);

  return (
    <div className="relative w-full h-full">
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full bg-[#020817]"
      style={{ overflow: 'visible', cursor: hasDraggedRef.current ? 'grabbing' : selectedId ? 'crosshair' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleSvgClick}
    >
      <defs>
        <pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="0.6" fill="rgba(34, 197, 94, 0.12)" />
        </pattern>
        <clipPath id="radarClip">
          <circle cx="500" cy="500" r="560" />
        </clipPath>
      </defs>

      {/* Outer background */}
      <rect x="-5000" y="-5000" width="10000" height="10000" fill="#020817" />

      {/* Radar circle fill */}
      <circle cx="500" cy="500" r="560" fill="#030d1a" />

      {/* ── CLIPPED RADAR CONTENT ── */}
      <g clipPath="url(#radarClip)">

        {/* Subtle dot grid */}
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#dots)" />

        {/* Range rings */}
        <circle cx="500" cy="500" r="187" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="1" />
        <circle cx="500" cy="500" r="373" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="1" />
        <text x="692" y="503" fill="rgba(34,197,94,0.22)" fontSize="11" fontFamily="monospace">2NM</text>
        <text x="878" y="503" fill="rgba(34,197,94,0.22)" fontSize="11" fontFamily="monospace">4NM</text>

        {/* Crosshair */}
        <line x1="-5000" y1="500" x2="5500" y2="500" stroke="rgba(34,197,94,0.15)" strokeWidth="1" strokeDasharray="8,6" />
        <line x1="500" y1="-5000" x2="500" y2="5500" stroke="rgba(34,197,94,0.15)" strokeWidth="1" strokeDasharray="8,6" />

        {/* ILS Approach Path */}
        <g fill="none">
          <polygon points="500,528 424,880 576,880" fill="rgba(56,189,248,0.06)" stroke="none" />
          <line x1="500" y1="528" x2="424" y2="880" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
          <line x1="500" y1="528" x2="576" y2="880" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
          <line x1="500" y1="528" x2="500" y2="880" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="12,8" opacity="0.6" />
          <text x="586" y="880" fill="#38bdf8" fontSize="13" fontFamily="monospace" opacity="0.7">ILS 36</text>
        </g>

        {/* Runway 36 */}
        <g transform="translate(500, 500)">
          <rect x="-6" y="-30" width="12" height="60" fill="#030d1a" stroke="#38bdf8" strokeWidth="1" />
          <line x1="0" y1="-25" x2="0" y2="25" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
        </g>

        {/* Waypoints */}
        {WAYPOINTS.map(wp => {
          const isHovered = mousePos && Math.hypot(mousePos.x - wp.x, mousePos.y - wp.y) < 40;
          return (
            <g
              key={wp.id}
              transform={`translate(${wp.x}, ${wp.y})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedId && onSetWaypoint) onSetWaypoint(selectedId, wp.id);
              }}
            >
              <circle cx="0" cy="0" r="30" fill="transparent" />
              <polygon
                points="0,-8 7,5 -7,5"
                fill={isHovered ? 'rgba(168,85,247,0.5)' : 'none'}
                stroke="#a855f7"
                strokeWidth="2"
              />
              <text
                x="12" y="4"
                fill={isHovered ? '#d8b4fe' : '#a855f7'}
                fontSize="14" fontFamily="monospace"
                fontWeight={isHovered ? 'bold' : 'normal'}
              >
                {wp.label}
              </text>
              {selectedId && isHovered && selectedPlane && (
                <line
                  x1={-wp.x + selectedPlane.x} y1={-wp.y + selectedPlane.y}
                  x2="0" y2="0"
                  stroke="#a855f7" strokeWidth="2" strokeDasharray="6,6" opacity="0.8"
                />
              )}
            </g>
          );
        })}

      </g>
      {/* ── END CLIPPED CONTENT ── */}

      {/* Outer ring border */}
      <circle cx="500" cy="500" r="560" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />

      {/* Bearing ticks (every 10°) */}
      {Array.from({ length: 36 }, (_, i) => {
        const deg = i * 10;
        const rad = deg * Math.PI / 180;
        const isCardinal = deg % 90 === 0;
        const isMajor = deg % 30 === 0;
        const innerR = isCardinal ? 536 : isMajor ? 548 : 554;
        return (
          <line key={deg}
            x1={500 + 560 * Math.sin(rad)} y1={500 - 560 * Math.cos(rad)}
            x2={500 + innerR * Math.sin(rad)} y2={500 - innerR * Math.cos(rad)}
            stroke="rgba(34,197,94,1)" strokeWidth="1"
            opacity={isCardinal ? 0.65 : isMajor ? 0.45 : 0.28}
          />
        );
      })}

      {/* Bearing labels every 30° */}
      {Array.from({ length: 12 }, (_, i) => {
        const deg = i * 30;
        const rad = deg * Math.PI / 180;
        const r = 585;
        const isCardinal = deg % 90 === 0;
        return (
          <text key={deg}
            x={500 + r * Math.sin(rad)} y={500 - r * Math.cos(rad) + 4}
            fill={isCardinal ? 'rgba(34,197,94,0.7)' : 'rgba(34,197,94,0.4)'}
            fontSize={isCardinal ? '16' : '13'}
            fontFamily="monospace"
            fontWeight={isCardinal ? 'bold' : 'normal'}
            textAnchor="middle"
          >
            {deg.toString().padStart(3, '0')}
          </text>
        );
      })}

      {/* Target Heading Line */}
      {selectedPlane && (
        <line
          x1={selectedPlane.x} y1={selectedPlane.y}
          x2={selectedPlane.x + 2000 * Math.sin(selectedPlane.targetHeading * Math.PI / 180)}
          y2={selectedPlane.y - 2000 * Math.cos(selectedPlane.targetHeading * Math.PI / 180)}
          stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="10,10"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Mouse Helper Line */}
      {selectedPlane && mousePos && (
        <line
          x1={selectedPlane.x} y1={selectedPlane.y}
          x2={mousePos.x} y2={mousePos.y}
          stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="5,5"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Planes */}
      {planes.map(plane => {
        const isSelected = plane.id === selectedId;
        const color = plane.status === 'crashed' ? '#ef4444' :
                      plane.status === 'warning' ? '#f97316' :
                      plane.status === 'bad_approach' ? '#f97316' :
                      plane.isEstablished ? '#38bdf8' :
                      !plane.hasInstructions ? '#eab308' : '#4ade80';
        return (
          <g key={plane.id} onClick={(e) => { e.stopPropagation(); if (!hasDraggedRef.current) onSelect(plane.id); }} style={{ cursor: 'pointer' }}>
            <circle cx={plane.x} cy={plane.y} r="24" fill="transparent" />
            {plane.trail.slice(-8).map((p, i, arr) => (
              <circle key={i} cx={p.x} cy={p.y} r="2"
                fill={color} opacity={(i + 1) / arr.length * 0.5}
              />
            ))}
            {selectedPlane?.targetWaypoint && (
              <line
                x1={selectedPlane.x} y1={selectedPlane.y}
                x2={WAYPOINTS.find(w => w.id === selectedPlane.targetWaypoint)?.x}
                y2={WAYPOINTS.find(w => w.id === selectedPlane.targetWaypoint)?.y}
                stroke="#a855f7" strokeWidth="1" strokeDasharray="4,4" opacity="0.6"
              />
            )}
            <line
              x1={plane.x} y1={plane.y}
              x2={plane.x + (plane.speed / 10) * Math.sin(plane.heading * Math.PI / 180)}
              y2={plane.y - (plane.speed / 10) * Math.cos(plane.heading * Math.PI / 180)}
              stroke={isSelected ? '#fff' : color} strokeWidth="2" opacity="0.8"
            />
            <rect x={plane.x - 4} y={plane.y - 4} width="8" height="8" fill={isSelected ? '#fff' : color} />
            <line
              x1={plane.x} y1={plane.y} x2={plane.x + 20} y2={plane.y - 20}
              stroke={isSelected ? '#fff' : color} strokeWidth="1"
            />
            <g transform={`translate(${plane.x + 20}, ${plane.y - 20})`} style={{ pointerEvents: 'none' }}>
              <rect x="0" y="-12" width="70" height="36" fill="rgba(0,0,0,0.7)" rx="4" />
              <text x="4" y="0" fill={isSelected ? '#fff' : color} fontSize="12" fontFamily="monospace" fontWeight="bold">
                {plane.callsign}
              </text>
              <text x="4" y="14" fill={isSelected ? '#fff' : color} fontSize="10" fontFamily="monospace">
                {Math.round(plane.altitude / 100).toString().padStart(3, '0')} {Math.round(plane.speed / 10).toString().padStart(2, '0')}
              </text>
            </g>
          </g>
        );
      })}
    </svg>

    {/* Zoom controls — bottom right */}
    <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-950/90 border border-green-500/30 rounded px-3 py-2 select-none">
      <button
        onClick={zoomIn}
        disabled={zoomIdx === 0}
        className="w-7 h-7 flex items-center justify-center text-green-400 font-bold text-lg rounded hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >+</button>
      <div className="flex items-center gap-1.5 px-1">
        {ZOOM_LEVELS.map((_, i) => (
          <button
            key={i}
            onClick={() => applyZoomAt(i, vb.x + vb.w / 2, vb.y + vb.h / 2)}
            className={`rounded-full transition-all ${i === zoomIdx ? 'w-2.5 h-2.5 bg-green-400' : 'w-1.5 h-1.5 bg-green-800 hover:bg-green-600'}`}
          />
        ))}
      </div>
      <button
        onClick={zoomOut}
        disabled={zoomIdx === ZOOM_LEVELS.length - 1}
        className="w-7 h-7 flex items-center justify-center text-green-400 font-bold text-lg rounded hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >−</button>
    </div>

    </div>
  );
};
