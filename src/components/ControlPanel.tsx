import React, { useState, useEffect } from 'react';
import { Plane, WAYPOINTS } from '../hooks/useGameLoop';
import { Compass, ArrowUpToLine, Gauge } from 'lucide-react';

interface ControlPanelProps {
  plane: Plane | null;
  onCommand: (id: string, updates: Partial<Plane>) => void;
  onDeselect: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ plane, onCommand, onDeselect }) => {
  const [heading, setHeading] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    if (plane) {
      setHeading(Math.round(plane.targetHeading));
      setAltitude(plane.targetAltitude);
      setSpeed(plane.targetSpeed);
    }
  }, [plane?.id, plane?.targetHeading, plane?.targetAltitude, plane?.targetSpeed]);

  if (!plane) {
    return (
      <div className="h-full flex items-center justify-center text-green-500/50 text-center p-4">
        <div className="space-y-4">
          <Compass className="w-12 h-12 mx-auto opacity-50" />
          <p>Select an aircraft on the radar to issue commands.</p>
        </div>
      </div>
    );
  }

  const handleApply = () => {
    onCommand(plane.id, {
      targetHeading: heading,
      targetAltitude: altitude,
      targetSpeed: speed,
      targetWaypoint: null,
    });
    onDeselect();
  };

  return (
    <div className="flex flex-col gap-6 text-green-400 h-full">
      <div className="border-b border-green-500/30 pb-4">
        <h2 className="text-3xl font-bold text-white tracking-widest">{plane.callsign}</h2>
        <div className="text-sm opacity-70 mt-1 flex items-center gap-2">
          STATUS: 
          <span className={`font-bold ${
            plane.status === 'warning' ? 'text-orange-500' : 
            plane.status === 'bad_approach' ? 'text-orange-500' : 
            plane.status === 'crashed' ? 'text-red-500' : 
            plane.isEstablished ? 'text-sky-400' : 
            !plane.hasInstructions ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {plane.isEstablished && plane.status !== 'bad_approach' ? 'ON ILS APPROACH' : 
             plane.status === 'bad_approach' ? 'BAD APPROACH' : 
             !plane.hasInstructions ? 'UNCONTROLLED' :
             plane.status.toUpperCase()}
          </span>
        </div>
        {plane.targetWaypoint && (
          <div className="text-sm text-purple-400 font-bold mt-1">
            DIRECT TO: {WAYPOINTS.find(w => w.id === plane.targetWaypoint)?.label}
          </div>
        )}
      </div>

      <div className="space-y-8 flex-1">
        {/* Heading Control */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green-300">
            <Compass size={18} /> Heading (deg)
          </label>
          <div className={`flex items-center gap-4 bg-slate-900 p-3 rounded border ${plane.isEstablished ? 'border-sky-500/50 opacity-50' : 'border-green-500/20'}`}>
            <input
              type="range"
              min="0"
              max="359"
              value={heading}
              onChange={(e) => setHeading(parseInt(e.target.value))}
              disabled={plane.isEstablished}
              className="flex-1 accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="w-12 text-right font-mono text-xl text-white">{heading.toString().padStart(3, '0')}</span>
          </div>
        </div>

        {/* Altitude Control */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green-300">
            <ArrowUpToLine size={18} /> Altitude (ft)
          </label>
          <div className={`flex items-center gap-4 bg-slate-900 p-3 rounded border ${plane.isEstablished ? 'border-sky-500/50 opacity-50' : 'border-green-500/20'}`}>
            <input
              type="range"
              min="1000"
              max="30000"
              step="1000"
              value={altitude}
              onChange={(e) => setAltitude(parseInt(e.target.value))}
              disabled={plane.isEstablished}
              className="flex-1 accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="w-16 text-right font-mono text-xl text-white">{altitude}</span>
          </div>
        </div>

        {/* Speed Control */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-green-300">
            <Gauge size={18} /> Speed (kts)
          </label>
          <div className={`flex items-center gap-4 bg-slate-900 p-3 rounded border ${plane.isEstablished ? 'border-sky-500/50 opacity-50' : 'border-green-500/20'}`}>
            <input
              type="range"
              min="140"
              max="400"
              step="10"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              disabled={plane.isEstablished}
              className="flex-1 accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="w-12 text-right font-mono text-xl text-white">{speed}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={plane.isEstablished}
        className="mt-auto bg-green-500/20 hover:bg-green-500/40 border border-green-500 text-green-400 font-bold py-4 px-4 rounded transition-colors text-lg tracking-widest active:bg-green-500/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-500/20"
      >
        {plane.isEstablished ? 'AUTOPILOT ENGAGED' : 'TRANSMIT COMMANDS'}
      </button>
      
      <div className="mt-4 p-4 bg-slate-900 rounded border border-green-500/20 text-xs space-y-2 opacity-80">
        <p className="font-bold text-green-300 mb-2">LANDING REQUIREMENTS:</p>
        <p className="flex justify-between"><span>Destination:</span> <span className="text-white">ILS RWY 36 (Center)</span></p>
        <p className="flex justify-between"><span>Heading:</span> <span className="text-white">340&deg; - 020&deg; (North)</span></p>
        <p className="flex justify-between"><span>Altitude:</span> <span className="text-white">&le; 2000 ft</span></p>
        <p className="flex justify-between"><span>Speed:</span> <span className="text-white">&le; 160 kts</span></p>
      </div>
    </div>
  );
};
