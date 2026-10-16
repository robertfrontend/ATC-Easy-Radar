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

  const exitWaypoint = useMemo(() => {
    if (!plane?.exitWaypointId) return null;
    return airport.waypoints.find(w => w.id === plane.exitWaypointId) || null;
  }, [airport.waypoints, plane?.exitWaypointId]);

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
      <div className="h-full flex flex-col items-center justify-center text-ink-dim text-center p-6 border border-line rounded bg-inset">
        <div className="space-y-4 max-w-[240px]">
          <div className="w-16 h-16 rounded-full border border-line flex items-center justify-center mx-auto bg-panel">
            <Radio className="w-8 h-8 text-phosphor" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold text-ink tracking-widest uppercase">No Track Selected</div>
            <p className="text-xs text-ink-dim leading-relaxed">
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
    <div className="flex flex-col h-full text-ink font-mono select-none overflow-y-auto pr-1">
      {/* Flight Progress Strip Header */}
      <div className="bg-panel-raised border border-line rounded p-4 mb-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-xl">{plane.originFlag}</span>
            <div>
              <h2 className="text-2xl font-bold text-ink-bright tracking-widest leading-none">{plane.callsign}</h2>
              <div className="text-[10px] text-ink-dim mt-1 flex items-center gap-2">
                <span className="bg-inset px-1.5 py-0.5 rounded text-ink-bright font-bold border border-line">{plane.model}</span>
                <span>SQ: {plane.squawk}</span>
                <span className="text-phosphor font-bold">IFR</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onDeselect}
            className="text-ink-faint hover:text-ink-bright p-1 transition-colors"
            title="Deselect aircraft (Esc)"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {plane.type === 'departure' && exitWaypoint && (
          <div className="mt-3 flex items-center justify-between rounded border border-line bg-scope px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Exit fix</span>
            <span className="text-lg font-bold tracking-[0.28em] text-ink-bright">{exitWaypoint.label}</span>
          </div>
        )}

        {/* Status Indicator Bar */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-ink-dim text-[10px]">TRACK STATUS:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider ${
            plane.status === 'crashed' ? 'bg-conflict-soft text-conflict border border-conflict' :
            plane.conflict || plane.status === 'warning' ? 'bg-conflict-soft text-conflict border border-conflict animate-conflict-flash' :
            plane.status === 'bad_approach' ? 'bg-alert-soft text-alert border border-alert' :
            !plane.hasInstructions && !plane.isEstablished ? 'bg-alert-soft text-alert border border-alert animate-radar-blink' :
            'bg-inset text-phosphor border border-line'
          }`}>
            {plane.isEstablished ? `ESTABLISHED ILS ${establishedRunway?.label || ''}` :
             plane.conflict ? 'STCA CONFLICT ALERT' :
             plane.status === 'bad_approach' ? 'UNSTABILIZED APPROACH' :
             plane.type === 'departure' ? (exitWaypoint ? `DEPARTURE · ${exitWaypoint.label}` : 'DEPARTURE CLIMB') :
             !plane.hasInstructions ? 'UNCONTROLLED (INITIAL)' :
             'VECTORING ACTIVE'}
          </span>
        </div>
      </div>

      {/* Main Controls Pedestal */}
      <div className="space-y-4 flex-1">
        {/* Departure exit: climb on runway heading until the controller clears direct. */}
        {plane.type === 'departure' && exitWaypoint && (
          <div className="bg-inset border border-line rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-phosphor">
                <Navigation className="w-4 h-4 text-phosphor" /> Assigned Exit
              </label>
              <span className="text-sm font-bold text-ink-bright tracking-widest">{exitWaypoint.label}</span>
            </div>
            {plane.targetWaypoint === exitWaypoint.id ? (
              <div className="text-[11px] text-ink font-bold tracking-wide">
                CLEARED DIRECT {exitWaypoint.label}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedWp(exitWaypoint.id);
                  onCommand(plane.id, { targetWaypoint: exitWaypoint.id });
                  audioManager.playRadio();
                }}
                className="w-full py-2 rounded border border-line-strong bg-panel-raised hover:bg-ink-bright hover:text-scope text-ink-bright font-bold text-xs tracking-widest transition-colors"
              >
                DIRECT {exitWaypoint.label}
              </button>
            )}
          </div>
        )}

        {/* Multi-Runway Approach Direct Clearances (For Arrivals) */}
        {plane.type === 'arrival' && activeLandingRunways.length > 0 && (
          <div className="bg-inset border border-line rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-phosphor">
                <PlaneLanding className="w-4 h-4 text-phosphor" /> Cleared ILS Approach
              </label>
              {assignedRunwayId && (
                <button
                  onClick={() => setAssignedRunwayId(null)}
                  className="text-[10px] text-ink-faint hover:text-ink underline"
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
                      ? 'bg-ink-bright border-ink-bright text-scope'
                      : 'bg-panel-raised border-line text-ink hover:border-line-strong hover:text-ink-bright'
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
        <div className="bg-inset border border-line rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-phosphor">
              <Compass className="w-4 h-4 text-phosphor" /> Magnetic Heading
            </label>
            <span className="text-lg font-bold text-ink-bright bg-panel px-2 py-0.5 rounded border border-line">
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
            className="w-full h-2 bg-panel rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Heading Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={() => handleQuickHeadingDelta(-30)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-panel-raised hover:bg-panel border border-line rounded text-phosphor transition-colors disabled:opacity-30"
            >
              -30°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(-10)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-panel-raised hover:bg-panel border border-line rounded text-phosphor transition-colors disabled:opacity-30"
            >
              -10°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(10)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-panel-raised hover:bg-panel border border-line rounded text-phosphor transition-colors disabled:opacity-30"
            >
              +10°
            </button>
            <button
              onClick={() => handleQuickHeadingDelta(30)}
              disabled={plane.isEstablished}
              className="py-1 text-[11px] font-bold bg-panel-raised hover:bg-panel border border-line rounded text-phosphor transition-colors disabled:opacity-30"
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
              className="w-full py-1 text-[11px] font-bold bg-panel hover:bg-panel-raised border border-line rounded text-ink transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <Navigation className="w-3 h-3" /> Runway Heading ({activeLandingRunways[0]?.heading.toString().padStart(3, '0')}°)
            </button>
          )}
        </div>

        {/* Altitude Section */}
        <div className="bg-inset border border-line rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-phosphor">
              <ArrowUpToLine className="w-4 h-4 text-phosphor" /> Assigned Altitude
            </label>
            <span className="text-lg font-bold text-ink-bright bg-panel px-2 py-0.5 rounded border border-line">
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
            className="w-full h-2 bg-panel rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Altitude Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[2000, 3000, 4000, 5000].map(alt => (
              <button
                key={alt}
                onClick={() => setAltitude(alt)}
                disabled={plane.isEstablished}
                className={`py-1 text-[11px] font-bold rounded border transition-colors disabled:opacity-30 ${
                  altitude === alt ? 'bg-ink-bright text-scope border-ink-bright' : 'bg-panel-raised border-line text-phosphor hover:border-line-strong hover:text-ink-bright'
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
                  altitude === alt ? 'bg-ink-bright text-scope border-ink-bright' : 'bg-panel-raised border-line text-phosphor hover:border-line-strong hover:text-ink-bright'
                }`}
              >
                {alt >= 10000 ? `FL${alt / 100}` : `${alt / 1000}k`}
              </button>
            ))}
          </div>
        </div>

        {/* Speed Section */}
        <div className="bg-inset border border-line rounded p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-phosphor">
              <Gauge className="w-4 h-4 text-phosphor" /> Target Speed
            </label>
            <span className="text-lg font-bold text-ink-bright bg-panel px-2 py-0.5 rounded border border-line">
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
            className="w-full h-2 bg-panel rounded-lg appearance-none cursor-pointer disabled:opacity-40"
          />

          {/* Quick Speed Presets */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[160, 180, 210, 250].map(spd => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                disabled={plane.isEstablished}
                className={`py-1 text-[11px] font-bold rounded border transition-colors disabled:opacity-30 ${
                  speed === spd ? 'bg-ink-bright text-scope border-ink-bright' : 'bg-panel-raised border-line text-phosphor hover:border-line-strong hover:text-ink-bright'
                }`}
              >
                {spd}kt
              </button>
            ))}
          </div>
        </div>

        {/* Direct-To Waypoint Routing Chips */}
        <div className="bg-inset border border-line rounded p-3.5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-phosphor flex items-center justify-between">
            <span>Direct to Fix (Waypoint)</span>
            {selectedWp && (
              <button
                onClick={() => setSelectedWp(null)}
                className="text-[10px] text-ink-faint hover:text-ink underline"
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
                    ? 'bg-ink-bright border-ink-bright text-scope'
                    : 'bg-panel-raised border-line text-ink hover:border-line-strong hover:text-ink-bright'
                }`}
              >
                △ {wp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Radio Phraseology Readback Box */}
        <div className="bg-panel-raised border border-line rounded p-3 text-[11px] space-y-1">
          <div className="text-[10px] text-ink-dim font-bold uppercase tracking-widest flex items-center gap-1">
            <Radio className="w-3 h-3 text-phosphor" /> Live Clearance Readback
          </div>
          <p className="text-phosphor italic font-mono leading-snug">
            "{radioPhraseology}"
          </p>
        </div>
      </div>

      {/* Bottom Transmit Action Button */}
      <div className="mt-4 pt-2 border-t border-line">
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
            className="w-full bg-alert-soft hover:bg-alert border border-alert text-alert hover:text-scope font-bold py-3 px-4 rounded transition-colors text-base tracking-widest flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            <span>EXECUTE GO AROUND</span>
          </button>
        ) : (
          <button
            onClick={handleApply}
            className="w-full bg-ink-bright hover:bg-phosphor border border-ink-bright text-scope font-bold py-3 px-4 rounded transition-colors text-base tracking-widest flex items-center justify-center gap-2 group"
          >
            <span>TRANSMIT CLEARANCE</span>
            <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};

