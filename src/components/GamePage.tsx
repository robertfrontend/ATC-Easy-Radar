import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Pause, Play, RotateCcw, Save, Home, Volume2, VolumeX,
  Layers, AlertOctagon, Terminal, CloudSun, Gauge, Settings,
  ChevronDown, Check, Compass, Radio, Wind
} from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import { RadarDisplay } from './RadarDisplay';
import { ControlPanel } from './ControlPanel';
import { Airport, Difficulty, SavedGame, Plane, RadarLayers, RunwayConfig, GameSpeed } from '../types';
import { audioManager } from '../utils/audio';

interface GamePageProps {
  airport: Airport;
  initialRunwayConfig?: RunwayConfig;
  activeRunwayIndex?: number;
  difficulty: Difficulty;
  highScore: number;
  onExit: () => void;
  onSave: (save: Omit<SavedGame, 'id' | 'savedAt'>) => void;
  onScoreUpdate: (score: number) => void;
}

export const GamePage: React.FC<GamePageProps> = ({
  airport,
  initialRunwayConfig,
  activeRunwayIndex,
  difficulty,
  highScore,
  onExit,
  onSave,
  onScoreUpdate
}) => {
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [runwayConfig, setRunwayConfig] = useState<RunwayConfig>(() => {
    if (initialRunwayConfig && Object.keys(initialRunwayConfig).length > 0) {
      return initialRunwayConfig;
    }
    const initial: RunwayConfig = {};
    airport.runways.forEach((r, idx) => {
      const isSelected = idx === (activeRunwayIndex || 0);
      initial[r.id] = {
        landing: isSelected,
        departure: isSelected,
      };
    });
    return initial;
  });

  const activeRunwaysSummary = useMemo(() => {
    const landings = airport.runways.filter(r => runwayConfig[r.id]?.landing).map(r => r.label);
    const departures = airport.runways.filter(r => runwayConfig[r.id]?.departure).map(r => r.label);
    return {
      landings: landings.length > 0 ? landings.join(', ') : 'NONE',
      departures: departures.length > 0 ? departures.join(', ') : 'NONE',
      landingCount: landings.length,
      departureCount: departures.length,
    };
  }, [airport.runways, runwayConfig]);

  const toggleRunwayLanding = (runwayId: string) => {
    setRunwayConfig(prev => {
      const current = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...current, landing: !current.landing }
      };
    });
  };

  const toggleRunwayDeparture = (runwayId: string) => {
    setRunwayConfig(prev => {
      const current = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...current, departure: !current.departure }
      };
    });
  };

  const setRunwayPreset = (preset: 'single' | 'all-ils' | 'all-ops') => {
    setRunwayConfig(() => {
      const next: RunwayConfig = {};
      airport.runways.forEach((r, idx) => {
        if (preset === 'single') {
          const isDefault = idx === activeRunwayIndex;
          next[r.id] = { landing: isDefault, departure: isDefault };
        } else if (preset === 'all-ils') {
          next[r.id] = { landing: true, departure: idx === 0 };
        } else if (preset === 'all-ops') {
          next[r.id] = { landing: true, departure: true };
        }
      });
      return next;
    });
  };

  const [activeMenu, setActiveMenu] = useState<'runways' | 'settings' | null>(null);
  const [utcTime, setUtcTime] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Radar scope layer toggles
  const [layers, setLayers] = useState<RadarLayers>({
    showRangeRings: true,
    showFixes: true,
    showVectors: true,
    showTrails: true,
    showHalos: true,
    showExtendedCenterlines: true,
  });

  const { planes, score, accidents, isPaused, togglePause, setPaused, updatePlaneTarget, restart } = useGameLoop(
    airport,
    runwayConfig,
    difficulty,
    gameSpeed
  );

  // Real-time UTC / Zulu Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      const s = d.getUTCSeconds().toString().padStart(2, '0');
      setUtcTime(`${h}:${m}:${s}Z`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close submenus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-pause game when opening any menu, and resume when closing
  useEffect(() => {
    if (activeMenu !== null) {
      setPaused(true);
    } else {
      setPaused(false);
    }
  }, [activeMenu, setPaused]);

  const toggleSubmenu = (menu: 'runways' | 'settings') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  useEffect(() => {
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  const selectedPlane = planes.find(p => p.id === selectedId) || null;

  // Check if any aircraft is currently in STCA conflict alert
  const hasActiveConflict = useMemo(() => {
    return planes.some(p => p.conflict || p.status === 'warning');
  }, [planes]);

  // Deselect if plane is removed
  useEffect(() => {
    if (selectedId && !planes.find(p => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [planes, selectedId]);

  // Auto-focus command input on selection
  useEffect(() => {
    if (selectedId) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [selectedId]);

  const handleSaveGame = () => {
    onSave({
      score,
      accidents,
      difficulty,
      airportId: airport.id,
      planesActive: planes.length,
      gameSpeed,
    });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioManager.setMuted(newMuted);
  };

  const [commandInput, setCommandInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const tokens = commandInput.trim().toUpperCase().split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      const rwyTargets = airport.runways.map(r => `ILS${r.label}`);
      const autoCompleteTargets = [...airport.waypoints.map(w => w.label), ...rwyTargets, 'FINAL', 'ILS', 'UPWIND', 'DEP'];

      if (lastToken) {
        const match = autoCompleteTargets.find(label => label.toUpperCase().startsWith(lastToken));
        if (match) {
          tokens[tokens.length - 1] = match.toUpperCase();
          setCommandInput(tokens.join(' ') + ' ');
        }
      }
    } else if (e.key === 'Escape') {
      setSelectedId(null);
      setActiveMenu(null);
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !commandInput.trim()) return;

    const fullCmd = commandInput.trim().toUpperCase();
    const updates: Partial<Plane> = {};
    let anyValid = false;

    // 1. Check for specific runway ILS approach command (e.g. "ILS 33L", "FINAL 27", "RWY 04R")
    const rwyMatch = fullCmd.match(/(?:ILS|RWY|FINAL)\s*([0-9]{1,2}[LRC]?)/);
    if (rwyMatch && selectedPlane) {
      const label = rwyMatch[1];
      const rwy = airport.runways.find(r => r.label === label);
      if (rwy) {
        const rwyX = airport.x + (rwy.offsetX || 0);
        const rwyY = airport.y + (rwy.offsetY || 0);
        const rad = (rwy.heading * Math.PI) / 180;
        const fafPoint = {
          x: rwyX - 450 * Math.sin(rad),
          y: rwyY + 450 * Math.cos(rad)
        };
        const angle = (Math.atan2(fafPoint.y - selectedPlane.y, fafPoint.x - selectedPlane.x) * 180 / Math.PI) + 90;
        updates.targetHeading = Math.round((angle + 360) % 360);
        updates.targetAltitude = 3000;
        updates.targetSpeed = 180;
        updates.targetWaypoint = null;
        updates.assignedRunwayId = rwy.id;
        anyValid = true;
      }
    } else if ((fullCmd.includes('FINAL') || fullCmd.includes('ILS')) && selectedPlane) {
      // General FINAL/ILS: vector to the primary/first active ILS runway
      const activeLanding = airport.runways.find(r => runwayConfig[r.id]?.landing) || airport.runways[0];
      const rwyX = airport.x + (activeLanding.offsetX || 0);
      const rwyY = airport.y + (activeLanding.offsetY || 0);
      const rad = (activeLanding.heading * Math.PI) / 180;
      const fafPoint = {
        x: rwyX - 450 * Math.sin(rad),
        y: rwyY + 450 * Math.cos(rad)
      };
      const angle = (Math.atan2(fafPoint.y - selectedPlane.y, fafPoint.x - selectedPlane.x) * 180 / Math.PI) + 90;
      updates.targetHeading = Math.round((angle + 360) % 360);
      updates.targetAltitude = 3000;
      updates.targetSpeed = 180;
      updates.targetWaypoint = null;
      updates.assignedRunwayId = activeLanding.id;
      anyValid = true;
    }

    // 2. Parse Waypoints
    const tokens = fullCmd.split(/\s+/);
    tokens.forEach(token => {
      const wp = airport.waypoints.find(w => w.label.toUpperCase() === token);
      if (wp) {
        updates.targetWaypoint = wp.id;
        updates.assignedRunwayId = null;
        anyValid = true;
      }
    });

    // 3. Parse prefixed commands (e.g. D3000, H090, S210, C10000)
    const cmdRegex = /([CDHS])\s?(\d+)/g;
    let match;
    while ((match = cmdRegex.exec(fullCmd)) !== null) {
      const prefix = match[1];
      const val = parseInt(match[2], 10);

      if (!isNaN(val)) {
        if (prefix === 'C' || prefix === 'D') {
          updates.targetAltitude = val;
          anyValid = true;
        } else if (prefix === 'H') {
          updates.targetHeading = val % 360;
          updates.targetWaypoint = null;
          anyValid = true;
        } else if (prefix === 'S') {
          updates.targetSpeed = val;
          anyValid = true;
        }
      }
    }

    if (anyValid) {
      updatePlaneTarget(selectedId, updates);
      audioManager.playRadio();
      setCommandInput('');
      setSelectedId(null);
    }
  };

  const primaryRunway = airport.runways[activeRunwayIndex] || airport.runways[0];

  return (
    <div className="flex h-screen bg-[#00030a] text-slate-200 font-mono overflow-hidden select-none">
      {/* Main Radar Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Sleek, Minimalist, Ultra-Clean ATC Top Bar */}
        <header ref={headerRef} className="h-10 bg-[#02050e] border-b border-slate-800/80 px-4 flex justify-between items-center z-30 select-none text-xs">
          {/* Left: Clean Station Identifier */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-white tracking-widest text-sm">{airport.icao} APP</span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-400 font-semibold">RWY {activeRunwaysSummary.landings}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{planes.length} TRACKS</span>
            {gameSpeed === 'real' && (
              <>
                <span className="text-slate-600">|</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse flex items-center gap-1.5 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  VELOCIDAD REAL (1:1)
                </span>
              </>
            )}
          </div>

          {/* Center: Monospace Zulu Clock & Stats */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-200 font-bold tracking-wider">{utcTime || '00:00:00Z'}</span>
            <span className="text-slate-700">·</span>
            <span className="text-green-400 font-semibold">LANDED: {score}</span>
            <span className="text-slate-700">·</span>
            <span className={accidents > 0 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-500'}>
              ACCD: {accidents}
            </span>
            {isPaused && (
              <>
                <span className="text-slate-700">·</span>
                <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse">
                  PAUSED
                </span>
              </>
            )}
          </div>

          {/* Right: Only 2 Minimalist Dropdown Action Buttons */}
          <div className="flex items-center gap-2">
            {/* 1. RUNWAYS BUTTON & DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('runways')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                  activeMenu === 'runways'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
                title="Configure Active Runways & ILS"
              >
                <span>🛬 RWYS ({activeRunwaysSummary.landingCount})</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {activeMenu === 'runways' && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#060d1d] border border-slate-700 rounded-lg shadow-2xl p-3 z-50 space-y-2.5 backdrop-blur-md text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">ACTIVE RUNWAYS & ILS</span>
                    <span className="text-[10px] text-slate-500 font-bold">{airport.icao}</span>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRunwayPreset('all-ils')}
                      className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 transition-colors"
                    >
                      ALL ILS
                    </button>
                    <button
                      onClick={() => setRunwayPreset('all-ops')}
                      className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-green-300 transition-colors"
                    >
                      FULL OPS
                    </button>
                    <button
                      onClick={() => setRunwayPreset('single')}
                      className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 transition-colors"
                    >
                      SINGLE
                    </button>
                  </div>

                  {/* Runways Toggle List */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {airport.runways.map(rwy => {
                      const isLanding = !!runwayConfig[rwy.id]?.landing;
                      const isDep = !!runwayConfig[rwy.id]?.departure;
                      return (
                        <div
                          key={rwy.id}
                          className="bg-slate-900/90 border border-slate-800 rounded p-2 flex items-center justify-between"
                        >
                          <div className="font-bold text-white text-xs">
                            RWY {rwy.label} <span className="text-[10px] text-slate-500 font-normal">({rwy.heading}°)</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleRunwayLanding(rwy.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                isLanding
                                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                                  : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              ILS
                            </button>
                            <button
                              onClick={() => toggleRunwayDeparture(rwy.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                isDep
                                  ? 'bg-orange-500 text-slate-950 border-orange-400'
                                  : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              DEP
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. UNIFIED SETTINGS / ATC MENU */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('settings')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                  activeMenu === 'settings'
                    ? 'bg-slate-800 border-slate-500 text-white'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
                title="Simulation Controls, Overlays & Settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>MENU</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {activeMenu === 'settings' && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#060d1d] border border-slate-700 rounded-lg shadow-2xl p-3.5 z-50 space-y-3 backdrop-blur-md text-xs">
                  {/* Simulation Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Velocidad / Speed:</div>
                      {gameSpeed === 'real' && (
                        <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          1:1 REAL TIME
                        </span>
                      )}
                    </div>

                    {/* Dedicated Real Speed Button */}
                    <button
                      onClick={() => setGameSpeed('real')}
                      className={`w-full py-1.5 px-2.5 rounded font-bold text-xs border transition-all flex items-center justify-center gap-1.5 ${
                        gameSpeed === 'real'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                          : 'bg-slate-900/90 border-slate-700 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                      }`}
                      title="Simulación en tiempo real (1:1 ATC scale, giros 3°/s)"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>VELOCIDAD REAL</span>
                      {gameSpeed === 'real' && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>

                    {/* Multiplier Speeds */}
                    <div className="grid grid-cols-4 gap-1">
                      {([0.5, 1, 2, 4] as const).map(spd => (
                        <button
                          key={spd}
                          onClick={() => setGameSpeed(spd)}
                          className={`py-1 rounded text-center font-bold border text-xs transition-colors ${
                            gameSpeed === spd
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    {gameSpeed === 'real' && (
                      <div className="text-[9.5px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/20 rounded p-1.5 leading-tight font-mono">
                        Escala física 1:1, viraje estándar a 3°/s y velocidades reales en nudos (KTS).
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={togglePause}
                        className={`py-1.5 px-2 rounded border font-bold flex items-center justify-center gap-1.5 text-xs transition-colors ${
                          isPaused
                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {isPaused ? <Play className="w-3 h-3 text-yellow-400" /> : <Pause className="w-3 h-3" />}
                        <span>{isPaused ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        onClick={toggleMute}
                        className={`py-1.5 px-2 rounded border font-bold flex items-center justify-center gap-1.5 text-xs transition-colors ${
                          isMuted
                            ? 'bg-red-500/20 border-red-500 text-red-400'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-green-400" />}
                        <span>{isMuted ? 'Muted' : 'Audio ON'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Overlays / Radar Layers */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Radar Overlays:</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={layers.showRangeRings}
                          onChange={e => setLayers(l => ({ ...l, showRangeRings: e.target.checked }))}
                          className="accent-sky-500"
                        />
                        <span>Range Rings</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={layers.showFixes}
                          onChange={e => setLayers(l => ({ ...l, showFixes: e.target.checked }))}
                          className="accent-sky-500"
                        />
                        <span>Fixes (◎)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={layers.showVectors}
                          onChange={e => setLayers(l => ({ ...l, showVectors: e.target.checked }))}
                          className="accent-sky-500"
                        />
                        <span>Vectors</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={layers.showHalos}
                          onChange={e => setLayers(l => ({ ...l, showHalos: e.target.checked }))}
                          className="accent-sky-500"
                        />
                        <span>3 NM Halos</span>
                      </label>
                    </div>
                  </div>

                  {/* Weather Info */}
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-0.5">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">METAR / ATIS:</div>
                    <div className="text-slate-300">WIND: {primaryRunway.heading}° / 10KT · QNH: 1013 (29.92)</div>
                  </div>

                  {/* System Actions */}
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5">
                    <button
                      onClick={() => { handleSaveGame(); setActiveMenu(null); }}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>{saveFlash ? 'Saved!' : 'Save'}</span>
                    </button>
                    <button
                      onClick={() => { restart(); setSelectedId(null); setActiveMenu(null); }}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-red-400 font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restart</span>
                    </button>
                    <button
                      onClick={onExit}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Home className="w-3 h-3" />
                      <span>Exit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* STCA Conflict Warning Bar (Flashing alert banner) */}
        {hasActiveConflict && (
          <div className="bg-red-950/90 border-b border-red-500 text-red-300 px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 animate-pulse z-20">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <span>CA ALARM: LOSS OF SEPARATION (LESS THAN 3 NM / 1000 FT) DETECTED</span>
          </div>
        )}

        {/* Main Radar Scope Container */}
        <div className="flex-1 w-full relative bg-[#020610] overflow-hidden">
          <RadarDisplay
            airport={airport}
            runwayConfig={runwayConfig}
            planes={planes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCommand={updatePlaneTarget}
            layers={layers}
            gameSpeed={gameSpeed}
          />

          {/* Authentic ATC Command Console */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4 pointer-events-auto">
            <form onSubmit={handleCommandSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-green-500/20 rounded blur opacity-75 group-hover:opacity-100 transition duration-500 group-focus-within:bg-green-500/40"></div>
              
              <div className="relative flex flex-col bg-slate-950 border border-green-500/40 rounded-lg p-2.5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-bold text-sm tracking-wider">
                    {selectedPlane ? selectedPlane.callsign : 'ATC'}&gt;
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedPlane ? "e.g. ILS 33L, D3000 H090 S210, HARBR..." : "CLICK AIRCRAFT TO COMMAND..."}
                    disabled={!selectedId}
                    className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-green-900/60 uppercase tracking-widest text-sm disabled:cursor-not-allowed"
                  />
                  {commandInput && (
                    <button
                      type="submit"
                      className="bg-green-500/20 hover:bg-green-500/30 text-green-300 text-[10px] font-bold px-2 py-1 rounded border border-green-500/40 uppercase tracking-wider"
                    >
                      ENTER: TX
                    </button>
                  )}
                </div>

                {/* Micro Syntax Cheat-Sheet */}
                <div className="mt-1 pt-1 border-t border-green-500/10 flex items-center justify-between text-[10px] text-green-500/60 font-mono">
                  <span>ILS 33L (Approach) · D3000 (Descend) · H270 (Heading) · S210 (Speed)</span>
                  <span>[TAB] Auto-Complete</span>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Paused Overlay (shown when paused and no dropdown menu is open) */}
        {isPaused && !activeMenu && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="text-5xl font-bold text-yellow-500 tracking-[0.3em] mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
              SIMULATION PAUSED
            </div>
            <button
              onClick={togglePause}
              className="px-8 py-3.5 bg-yellow-500 text-slate-950 font-bold text-lg rounded border-2 border-yellow-400 hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.4)]"
            >
              RESUME RADAR
            </button>
          </div>
        )}
      </div>

      {/* Side ATC Flight Strip Pedestal */}
      <div className="w-96 bg-[#030712] border-l border-green-500/20 p-5 flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.6)]">
        <ControlPanel
          airport={airport}
          runwayConfig={runwayConfig}
          plane={selectedPlane}
          onCommand={updatePlaneTarget}
          onDeselect={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
};



