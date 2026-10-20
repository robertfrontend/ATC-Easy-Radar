import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Radio, Clock, AlertTriangle, Trophy, Trash2, MapPin, CheckCircle2, Play, Compass, Shield, Wind, Sparkles } from 'lucide-react';
import { Difficulty, SavedGame, Airport, RunwayConfig } from '../types';
import { AIRPORTS } from '../config/airports';
import { scopeColor } from '../theme/radarTheme';
import { SessionMode } from '../hooks/useGameLoop';
import { CHALLENGES, Challenge } from '../config/challenges';

interface HomePageProps {
  savedGames: SavedGame[];
  onNewGame: (difficulty: Difficulty, airportId: string, runwayConfig: RunwayConfig, mode?: SessionMode, goal?: number) => void;
  onDeleteGame: (id: string) => void;
  highScore: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; desc: string }> = {
  easy:   { label: 'EASY',   desc: 'Light traffic · forgiving approach cone' },
  medium: { label: 'MEDIUM', desc: 'Build up to a busy terminal' },
  hard:   { label: 'HARD',   desc: 'Build up to peak traffic · narrow ILS' },
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
  const [selectedGoal, setSelectedGoal] = useState(10);
  const [selectedMode, setSelectedMode] = useState<SessionMode>('shift');
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

  const chooseChallenge = (challenge: Challenge) => {
    setSelectedAirportId(challenge.airportId);
    setSelectedDifficulty(challenge.difficulty);
    setSelectedGoal(challenge.goal);
    setSelectedMode('shift');
  };

  const handleStartGame = () => {
    // Ensure at least one landing and departure runway is active
    let validConfig: RunwayConfig = { ...runwayConfig };
    const activeLandings = Object.values(validConfig).filter(c => c && c.landing);
    if (activeLandings.length === 0) {
      const firstRwyId = selectedAirport.runways[0].id;
      validConfig[firstRwyId] = { ...(validConfig[firstRwyId] || {}), landing: true, departure: true };
    }
    onNewGame(selectedMode === 'tutorial' ? 'easy' : selectedDifficulty, selectedAirportId, validConfig, selectedMode, selectedGoal);
  };

  return (
    <div className="min-h-screen bg-scope text-ink font-mono flex flex-col items-center justify-start p-4 md:p-8 select-none">
      {/* Top Slim Station Bar */}
      <div className="w-full max-w-6xl mb-6">
        <header className="h-12 bg-header border border-line rounded-lg px-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-bold text-ink-bright tracking-widest text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-phosphor" />
              ATC RADAR // SECTOR DISPATCH
            </span>
            <span className="text-ink-faint">|</span>
            <span className="text-ink-dim text-xs">RADAR SIMULATION v2.0</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-ink font-bold">{utcTime || '00:00:00Z'}</span>
            {highScore > 0 && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-ink-bright font-bold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-phosphor" /> BEST OPS: {highScore.toString().padStart(4, '0')}
                </span>
              </>
            )}
          </div>
        </header>
      </div>

      <Link to="/learning" className="w-full max-w-6xl mb-6 p-5 border border-line-strong rounded-lg bg-panel focus-visible:outline-2 focus-visible:outline-selected hover:border-phosphor">
        <span className="block text-lg font-bold text-ink-bright">Learning</span>
        <span className="block text-sm text-ink mt-1">Fundamentos del control radar, desde cero. Explicaciones en español y práctica guiada integrada.</span>
      </Link>
      <section aria-label="Choose your session" className="w-full max-w-6xl mb-6 grid gap-3 md:grid-cols-3">
        {([
          ['tutorial', '01 / LEARN THE RADAR', 'Guide one arrival, then practice separating two aircraft. No traffic rush while learning.'],
          ['shift', '02 / FIVE-MINUTE SHIFT', `Complete ${selectedGoal} safe operations. Earn clean-streak bonuses as traffic builds to your chosen level.`],
          ['free', '03 / FREE PLAY', 'Open-ended practice with your own airport, runways and traffic settings.'],
        ] as const).map(([mode, title, description]) => (
          <button key={mode} aria-pressed={selectedMode === mode} onClick={() => setSelectedMode(mode)} className={`p-4 rounded-lg border text-left ${selectedMode === mode ? 'border-phosphor bg-panel-raised' : 'border-line bg-panel hover:border-line-strong'}`}>
            <span className="block text-sm font-bold text-phosphor">{title}</span>
            <span className="block text-xs text-ink-dim mt-2 leading-relaxed">{description}</span>
          </button>
        ))}
      </section>

      {/* Main Grid: Sector Configuration (Left) & Radar Preview (Right) */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column — Sector Selection & Parameters (Col 7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Airport / Sector Selector */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-widest text-phosphor flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> 1. Select Control Sector (Airport)
              </span>
              <span className="text-[10px] text-ink-faint font-bold">{AIRPORTS.length} SECTORS READY</span>
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
                        ? 'bg-panel-raised border-phosphor text-ink-bright'
                        : 'bg-inset border-line text-ink-dim hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-ink-bright">{a.icao}</span>
                      <span className="text-base">{a.countryFlag}</span>
                    </div>
                    <div className="text-xs font-semibold mt-0.5 truncate text-ink">{a.name}</div>
                    <div className="text-[10px] text-ink-faint mt-1 flex items-center justify-between">
                      <span>{a.runways.length} RWYS</span>
                      <span>{a.waypoints.length} FIXES</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Multi-Runway ILS & Departure Configuration */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-phosphor flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> 2. Runway Operations & ILS
                </span>
                <span className="text-[10px] text-ink-dim font-bold">
                  ({landingRunways.length} ILS / {departureRunways.length} DEP)
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRunwayPreset('all-ils')}
                  className="px-2 py-0.5 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink transition-colors"
                >
                  ALL ILS
                </button>
                <button
                  onClick={() => setRunwayPreset('all-ops')}
                  className="px-2 py-0.5 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink transition-colors"
                >
                  FULL OPS
                </button>
                <button
                  onClick={() => setRunwayPreset('single')}
                  className="px-2 py-0.5 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink-dim transition-colors"
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
                    className="bg-inset border border-line rounded-lg p-2.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-ink-bright text-xs">
                        RWY {r.label} <span className="text-[10px] text-ink-faint font-normal">({r.heading.toString().padStart(3, '0')}°)</span>
                      </div>
                      <div className="text-[9px] text-ink-faint mt-0.5">
                        {isLanding && isDep ? 'ILS Landing & Takeoffs' : isLanding ? 'ILS Landing Only' : isDep ? 'Takeoffs Only' : 'Inactive Runway'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle ILS Landing */}
                      <button
                        onClick={() => toggleRunwayLanding(r.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                          isLanding
                            ? 'bg-ink-bright text-scope border-ink-bright'
                            : 'bg-scope border-line text-ink-faint hover:text-ink'
                        }`}
                        title="Toggle ILS Approach Landing"
                      >
                        ILS
                      </button>

                      {/* Toggle Departure */}
                      <button
                        onClick={() => toggleRunwayDeparture(r.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all ${
                          isDep
                            ? 'bg-ink-bright text-scope border-ink-bright'
                            : 'bg-scope border-line text-ink-faint hover:text-ink'
                        }`}
                        title="Toggle Departures"
                      >
                        DEP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Traffic Density (Difficulty) & Launch */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-widest text-phosphor flex items-center gap-1.5">
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
                        ? 'bg-ink-bright text-scope border-ink-bright'
                        : 'bg-inset border-line text-ink-dim hover:border-line-strong hover:text-ink'
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
              className="w-full py-4 bg-ink-bright hover:bg-phosphor active:scale-[0.99] text-scope font-bold tracking-widest rounded-lg transition-colors text-base flex items-center justify-center gap-2.5 group"
            >
              <span>{selectedMode === 'tutorial' ? 'START GUIDED TUTORIAL' : selectedMode === 'shift' ? 'START FIVE-MINUTE SHIFT' : 'START FREE PLAY'}</span>
              <Play className="w-4 h-4 fill-current group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column — Live Radar Sector Preview & Log (Col 5) */}
        <div className="lg:col-span-5 space-y-5">
          <section aria-label="Airport challenges" className="bg-panel border border-line rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-bold text-phosphor">AIRPORT CHALLENGES</h2>
            <p className="text-xs text-ink-dim">Choose a goal, then adjust your runway setup below. Every shift starts with light traffic.</p>
            <div className="grid grid-cols-2 gap-2">
              {CHALLENGES.map(challenge => <button key={challenge.id} onClick={() => chooseChallenge(challenge)} aria-pressed={selectedMode === 'shift' && selectedAirportId === challenge.airportId && selectedGoal === challenge.goal && selectedDifficulty === challenge.difficulty} className="text-left border border-line rounded p-3 hover:border-phosphor bg-inset">
                <strong className="block text-xs text-ink-bright">{challenge.title}</strong>
                <span className="block mt-1 text-[11px] text-ink-dim">{challenge.goal} operations · {challenge.difficulty}</span>
              </button>)}
            </div>
            <p className="text-xs text-phosphor">Current goal: {selectedGoal} safe operations in 5 minutes.</p>
          </section>
          {/* Authentic Mini Radar Preview Card */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line text-xs">
              <span className="font-bold text-ink uppercase tracking-widest flex items-center gap-2">
                <span className="text-phosphor">◉</span> Live Sector Scope Preview
              </span>
              <span className="text-phosphor font-bold">{selectedAirport.icao} / {selectedAirport.name}</span>
            </div>

            {/* Mini SVG Radar Display (Dynamic Multi-Runway ILS / DEP) */}
            <div className="w-full aspect-square bg-scope rounded-lg border border-line relative overflow-hidden flex items-center justify-center">
              <svg viewBox="0 0 1000 1000" className="w-full h-full p-2">
                {/* Sector Background Circle */}
                <circle cx="500" cy="500" r="470" fill={scopeColor.scopeDisk} stroke={scopeColor.line} strokeWidth="1.5" />
                
                {/* Range Rings */}
                <circle cx="500" cy="500" r="160" fill="none" stroke={scopeColor.phosphor} strokeDasharray="4,6" />
                <circle cx="500" cy="500" r="320" fill="none" stroke={scopeColor.phosphor} strokeDasharray="4,6" />
                <circle cx="500" cy="500" r="470" fill="none" stroke={scopeColor.phosphor} strokeWidth="1.2" />

                {/* Airspace Boundary Polygons */}
                {selectedAirport.airspacePolygons?.map(poly => (
                  <polygon
                    key={poly.id}
                    points={poly.points}
                    fill="none"
                    stroke={poly.dashed ? scopeColor.airspaceDim : scopeColor.airspace}
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
                      stroke={scopeColor.airspace}
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="-8"
                      fill={scopeColor.fixLabel}
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
                          <line x1="0" y1={halfLen} x2="0" y2="420" stroke={scopeColor.map} strokeWidth="2.5" />
                          {Array.from({ length: 10 }, (_, i) => {
                            const yPos = halfLen + (i + 1) * 36;
                            return (
                              <line key={i} x1="-12" y1={yPos} x2="12" y2={yPos} stroke={scopeColor.map} strokeWidth="1.8" />
                            );
                          })}
                          <line x1="-24" y1="420" x2="24" y2="420" stroke={scopeColor.map} strokeWidth="3" />
                        </>
                      )}

                      {/* Departure Line for Active Departure Runways */}
                      {isDep && (
                        <line x1="0" y1={-halfLen} x2="0" y2="-380" stroke={scopeColor.mapDim} strokeWidth="2" strokeDasharray="6,6" />
                      )}

                      {/* Subdued gray runway bar */}
                      <rect
                        x="-6"
                        y={-halfLen}
                        width="12"
                        height={rwyLength}
                        fill={isLanding || isDep ? scopeColor.runway : scopeColor.runwayIdle}
                        rx="1.5"
                      />
                      <line x1="0" y1={-halfLen + 4} x2="0" y2={halfLen - 4} stroke={scopeColor.centerline} strokeWidth="1.5" />
                    </g>
                  );
                })}

                {/* Waypoint Fixes (◎ Double Circle) */}
                {selectedAirport.waypoints.map(wp => (
                  <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
                    <circle cx="0" cy="0" r="7" fill="none" stroke={scopeColor.fix} strokeWidth="1.8" />
                    <circle cx="0" cy="0" r="2.5" fill={scopeColor.fix} />
                    <text x="12" y="5" fill={scopeColor.fixLabel} fontSize="16" fontFamily="monospace" fontWeight="bold">
                      {wp.label}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Scope Overlay Badge */}
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-ink-dim">
                <span className="text-phosphor font-bold">
                  ACTIVE ILS: {landingRunways.map(r => r.label).join(', ') || 'NONE'}
                </span>
                <span className="text-ink font-bold">
                  DEP: {departureRunways.map(r => r.label).join(', ') || 'NONE'}
                </span>
              </div>
            </div>
          </div>

          {/* Logged Sessions History */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line text-xs">
              <span className="font-bold text-ink uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-ink-dim" /> Previous Sessions
              </span>
              <span className="text-[10px] text-ink-faint font-bold">{savedGames.length} SAVED</span>
            </div>

            {savedGames.length === 0 ? (
              <div className="text-center text-ink-faint py-6 text-xs uppercase tracking-widest">
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
                      className="flex items-center justify-between bg-inset border border-line rounded px-3 py-2 text-xs group hover:border-line-strong transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-panel border border-line text-ink">
                          {info.label}
                        </span>
                        {game.gameSpeed === 'real' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-panel text-phosphor border border-line">
                            REAL 1:1
                          </span>
                        )}
                        <div>
                          <div className="font-bold text-ink-bright flex items-center gap-2">
                            <span>{gameAirport?.icao || 'SECT'}</span>
                            <span className="text-ink-faint text-[10px]">·</span>
                            <span className="text-phosphor font-bold">{game.score} OPS{game.points !== undefined ? ` · ${game.points} PTS` : ''}</span>
                            {game.accidents > 0 && <span className="text-conflict font-bold">· {game.accidents} ACCD</span>}
                          </div>
                          <div className="text-[10px] text-ink-faint">{formatDuration(game.savedAt)}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteGame(game.id)}
                        className="text-ink-faint hover:text-conflict p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
      <footer className="mt-10 mb-4 text-center text-xs text-ink-faint space-y-1">
        <div>
          ATC EASY RADAR · DEVELOPED BY{' '}
          <a
            href="https://github.com/robertfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink font-bold hover:text-phosphor transition-colors"
          >
            robertfrontend
          </a>
        </div>
      </footer>
    </div>
  );
};


