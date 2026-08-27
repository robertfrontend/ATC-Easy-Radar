import React, { useState, useEffect } from 'react';
import { Plane, Radio, Clock, AlertTriangle, Trophy, Trash2, MapPin, CheckCircle2, Play, Compass, Shield, Wind, Sparkles } from 'lucide-react';
import { Difficulty, SavedGame, Airport, RunwayConfig } from '../types';
import { AIRPORTS } from '../config/airports';

interface HomePageProps {
  savedGames: SavedGame[];
  onNewGame: (difficulty: Difficulty, airportId: string, runwayConfig: RunwayConfig) => void;
  onDeleteGame: (id: string) => void;
  highScore: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; desc: string; color: string; badge: string }> = {
  easy:   { label: 'EASY',   desc: 'Light Traffic Flow · 40s Spawn Rate',   color: 'text-green-400 border-green-500/40 bg-green-500/10',   badge: 'bg-green-500/20 text-green-300' },
  medium: { label: 'MEDIUM', desc: 'Standard Terminal Load · 25s Spawn Rate', color: 'text-sky-400 border-sky-500/40 bg-sky-500/10',       badge: 'bg-sky-500/20 text-sky-300' },
  hard:   { label: 'HARD',   desc: 'Peak Rush Hour Flow · 14s Spawn Rate',   color: 'text-orange-400 border-orange-500/40 bg-orange-500/10', badge: 'bg-orange-500/20 text-orange-300' },
};

