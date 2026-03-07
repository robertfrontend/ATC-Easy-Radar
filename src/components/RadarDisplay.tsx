import React, { useRef, useState } from 'react';
import { Plane, WAYPOINTS } from '../hooks/useGameLoop';

interface RadarDisplayProps {
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetHeading?: (id: string, heading: number) => void;
  onSetWaypoint?: (id: string, waypointId: string) => void;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({ planes, selectedId, onSelect, onSetHeading, onSetWaypoint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

  const getCoordinates = (e: React.MouseEvent) => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: cursorPt.x, y: cursorPt.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedId) {
      if (mousePos) setMousePos(null);
      return;
    }
    const coords = getCoordinates(e);
    if (coords) setMousePos(coords);
  };

  const handleMouseLeave = () => setMousePos(null);

  const handleSvgClick = (e: React.MouseEvent) => {
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

  return (
    <svg 
      ref={svgRef}
      viewBox="0 0 1000 1000" 
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full cursor-crosshair bg-slate-950"
      style={{ overflow: 'visible' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleSvgClick}
    >
      <defs>
        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(34, 197, 94, 0.05)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#grid)" />

      {/* Grid */}
      <g stroke="rgba(34, 197, 94, 0.15)" strokeWidth="2" fill="none">
        {Array.from({ length: 41 }).map((_, i) => {
          const pos = i * 100 - 1500;
          const isCenter = pos === 500;
          return (
            <React.Fragment key={i}>
              <line x1={pos} y1="-1500" x2={pos} y2="2500" strokeWidth={isCenter ? 2 : 1} opacity={isCenter ? 0.8 : 0.3} />
              <line x1="-1500" y1={pos} x2="2500" y2={pos} strokeWidth={isCenter ? 2 : 1} opacity={isCenter ? 0.8 : 0.3} />
            </React.Fragment>
          );
        })}
      </g>

      {/* ILS Approach Path (Runway 36) */}
      <g stroke="#38bdf8" fill="none" opacity="0.6">
        <polygon points="500,530 300,1500 700,1500" fill="rgba(56, 189, 248, 0.1)" stroke="none" />
        <line x1="500" y1="530" x2="500" y2="1500" strokeWidth="2" strokeDasharray="15,10" />
        <text x="515" y="1450" fill="#38bdf8" fontSize="14" fontFamily="monospace" stroke="none">ILS 36</text>
      </g>

      {/* Runway 36 */}
      <g transform="translate(500, 500)">
        <rect x="-6" y="-30" width="12" height="60" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
        <line x1="0" y1="-25" x2="0" y2="25" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
      </g>

      {/* Waypoints */}
      {WAYPOINTS.map(wp => {
        const isHovered = mousePos && Math.hypot(mousePos.x - wp.x, mousePos.y - wp.y) < 40;
        return (
          <g 
            key={wp.id} 
            transform={`translate(${wp.x}, ${wp.y})`}
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedId && onSetWaypoint) {
                onSetWaypoint(selectedId, wp.id);
              }
            }}
          >
            {/* Large invisible hit area for easier clicking */}
            <circle cx="0" cy="0" r="30" fill="transparent" />
            
            {/* Waypoint symbol */}
            <polygon 
              points="0,-8 7,5 -7,5" 
              fill={isHovered ? "rgba(168, 85, 247, 0.5)" : "none"} 
              stroke="#a855f7" 
              strokeWidth="2" 
            />
            <text 
              x="12" 
              y="4" 
              fill={isHovered ? "#d8b4fe" : "#a855f7"} 
              fontSize="14" 
              fontFamily="monospace" 
              fontWeight={isHovered ? "bold" : "normal"}
            >
              {wp.label}
            </text>
            
            {/* Preview line when hovering with a plane selected */}
            {selectedId && isHovered && selectedPlane && (
              <line 
                x1={-wp.x + selectedPlane.x} 
                y1={-wp.y + selectedPlane.y} 
                x2="0" 
                y2="0" 
                stroke="#a855f7" 
                strokeWidth="2" 
                strokeDasharray="6,6" 
                opacity="0.8" 
              />
            )}
          </g>
        );
      })}

      {/* Target Heading Line for Selected Plane */}
      {selectedPlane && (
        <line
          x1={selectedPlane.x}
          y1={selectedPlane.y}
          x2={selectedPlane.x + 2000 * Math.sin(selectedPlane.targetHeading * Math.PI / 180)}
          y2={selectedPlane.y - 2000 * Math.cos(selectedPlane.targetHeading * Math.PI / 180)}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="2"
          strokeDasharray="10,10"
          className="pointer-events-none"
        />
      )}

      {/* Mouse Helper Line */}
      {selectedPlane && mousePos && (
        <line
          x1={selectedPlane.x}
          y1={selectedPlane.y}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="1"
          strokeDasharray="5,5"
          className="pointer-events-none"
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
          <g key={plane.id} onClick={(e) => { e.stopPropagation(); onSelect(plane.id); }} className="cursor-pointer">
            {/* Click target (invisible) */}
            <circle cx={plane.x} cy={plane.y} r="24" fill="transparent" />
            
            {/* Trail */}
            <polyline
              points={plane.trail.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.4"
            />
            
            {/* Target Waypoint Line */}
            {selectedPlane?.targetWaypoint && (
              <line
                x1={selectedPlane.x}
                y1={selectedPlane.y}
                x2={WAYPOINTS.find(w => w.id === selectedPlane.targetWaypoint)?.x}
                y2={WAYPOINTS.find(w => w.id === selectedPlane.targetWaypoint)?.y}
                stroke="#a855f7"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.6"
              />
            )}
            
            {/* Current Heading Vector (Velocity Line) */}
            <line
              x1={plane.x}
              y1={plane.y}
              x2={plane.x + (plane.speed / 10) * Math.sin(plane.heading * Math.PI / 180)}
              y2={plane.y - (plane.speed / 10) * Math.cos(plane.heading * Math.PI / 180)}
              stroke={isSelected ? '#fff' : color}
              strokeWidth="2"
              opacity="0.8"
            />
            
            {/* Plane Blip */}
            <rect
              x={plane.x - 4}
              y={plane.y - 4}
              width="8"
              height="8"
              fill={isSelected ? '#fff' : color}
            />
            
            {/* Leader line */}
            <line
              x1={plane.x}
              y1={plane.y}
              x2={plane.x + 20}
              y2={plane.y - 20}
              stroke={isSelected ? '#fff' : color}
              strokeWidth="1"
            />

            {/* Data Block */}
            <g transform={`translate(${plane.x + 20}, ${plane.y - 20})`} className="pointer-events-none">
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
  );
};
