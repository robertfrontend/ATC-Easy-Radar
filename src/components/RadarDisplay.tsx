import React, { useRef, useState } from 'react';
import { Plane } from '../hooks/useGameLoop';

interface RadarDisplayProps {
  planes: Plane[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetHeading?: (id: string, heading: number) => void;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({ planes, selectedId, onSelect, onSetHeading }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || !selectedId) {
      if (mousePos) setMousePos(null);
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => setMousePos(null);

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!svgRef.current || !selectedId || !onSetHeading) return;
    const selectedPlane = planes.find(p => p.id === selectedId);
    if (!selectedPlane || selectedPlane.isEstablished) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;

    let heading = (Math.atan2(y - selectedPlane.y, x - selectedPlane.x) * 180 / Math.PI) + 90;
    heading = (Math.round(heading) + 360) % 360;
    onSetHeading(selectedId, heading);
  };

  const selectedPlane = planes.find(p => p.id === selectedId);

  return (
    <svg 
      ref={svgRef}
      viewBox="0 0 1000 1000" 
      className="w-full h-full cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleSvgClick}
    >
      {/* Grid and Rings */}
      <g stroke="rgba(34, 197, 94, 0.2)" strokeWidth="2" fill="none">
        <circle cx="500" cy="500" r="100" />
        <circle cx="500" cy="500" r="200" />
        <circle cx="500" cy="500" r="300" />
        <circle cx="500" cy="500" r="400" />
        <circle cx="500" cy="500" r="500" />
        <line x1="500" y1="0" x2="500" y2="1000" />
        <line x1="0" y1="500" x2="1000" y2="500" />
      </g>

      {/* ILS Approach Path (Runway 36) */}
      <g stroke="#38bdf8" fill="none" opacity="0.6">
        <polygon points="500,530 460,900 540,900" fill="rgba(56, 189, 248, 0.1)" stroke="none" />
        <line x1="500" y1="530" x2="500" y2="950" strokeWidth="2" strokeDasharray="15,10" />
        <text x="515" y="940" fill="#38bdf8" fontSize="14" fontFamily="monospace" stroke="none">ILS 36</text>
      </g>

      {/* Runway 36 */}
      <g transform="translate(500, 500)">
        <rect x="-6" y="-30" width="12" height="60" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
        <line x1="0" y1="-25" x2="0" y2="25" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,4" />
      </g>

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
        const color = plane.status === 'crashed' ? '#ef4444' : plane.status === 'warning' ? '#eab308' : plane.isEstablished ? '#38bdf8' : '#4ade80';
        
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