function formatDuration(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const HomePage: React.FC<HomePageProps> = ({ savedGames, onNewGame, onDeleteGame, highScore }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const [selectedAirportId, setSelectedAirportId] = useState<string>(AIRPORTS[0].id);
  const [utcTime, setUtcTime] = useState('');

  const selectedAirport = AIRPORTS.find(a => a.id === selectedAirportId) || AIRPORTS[0];

  // Multi-runway configuration state
  const [runwayConfig, setRunwayConfig] = useState<RunwayConfig>(() => {
    const initial: RunwayConfig = {};
    AIRPORTS[0].runways.forEach((r, idx) => {
      initial[r.id] = {
        landing: idx === 0,
        departure: idx === 0,
      };
    });
    return initial;
  });

  // Re-initialize runwayConfig when airport changes
  useEffect(() => {
    const airport = AIRPORTS.find(a => a.id === selectedAirportId) || AIRPORTS[0];
    const initial: RunwayConfig = {};
    airport.runways.forEach((r, idx) => {
      initial[r.id] = {
        landing: idx === 0,
        departure: idx === 0,
      };
    });
    setRunwayConfig(initial);
  }, [selectedAirportId]);

  const toggleRunwayLanding = (runwayId: string) => {
    setRunwayConfig(prev => {
      const curr = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...curr, landing: !curr.landing }
      };
    });
  };

  const toggleRunwayDeparture = (runwayId: string) => {
    setRunwayConfig(prev => {
      const curr = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...curr, departure: !curr.departure }
      };
    });
  };

  const setRunwayPreset = (preset: 'single' | 'all-ils' | 'all-ops') => {
    const next: RunwayConfig = {};
    selectedAirport.runways.forEach((r, idx) => {
      if (preset === 'single') {
        next[r.id] = { landing: idx === 0, departure: idx === 0 };
      } else if (preset === 'all-ils') {
        next[r.id] = { landing: true, departure: idx === 0 };
      } else if (preset === 'all-ops') {
        next[r.id] = { landing: true, departure: true };
      }
    });
    setRunwayConfig(next);
  };

  const landingRunways = selectedAirport.runways.filter(r => runwayConfig[r.id]?.landing);
  const departureRunways = selectedAirport.runways.filter(r => runwayConfig[r.id]?.departure);

  // Real-time Zulu Clock
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

  const handleStartGame = () => {
    // Ensure at least one landing and departure runway is active
    let validConfig: RunwayConfig = { ...runwayConfig };
    const activeLandings = Object.values(validConfig).filter(c => c && c.landing);
    if (activeLandings.length === 0) {
      const firstRwyId = selectedAirport.runways[0].id;
      validConfig[firstRwyId] = { ...(validConfig[firstRwyId] || {}), landing: true, departure: true };
    }
    onNewGame(selectedDifficulty, selectedAirportId, validConfig);
  };

  return (
    <div className="min-h-screen bg-[#00030a] text-slate-200 font-mono flex flex-col items-center justify-start p-4 md:p-8 select-none">
      {/* Top Slim Station Bar */}
      <div className="w-full max-w-6xl mb-6">
        <header className="h-12 bg-[#02050e] border border-slate-800 rounded-lg px-5 flex justify-between items-center shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white tracking-widest text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              ATC RADAR // SECTOR DISPATCH
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 text-xs">RADAR SIMULATION v2.0</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-300 font-bold">{utcTime || '00:00:00Z'}</span>
            {highScore > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-yellow-400 font-bold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> HIGH SCORE: {highScore.toString().padStart(4, '0')}
                </span>
              </>
            )}
          </div>
        </header>
      </div>

      {/* Main Grid: Sector Configuration (Left) & Radar Preview (Right) */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column — Sector Selection & Parameters (Col 7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Airport / Sector Selector */}
          <div className="bg-[#02050e] border border-slate-800 rounded-lg p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> 1. Select Control Sector (Airport)
              </span>
              <span className="text-[10px] text-slate-500 font-bold">{AIRPORTS.length} SECTORS READY</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AIRPORTS.map(a => {
                const isSelected = selectedAirportId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAirportId(a.id)}
                    className={`p-3 rounded-lg border text-left transition-all relative group ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)] ring-1 ring-sky-400/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{a.icao}</span>
                      <span className="text-base">{a.countryFlag}</span>
                    </div>
                    <div className="text-xs font-semibold mt-0.5 truncate text-slate-300">{a.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{a.runways.length} RWYS</span>
                      <span>{a.waypoints.length} FIXES</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Multi-Runway ILS & Departure Configuration */}
          <div className="bg-[#02050e] border border-slate-800 rounded-lg p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> 2. Runway Operations & ILS
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  ({landingRunways.length} ILS / {departureRunways.length} DEP)
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRunwayPreset('all-ils')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 transition-colors"
                >
                  ALL ILS
                </button>
                <button
                  onClick={() => setRunwayPreset('all-ops')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-green-300 transition-colors"
                >
                  FULL OPS
                </button>
                <button
                  onClick={() => setRunwayPreset('single')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 transition-colors"
                >
                  SINGLE
                </button>
              </div>
            </div>

            {/* Individual Runway Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {selectedAirport.runways.map(r => {
                const isLanding = !!runwayConfig[r.id]?.landing;
                const isDep = !!runwayConfig[r.id]?.departure;

                return (
                  <div
                    key={r.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white text-xs">
                        RWY {r.label} <span className="text-[10px] text-slate-500 font-normal">({r.heading.toString().padStart(3, '0')}°)</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        {isLanding && isDep ? 'ILS Landing & Takeoffs' : isLanding ? 'ILS Landing Only' : isDep ? 'Takeoffs Only' : 'Inactive Runway'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle ILS Landing */}
                      <button
                        onClick={() => toggleRunwayLanding(r.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                          isLanding
                            ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]'
                            : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title="Toggle ILS Approach Landing"
                      >
                        🛬 ILS
                      </button>

                      {/* Toggle Departure */}
                      <button
                        onClick={() => toggleRunwayDeparture(r.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                          isDep
                            ? 'bg-orange-500 text-slate-950 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.35)]'
                            : 'bg-slate-950 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title="Toggle Departures"
                      >
                        🛫 DEP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Traffic Density (Difficulty) & Launch */}
          <div className="bg-[#02050e] border border-slate-800 rounded-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> 3. Traffic Density & Difficulty
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => {
                const cfg = DIFFICULTY_CONFIG[d];
                const active = selectedDifficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(d)}
                    className={`py-2.5 px-3 rounded-lg border text-left transition-all ${
                      active
                        ? cfg.color + ' ring-1 ring-current shadow-lg'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>{cfg.label}</span>
                      {active && <span className="text-xs">✓</span>}
                    </div>
                    <div className="text-[10px] opacity-75 mt-1 leading-tight">{cfg.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Launch Sector Radar Button */}
            <button
              onClick={handleStartGame}
              className="w-full py-4 bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-bold tracking-widest rounded-lg transition-all text-base flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(56,189,248,0.35)] group"
            >
              <span>INITIALIZE RADAR SCOPE</span>
              <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column — Live Radar Sector Preview & Log (Col 5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Authentic Mini Radar Preview Card */}
          <div className="bg-[#02050e] border border-slate-800 rounded-lg p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <span className="text-sky-400">◉</span> Live Sector Scope Preview
              </span>
              <span className="text-sky-400 font-bold">{selectedAirport.icao} / {selectedAirport.name}</span>
            </div>

            {/* Mini SVG Radar Display (Dynamic Multi-Runway ILS / DEP) */}
            <div className="w-full aspect-square bg-[#00030a] rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
              <svg viewBox="0 0 1000 1000" className="w-full h-full p-2">
                {/* Sector Background Circle */}
                <circle cx="500" cy="500" r="470" fill="#020510" stroke="rgba(51, 65, 85, 0.5)" strokeWidth="1.5" />
                
                {/* Range Rings */}
                <circle cx="500" cy="500" r="160" fill="none" stroke="rgba(51, 65, 85, 0.3)" strokeDasharray="4,6" />
                <circle cx="500" cy="500" r="320" fill="none" stroke="rgba(51, 65, 85, 0.3)" strokeDasharray="4,6" />
                <circle cx="500" cy="500" r="470" fill="none" stroke="rgba(51, 65, 85, 0.5)" strokeWidth="1.2" />

                {/* Airspace Boundary Polygons */}
                {selectedAirport.airspacePolygons?.map(poly => (
                  <polygon
                    key={poly.id}
                    points={poly.points}
                    fill="none"
                    stroke={poly.dashed ? "rgba(100, 116, 139, 0.4)" : "rgba(148, 163, 184, 0.5)"}
                    strokeWidth="1.5"
                    strokeDasharray={poly.dashed ? "4,6" : undefined}
                  />
                ))}

                {/* Holding Stacks (Racetracks) */}
                {selectedAirport.holdingStacks?.map(stack => (
                  <g key={stack.id} transform={`translate(${stack.x}, ${stack.y}) rotate(${stack.rotation})`}>
                    <rect
                      x={-stack.width / 2}
                      y={-stack.height / 2}
                      width={stack.width}
                      height={stack.height}
                      rx="20"
                      ry="20"
                      fill="none"
                      stroke="rgba(100, 116, 139, 0.45)"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="-8"
                      fill="rgba(203, 213, 225, 0.7)"
                      fontSize="16"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      transform={`rotate(${-stack.rotation}, 0, -8)`}
                    >
                      {stack.label}
                    </text>
                  </g>
                ))}

                {/* All Airport Runways with Dynamic ILS Tick Ladders & Departure Corridors */}
                {selectedAirport.runways.map(rwy => {
                  const isLanding = !!runwayConfig[rwy.id]?.landing;
                  const isDep = !!runwayConfig[rwy.id]?.departure;
                  const rwyX = selectedAirport.x + (rwy.offsetX || 0);
                  const rwyY = selectedAirport.y + (rwy.offsetY || 0);
                  const rwyLength = rwy.length || 85;
                  const halfLen = rwyLength / 2;

                  return (
                    <g key={rwy.id || rwy.label} transform={`translate(${rwyX}, ${rwyY}) rotate(${rwy.heading})`}>
                      {/* ILS Tick Ladder for Active Landing Runways */}
                      {isLanding && (
                        <>
                          <line x1="0" y1={halfLen} x2="0" y2="420" stroke="#38bdf8" strokeWidth="2.5" />
                          {Array.from({ length: 10 }, (_, i) => {
                            const yPos = halfLen + (i + 1) * 36;
                            return (
                              <line key={i} x1="-12" y1={yPos} x2="12" y2={yPos} stroke="#38bdf8" strokeWidth="1.8" />
                            );
                          })}
                          <line x1="-24" y1="420" x2="24" y2="420" stroke="#38bdf8" strokeWidth="3" />
                        </>
                      )}

                      {/* Departure Line for Active Departure Runways */}
                      {isDep && (
                        <line x1="0" y1={-halfLen} x2="0" y2="-380" stroke="#fb923c" strokeWidth="2" strokeDasharray="6,6" opacity="0.6" />
                      )}

                      {/* Solid Runway Bar */}
                      <rect
                        x="-6"
                        y={-halfLen}
                        width="12"
                        height={rwyLength}
                        fill={isLanding ? "#38bdf8" : isDep ? "#fb923c" : "rgba(148, 163, 184, 0.4)"}
                        rx="1.5"
                      />
                      <line x1="0" y1={-halfLen + 4} x2="0" y2={halfLen - 4} stroke="#ffffff" strokeWidth="1.5" />
                    </g>
                  );
                })}

                {/* Waypoint Fixes (◎ Double Circle) */}
                {selectedAirport.waypoints.map(wp => (
                  <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
                    <circle cx="0" cy="0" r="7" fill="none" stroke="rgba(203, 213, 225, 0.7)" strokeWidth="1.8" />
                    <circle cx="0" cy="0" r="2.5" fill="#e2e8f0" />
                    <text x="12" y="5" fill="rgba(226, 232, 240, 0.85)" fontSize="16" fontFamily="monospace" fontWeight="bold">
                      {wp.label}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Scope Overlay Badge */}
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-sky-400 font-bold">
                  ACTIVE ILS: {landingRunways.map(r => r.label).join(', ') || 'NONE'}
                </span>
                <span className="text-orange-400 font-bold">
                  DEP: {departureRunways.map(r => r.label).join(', ') || 'NONE'}
                </span>
              </div>
            </div>
          </div>

          {/* Logged Sessions History */}
          <div className="bg-[#02050e] border border-slate-800 rounded-lg p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Previous Sessions
              </span>
              <span className="text-[10px] text-slate-500 font-bold">{savedGames.length} SAVED</span>
            </div>

            {savedGames.length === 0 ? (
              <div className="text-center text-slate-600 py-6 text-xs uppercase tracking-widest">
                No session logs recorded
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {[...savedGames].sort((a, b) => b.savedAt - a.savedAt).map(game => {
                  const info = DIFFICULTY_CONFIG[game.difficulty];
                  const gameAirport = AIRPORTS.find(a => a.id === game.airportId);
                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded px-3 py-2 text-xs group hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${info.badge}`}>
                          {info.label}
                        </span>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{gameAirport?.icao || 'SECT'}</span>
                            <span className="text-slate-500 text-[10px]">·</span>
                            <span className="text-green-400 font-bold">{game.score} LANDED</span>
                            {game.accidents > 0 && <span className="text-red-400 font-bold">· {game.accidents} ACCD</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">{formatDuration(game.savedAt)}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteGame(game.id)}
                        className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clean Footer */}
      <footer className="mt-10 mb-4 text-center text-xs text-slate-600 space-y-1">
        <div>
          ATC EASY RADAR · DEVELOPED BY{' '}
          <a
            href="https://github.com/robertfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 font-bold hover:text-sky-400 transition-colors"
          >
            robertfrontend
          </a>
        </div>
      </footer>
    </div>
  );
};


