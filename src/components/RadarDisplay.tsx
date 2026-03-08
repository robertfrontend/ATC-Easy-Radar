import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plane, Airport } from '../types';
import { audioManager } from '../utils/audio';

interface RadarDisplayProps {
  airport: Airport;
  activeRunwayIndex: number;
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ilsEntry?: { x: number; y: number };
}

const INIT_VB = { x: -200, y: -200, w: 1400, h: 1400 };
const ZOOM_LEVELS = [400, 600, 900, 1400, 1900, 2800]; // viewBox widths
const INIT_ZOOM_IDX = 3; // 1400

export const RadarDisplay: React.FC<RadarDisplayProps> = ({ airport, activeRunwayIndex, planes, selectedId, onSelect, ilsEntry }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [vb, setVb] = useState(INIT_VB);
  const [zoomIdx, setZoomIdx] = useState(INIT_ZOOM_IDX);
  const zoomIdxRef = useRef(INIT_ZOOM_IDX);

  const activeRunway = useMemo(() => airport.runways[activeRunwayIndex] || airport.runways[0], [airport, activeRunwayIndex]);

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
  }, [applyZoomAt]);

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

  const handleMouseUp = () => panRef.current = null;
  const handleMouseLeave = () => { setMousePos(null); panRef.current = null; };

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
      style={{ overflow: 'visible', cursor: hasDraggedRef.current ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <defs>
        <pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="0.6" fill="rgba(34, 197, 94, 0.12)" />
        </pattern>
        <clipPath id="radarClip">
          <circle cx={airport.x} cy={airport.y} r="560" />
        </clipPath>
      </defs>

      <rect x="-5000" y="-5000" width="10000" height="10000" fill="#020817" />
      <circle cx={airport.x} cy={airport.y} r="560" fill="#030d1a" />

      <g clipPath="url(#radarClip)">
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#dots)" />
        <circle cx={airport.x} cy={airport.y} r="187" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="1" />
        <circle cx={airport.x} cy={airport.y} r="373" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="1" />
        <line x1="-5000" y1={airport.y} x2="5500" y2={airport.y} stroke="rgba(34,197,94,0.15)" strokeWidth="1" strokeDasharray="8,6" />
        <line x1={airport.x} y1="-5000" x2={airport.x} y2="5500" stroke="rgba(34,197,94,0.15)" strokeWidth="1" strokeDasharray="8,6" />

        {/* ── RUNWAY & ILS (ROTATED GROUP) ── */}
        <g transform={`translate(${airport.x}, ${airport.y}) rotate(${activeRunway.heading})`}>
          {/* ILS Cone */}
          <polygon points="0,28 -76,450 76,450" fill="rgba(56,189,248,0.06)" stroke="none" />
          <line x1="0" y1="28" x2="-76" y2="450" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
          <line x1="0" y1="28" x2="76" y2="450" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
          <line x1="0" y1="28" x2="0" y2="450" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="12,8" opacity="0.5" />
          
          {/* Runway Rect */}
          <rect x="-6" y="-30" width="12" height="60" fill="#030d1a" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="0" y1="-25" x2="0" y2="25" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
          
          {/* Label (Fixed Rotation) */}
          <text x="86" y="450" fill="#38bdf8" fontSize="13" fontFamily="monospace" opacity="0.7" transform={`rotate(${-activeRunway.heading}, 86, 450)`}>
            ILS {activeRunway.label}
          </text>
        </g>

        {/* ILS Entry Point Marker */}
        {ilsEntry && (
          <g transform={`translate(${ilsEntry.x}, ${ilsEntry.y})`}>
            <rect x="-8" y="-8" width="16" height="16" fill="none" stroke="#38bdf8" strokeWidth="2" transform="rotate(45)" opacity="0.8" />
            <text x="12" y="5" fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">FINAL</text>
          </g>
        )}

        {/* Waypoints */}
        {airport.waypoints.map(wp => {
          const isHovered = mousePos && Math.hypot(mousePos.x - wp.x, mousePos.y - wp.y) < 40;
          return (
            <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`} style={{ cursor: 'default' }}>
              <circle cx="0" cy="0" r="30" fill="transparent" />
              <polygon points="0,-8 7,5 -7,5" fill={isHovered ? 'rgba(168,85,247,0.3)' : 'none'} stroke="#a855f7" strokeWidth="2" />
              <text x="12" y="4" fill={isHovered ? '#d8b4fe' : '#a855f7'} fontSize="14" fontFamily="monospace" fontWeight={isHovered ? 'bold' : 'normal'}>
                {wp.label}
              </text>
            </g>
          );
        })}
      </g>

      <circle cx={airport.x} cy={airport.y} r="560" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" />

      {/* Bearing ticks */}
      {Array.from({ length: 36 }, (_, i) => {
        const deg = i * 10;
        const rad = deg * Math.PI / 180;
        const isCardinal = deg % 90 === 0;
        const isMajor = deg % 30 === 0;
        const innerR = isCardinal ? 536 : isMajor ? 548 : 554;
        return (
          <line key={deg}
            x1={airport.x + 560 * Math.sin(rad)} y1={airport.y - 560 * Math.cos(rad)}
            x2={airport.x + innerR * Math.sin(rad)} y2={airport.y - innerR * Math.cos(rad)}
            stroke="rgba(34,197,94,1)" strokeWidth="1" opacity={isCardinal ? 0.65 : isMajor ? 0.45 : 0.28}
          />
        );
      })}

      {/* Target Heading Line */}
      {selectedPlane && (
        <line
          x1={selectedPlane.x} y1={selectedPlane.y}
          x2={selectedPlane.x + 2000 * Math.sin(selectedPlane.targetHeading * Math.PI / 180)}
          y2={selectedPlane.y - 2000 * Math.cos(selectedPlane.targetHeading * Math.PI / 180)}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="10,10"
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
          <g key={plane.id} onClick={(e) => { e.stopPropagation(); if (!hasDraggedRef.current) { onSelect(plane.id); audioManager.playSelect(); } }} style={{ cursor: 'pointer' }}>
            <circle cx={plane.x} cy={plane.y} r="24" fill="transparent" />
            {plane.trail.slice(-8).map((p, i, arr) => (
              <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} opacity={(i + 1) / arr.length * 0.5} />
            ))}
            {selectedPlane?.targetWaypoint && (
              <line x1={selectedPlane.x} y1={selectedPlane.y} x2={airport.waypoints.find(w => w.id === selectedPlane.targetWaypoint)?.x} y2={airport.waypoints.find(w => w.id === selectedPlane.targetWaypoint)?.y} stroke="#a855f7" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
            )}
            <line x1={plane.x} y1={plane.y} x2={plane.x + (plane.speed / 10) * Math.sin(plane.heading * Math.PI / 180)} y2={plane.y - (plane.speed / 10) * Math.cos(plane.heading * Math.PI / 180)} stroke={isSelected ? '#fff' : color} strokeWidth="2" opacity="0.8" />
            <rect x={plane.x - 4} y={plane.y - 4} width="8" height="8" fill={isSelected ? '#fff' : color} />
            <line x1={plane.x} y1={plane.y} x2={plane.x + 20} y2={plane.y - 20} stroke={isSelected ? '#fff' : color} strokeWidth="1" />
            <g transform={`translate(${plane.x + 25}, ${plane.y - 25})`} style={{ pointerEvents: 'none' }}>
              <rect x="0" y="-14" width="95" height="54" fill="rgba(0,0,0,0.8)" rx="4" stroke={isSelected ? '#fff' : color} strokeWidth="1" />
              <text x="6" y="4" fill={isSelected ? '#fff' : color} fontSize="14" fontFamily="monospace" fontWeight="bold">{plane.originFlag} {plane.callsign}</text>
              <text x="6" y="20" fill={isSelected ? '#fff' : color} fontSize="12" fontFamily="monospace">{plane.altitude >= 10000 ? `FL${Math.round(plane.altitude / 100).toString().padStart(3, '0')}` : `${Math.round(plane.altitude)}ft`}{Math.abs(plane.altitude - plane.targetAltitude) > 100 ? (plane.targetAltitude > plane.altitude ? ' ↑' : ' ↓') : ''}</text>
              <text x="6" y="34" fill={isSelected ? '#fff' : color} fontSize="12" fontFamily="monospace">{Math.round(plane.speed)}kt {Math.round(plane.heading).toString().padStart(3, '0')}°</text>
            </g>
          </g>
        );
      })}
    </svg>

    <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-950/90 border border-green-500/30 rounded px-3 py-2 select-none">
      <button onClick={zoomIn} disabled={zoomIdx === 0} className="w-7 h-7 flex items-center justify-center text-green-400 font-bold text-lg rounded hover:bg-green-500/20 disabled:opacity-30 transition-colors">+</button>
      <div className="flex items-center gap-1.5 px-1">
        {ZOOM_LEVELS.map((_, i) => (
          <button key={i} onClick={() => applyZoomAt(i, vb.x + vb.w / 2, vb.y + vb.h / 2)} className={`rounded-full transition-all ${i === zoomIdx ? 'w-2.5 h-2.5 bg-green-400' : 'w-1.5 h-1.5 bg-green-800 hover:bg-green-600'}`} />
        ))}
      </div>
      <button onClick={zoomOut} disabled={zoomIdx === ZOOM_LEVELS.length - 1} className="w-7 h-7 flex items-center justify-center text-green-400 font-bold text-lg rounded hover:bg-green-500/20 disabled:opacity-30 transition-colors">−</button>
    </div>
    </div>
  );
};
