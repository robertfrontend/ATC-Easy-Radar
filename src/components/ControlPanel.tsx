import React, { useState, useEffect, useMemo } from 'react';
import { Plane, Airport, RunwayConfig } from '../types';
import { Compass, ArrowUpToLine, Gauge, Radio, Send, XCircle, Navigation, AlertTriangle, PlaneLanding } from 'lucide-react';
import { audioManager } from '../utils/audio';

interface ControlPanelProps {
  airport: Airport;
  runwayConfig: RunwayConfig;
  plane: Plane | null;
  onCommand: (id: string, updates: Partial<Plane>) => void;
  onDeselect: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ airport, runwayConfig, plane, onCommand, onDeselect }) => {
  const [heading, setHeading] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [selectedWp, setSelectedWp] = useState<string | null>(null);
  const [assignedRunwayId, setAssignedRunwayId] = useState<string | null>(null);

  // Active landing and departure runways
  const activeLandingRunways = useMemo(() => {
    return airport.runways.filter(r => runwayConfig[r.id]?.landing);
  }, [airport.runways, runwayConfig]);

  const activeDepartureRunways = useMemo(() => {
    return airport.runways.filter(r => runwayConfig[r.id]?.departure);
  }, [airport.runways, runwayConfig]);

  const establishedRunway = useMemo(() => {
    if (!plane?.establishedRunwayId) return null;
    return airport.runways.find(r => r.id === plane.establishedRunwayId) || null;
  }, [airport.runways, plane?.establishedRunwayId]);

  useEffect(() => {
    if (plane) {
      setHeading(Math.round(plane.targetHeading));
      setAltitude(plane.targetAltitude);
      setSpeed(plane.targetSpeed);
      setSelectedWp(plane.targetWaypoint || null);
      setAssignedRunwayId(plane.assignedRunwayId || null);
    }
  }, [plane?.id, plane?.targetHeading, plane?.targetAltitude, plane?.targetSpeed, plane?.targetWaypoint, plane?.assignedRunwayId]);

  // Generate realistic ATC clearance phraseology in real-time
  const radioPhraseology = useMemo(() => {
    if (!plane) return '';
    const parts: string[] = [];

    if (assignedRunwayId) {
      const rwy = airport.runways.find(r => r.id === assignedRunwayId);
      if (rwy) parts.push(`cleared ILS runway ${rwy.label} approach`);
    }

    if (selectedWp) {
      const wpLabel = airport.waypoints.find(w => w.id === selectedWp)?.label || 'FIX';
      parts.push(`direct ${wpLabel}`);
    } else if (Math.round(heading) !== Math.round(plane.heading)) {
      parts.push(`turn heading ${heading.toString().padStart(3, '0')}`);
    }

    if (altitude !== plane.altitude) {
      const altStr = altitude >= 10000 ? `flight level ${Math.round(altitude / 100)}` : `${altitude} feet`;
      if (altitude > plane.altitude) {
        parts.push(`climb and maintain ${altStr}`);
      } else {
        parts.push(`descend and maintain ${altStr}`);
      }
    }

    if (speed !== plane.speed) {
      parts.push(`speed ${speed} knots`);
    }

    if (parts.length === 0) {
      return `${plane.callsign}, maintain current heading and altitude.`;
    }

    return `${plane.callsign}, ${parts.join(', ')}.`;
  }, [plane, heading, altitude, speed, selectedWp, assignedRunwayId, airport]);

  if (!plane) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-green-500/40 text-center p-6 border border-green-500/10 rounded bg-[#020610]">
        <div className="space-y-4 max-w-[240px]">
          <div className="w-16 h-16 rounded-full border border-green-500/20 flex items-center justify-center mx-auto bg-green-500/5">
            <Radio className="w-8 h-8 text-green-500/60 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-green-400/80 tracking-widest uppercase">No Track Selected</div>
            <p className="text-xs text-green-500/50 leading-relaxed">
              Click an aircraft or target blip on the radar scope to open flight strip controls.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleApply = () => {
    onCommand(plane.id, {
      targetHeading: heading,
      targetAltitude: altitude,
      targetSpeed: speed,
      targetWaypoint: selectedWp,
      assignedRunwayId: assignedRunwayId
    });
    audioManager.playRadio();
    onDeselect();
  };

  const handleQuickHeadingDelta = (delta: number) => {
    setHeading(prev => (prev + delta + 360) % 360);
    setSelectedWp(null);
  };

  const handleVectorToRunwayIls = (rwy: (typeof airport.runways)[0]) => {
    const rwyX = airport.x + (rwy.offsetX || 0);
    const rwyY = airport.y + (rwy.offsetY || 0);
    const rad = (rwy.heading * Math.PI) / 180;
    const fafPoint = {
      x: rwyX - 450 * Math.sin(rad),
      y: rwyY + 450 * Math.cos(rad)
    };
    const angle = (Math.atan2(fafPoint.y - plane.y, fafPoint.x - plane.x) * 180 / Math.PI) + 90;
    const directHeading = Math.round((angle + 360) % 360);

    setHeading(directHeading);
    setAltitude(3000);
    setSpeed(180);
    setSelectedWp(null);
    setAssignedRunwayId(rwy.id);
  };

  return (
    <div className="flex flex-col h-full text-green-400 font-mono select-none overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-green-500/20">
      {/* Flight Progress Strip Header */}
      <div className="bg-slate-900/90 border border-green-500/30 rounded p-4 mb-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between pb-2 border-b border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">{plane.originFlag}</span>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-widest leading-none">{plane.callsign}</h2>
              <div className="text-[10px] text-green-400/60 mt-1 flex items-center gap-2">
                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-bold">{plane.model}</span>
                <span>SQ: {plane.squawk}</span>
                <span className="text-green-500 font-bold">IFR</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onDeselect}
            className="text-green-500/40 hover:text-green-300 p-1 transition-colors"
            title="Deselect aircraft (Esc)"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator Bar */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[10px]">TRACK STATUS:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider ${
            plane.status === 'crashed' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
            plane.conflict || plane.status === 'warning' ? 'bg-red-500/25 text-red-300 border border-red-500 animate-conflict-flash' :
            plane.isEstablished ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' :
            plane.type === 'departure' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
            !plane.hasInstructions ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-500 animate-radar-blink' :
            'bg-green-500/20 text-green-300 border border-green-500/40'
          }`}>
            {plane.isEstablished ? `ESTABLISHED ILS ${establishedRunway?.label || ''}` :
             plane.conflict ? 'STCA CONFLICT ALERT' :
             plane.status === 'bad_approach' ? 'UNSTABILIZED APPROACH' :
             plane.type === 'departure' ? 'DEPARTURE CLIMB' :
             !plane.hasInstructions ? 'UNCONTROLLED (INITIAL)' :
             'VECTORING ACTIVE'}
          </span>
        </div>
      </div>

      {/* Main Controls Pedestal */}
      <div className="space-y-4 flex-1">
        {/* Multi-Runway Approach Direct Clearances (For Arrivals) */}
        {plane.type === 'arrival' && activeLandingRunways.length > 0 && (
          <div className="bg-slate-950/80 border border-sky-500/30 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                <PlaneLanding className="w-4 h-4 text-sky-400" /> Cleared ILS Approach
              </label>
              {assignedRunwayId && (
                <button
                  onClick={() => setAssignedRunwayId(null)}
                  className="text-[10px] text-sky-400/60 hover:text-sky-300 underline"
                >
                  Any Active ILS
                </button>
              )}
            </div>

            <div className={`grid ${activeLandingRunways.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
              {activeLandingRunways.map(rwy => (
                <button
                  key={rwy.id}
                  onClick={() => handleVectorToRunwayIls(rwy)}
                  disabled={plane.isEstablished}
                  className={`py-1.5 px-2 rounded border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    assignedRunwayId === rwy.id
                      ? 'bg-sky-500/30 border-sky-400 text-white ring-1 ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                      : 'bg-slate-900 border-sky-500/20 text-sky-300 hover:border-sky-400'
                  }`}
                >
                  <span>ILS RWY {rwy.label}</span>
                  <span className="text-[10px] opacity-60">({rwy.heading}°)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Heading Section */}
        <div className="bg-slate-950/80 border border-green-500/20 rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300">
              <Compass className="w-4 h-4 text-green-400" /> Magnetic Heading
            </label>
            <span className="text-lg font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-green-500/30">
              {heading.toString().padStart(3, '0')}°
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="359"
            value={heading}
            onChange={(e) => {
              setHeading(parseInt(e.target.value, 10));
              setSelectedWp(null);
            }}
            disabled={plane.isEstablished}
            className="w-full accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Heading Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={() => handleQuickHeadingDelta(-30)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-slate-900 hover:bg-green-500/20 border border-green-500/20 rounded text-green-400 transition-colors disabled:opacity-30"
            >
              -30°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(-10)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-slate-900 hover:bg-green-500/20 border border-green-500/20 rounded text-green-400 transition-colors disabled:opacity-30"
            >
              -10°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(10)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-slate-900 hover:bg-green-500/20 border border-green-500/20 rounded text-green-400 transition-colors disabled:opacity-30"
            >
              +10°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(30)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-slate-900 hover:bg-green-500/20 border border-green-500/20 rounded text-green-400 transition-colors disabled:opacity-30"
            >
              +30°
            </button>
          </div>
          
          {activeLandingRunways.length > 0 && (
            <button
              onClick={() => {
                const rwy = activeLandingRunways[0] || airport.runways[0];
                setHeading(rwy.heading);
                setSelectedWp(null);
              }}
              disabled={plane.isEstablished}
              className="w-full py-1 text-[11px] font-bold bg-slate-900/60 hover:bg-sky-500/20 border border-sky-500/30 rounded text-sky-400 transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <Navigation className="w-3 h-3" /> Runway Heading ({activeLandingRunways[0]?.heading.toString().padStart(3, '0')}°)
            </button>
          )}
        </div>

        {/* Altitude Section */}
        <div className="bg-slate-950/80 border border-green-500/20 rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300">
              <ArrowUpToLine className="w-4 h-4 text-green-400" /> Assigned Altitude
            </label>
            <span className="text-lg font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-green-500/30">
              {altitude >= 10000 ? `FL${Math.round(altitude / 100).toString().padStart(3, '0')}` : `${altitude} FT`}
            </span>
          </div>

          <input
            type="range"
            min="1000"
            max="30000"
            step="1000"
            value={altitude}
            onChange={(e) => setAltitude(parseInt(e.target.value, 10))}
            disabled={plane.isEstablished}
            className="w-full accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Altitude Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[2000, 3000, 4000, 5000].map(alt => (
              <button
                key={alt}
                onClick={() => setAltitude(alt)}
                disabled={plane.isEstablished}
                className={`py-1 text-[11px] font-bold rounded border transition-colors disabled:opacity-30 ${
                  altitude === alt ? 'bg-green-500 text-slate-950 border-green-400' : 'bg-slate-900 border-green-500/20 text-green-400 hover:border-green-400'
                }`}
              >
                {alt / 1000}k
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[8000, 10000, 15000].map(alt => (
              <button
                key={alt}
                onClick={() => setAltitude(alt)}
                disabled={plane.isEstablished}
                className={`py-1 text-[11px] font-bold rounded border transition-colors disabled:opacity-30 ${
                  altitude === alt ? 'bg-green-500 text-slate-950 border-green-400' : 'bg-slate-900 border-green-500/20 text-green-400 hover:border-green-400'
                }`}
              >
                {alt >= 10000 ? `FL${alt / 100}` : `${alt / 1000}k`}
              </button>
            ))}
          </div>
        </div>

        {/* Speed Section */}
        <div className="bg-slate-950/80 border border-green-500/20 rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-300">
              <Gauge className="w-4 h-4 text-green-400" /> Target Speed
            </label>
            <span className="text-lg font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-green-500/30">
              {speed} KTS
            </span>
          </div>

          <input
            type="range"
            min="140"
            max="350"
            step="10"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            disabled={plane.isEstablished}
            className="w-full accent-green-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Speed Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[160, 180, 210, 250].map(spd => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                disabled={plane.isEstablished}
                className={`py-1 text-[11px] font-bold rounded border transition-colors disabled:opacity-30 ${
                  speed === spd ? 'bg-green-500 text-slate-950 border-green-400' : 'bg-slate-900 border-green-500/20 text-green-400 hover:border-green-400'
                }`}
              >
                {spd}kt
              </button>
            ))}
          </div>
        </div>

        {/* Direct-To Waypoint Routing Chips */}
        <div className="bg-slate-950/80 border border-purple-500/20 rounded p-3.5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center justify-between">
            <span>Direct to Fix (Waypoint)</span>
            {selectedWp && (
              <button
                onClick={() => setSelectedWp(null)}
                className="text-[10px] text-purple-400/60 hover:text-purple-300 underline"
              >
                Clear Fix
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {airport.waypoints.map(wp => (
              <button
                key={wp.id}
                onClick={() => setSelectedWp(wp.id)}
                disabled={plane.isEstablished}
                className={`py-1.5 px-2 text-xs font-bold rounded border text-center transition-colors disabled:opacity-30 ${
                  selectedWp === wp.id
                    ? 'bg-purple-500/30 border-purple-400 text-white shadow-[0_0_10px_rgba(192,132,252,0.3)]'
                    : 'bg-slate-900 border-purple-500/20 text-purple-300 hover:border-purple-400'
                }`}
              >
                △ {wp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Radio Phraseology Readback Box */}
        <div className="bg-slate-900/90 border border-green-500/20 rounded p-3 text-[11px] space-y-1">
          <div className="text-[10px] text-green-500/60 font-bold uppercase tracking-widest flex items-center gap-1">
            <Radio className="w-3 h-3 text-green-400" /> Live Clearance Readback
          </div>
          <p className="text-green-300 italic font-mono leading-snug">
            "{radioPhraseology}"
          </p>
        </div>
      </div>

      {/* Bottom Transmit Action Button */}
      <div className="mt-4 pt-2 border-t border-green-500/20">
        {plane.isEstablished ? (
          <button
            onClick={() => {
              onCommand(plane.id, {
                isEstablished: false,
                goAround: true,
                targetHeading: Math.round(plane.heading),
                targetAltitude: 3000,
                targetSpeed: 210,
              });
              audioManager.playRadio();
              onDeselect();
            }}
            className="w-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500 text-orange-300 font-bold py-3 px-4 rounded transition-all text-base tracking-widest active:scale-95 shadow-[0_0_20px_rgba(249,115,22,0.2)] flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span>EXECUTE GO AROUND</span>
          </button>
        ) : (
          <button
            onClick={handleApply}
            className="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500 text-green-300 font-bold py-3 px-4 rounded transition-all text-base tracking-widest active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2 group"
          >
            <span>TRANSMIT CLEARANCE</span>
            <Send className="w-4 h-4 text-green-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};

