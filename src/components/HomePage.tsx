import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Radio, Clock, Trophy, Trash2, MapPin, Shield } from 'lucide-react';
import { Difficulty, SavedGame, RunwayConfig } from '../types';
import { AIRPORTS } from '../config/airports';
import { SectorPreview } from './SectorPreview';
import { BostonBackdrop } from './BostonBackdrop';
import { SessionMode } from '../hooks/useGameLoop';
import { getGeographicAirport } from '../geography/kbos';
import { toMagneticHeading } from '../geography/headings';

interface HomePageProps {
  savedGames: SavedGame[];
  onNewGame: (difficulty: Difficulty, airportId: string, runwayConfig: RunwayConfig, mode?: SessionMode, goal?: number) => void;
  onDeleteGame: (id: string) => void;
  highScore: number;
  setup: HomeSetup;
  setSetup: React.Dispatch<React.SetStateAction<HomeSetup>>;
}

export interface HomeSetup {
  selectedGoal: number;
  selectedMode: 'free' | 'shift';
  selectedDifficulty: Difficulty;
  selectedAirportId: string;
  runwayConfig: RunwayConfig;
}

function defaultRunways(airportId: string): RunwayConfig {
  const airport = AIRPORTS.find(a => a.id === airportId) || AIRPORTS[0];
  return Object.fromEntries(airport.runways.map((r, i) => [r.id, { landing: i === 0, departure: i === 0 }]));
}

export function initialHomeSetup(): HomeSetup {
  return { selectedGoal: 10, selectedMode: 'free', selectedDifficulty: 'easy',
    selectedAirportId: AIRPORTS[0].id, runwayConfig: defaultRunways(AIRPORTS[0].id) };
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

export const HomePage: React.FC<HomePageProps> = ({ savedGames, onNewGame, onDeleteGame, highScore, setup, setSetup }) => {
  const { selectedGoal, selectedMode, selectedDifficulty, selectedAirportId, runwayConfig } = setup;
  const [utcTime, setUtcTime] = useState('');
  const [searchParams] = useSearchParams();
  const preparing = searchParams.get('setup') === 'free';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const freeLinkRef = useRef<HTMLAnchorElement>(null);
  const previousPreparation = useRef(preparing);
  const selectedAirport = getGeographicAirport(AIRPORTS.find(a => a.id === selectedAirportId) || AIRPORTS[0]);
  const setRunwayConfig = (value: React.SetStateAction<RunwayConfig>) => setSetup(prev => ({ ...prev,
    runwayConfig: typeof value === 'function' ? value(prev.runwayConfig) : value }));
  const setSelectedAirportId = (id: string) => setSetup(prev => id === prev.selectedAirportId ? prev : ({
    ...prev, selectedAirportId: id, runwayConfig: defaultRunways(id) }));

  useEffect(() => {
    if (preparing) headingRef.current?.focus();
    else if (previousPreparation.current) freeLinkRef.current?.focus();
    previousPreparation.current = preparing;
  }, [preparing]);

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
    onNewGame(selectedDifficulty, selectedAirportId, validConfig, selectedMode, selectedGoal);
  };

  return (
    <div className="home-page min-h-screen bg-scope text-ink font-mono flex flex-col items-center justify-start p-4 md:p-8 select-none">
      {/* Top Slim Station Bar */}
      <div className="w-full max-w-6xl mb-6">
        <header className="min-h-12 gap-3 flex-wrap py-3 bg-header border border-line rounded-lg px-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-bold text-ink-bright tracking-widest text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-phosphor" />
              ATC RADAR <span className="hidden md:inline">// SECTOR DISPATCH</span>
            </span>
            <span className="hidden lg:inline text-ink-faint">|</span>
            <span className="hidden lg:inline text-ink-dim text-xs">RADAR SIMULATION v2.0</span>
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

      <main className="w-full max-w-6xl">
        {preparing && <h1 ref={headingRef} tabIndex={-1} className="text-xl md:text-3xl font-bold text-ink-bright mb-3">Prepare free play</h1>}
        {!preparing ? <>
          <section className="landing-hero">
            <BostonBackdrop />
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span aria-hidden="true">◉</span> SIMULADOR DE CONTROL AÉREO <span className="landing-eyebrow-divider">/</span> {selectedAirport.icao}</p>
              <h1>Toma el control del radar</h1>
              <p className="landing-intro">Ordena el tráfico, guía cada aproximación y mantén el cielo en movimiento.</p>
              <div className="landing-sector-meta" aria-label="Sector seleccionado">
                <span className="landing-live-dot" aria-hidden="true" />
                <span>SECTOR ACTIVO</span>
                <strong>{selectedAirport.name}</strong>
                <span aria-hidden="true">·</span>
                <span>{selectedAirport.runways.length} pistas</span>
              </div>
              <button className="landing-tutorial min-h-11"
                onClick={() => onNewGame('easy', AIRPORTS[0].id, defaultRunways(AIRPORTS[0].id), 'tutorial', 10)}>
                ¿Primera vez? Aprende los controles
              </button>
            </div>
          </section>
          <nav aria-label="Choose an experience" className="landing-experiences">
            <Link ref={freeLinkRef} aria-label="Jugar libre" to="/?setup=free" className="landing-experience landing-experience-primary">
              <span className="landing-experience-index">01 / PRÁCTICA</span>
              <span className="landing-experience-title">Jugar libre</span>
              <span className="landing-experience-description">Configura el aeropuerto, las pistas y la densidad de tráfico a tu ritmo.</span>
              <span className="landing-experience-action">Iniciar práctica <span aria-hidden="true">→</span></span>
            </Link>
            <Link aria-label="Retos" to="/challenges" className="landing-experience">
              <span className="landing-experience-index">02 / PROGRESO</span>
              <span className="landing-experience-title">Retos</span>
              <span className="landing-experience-description">Supera 120 niveles de cinco minutos en seis aeropuertos.</span>
              <span className="landing-experience-action">Ver retos <span aria-hidden="true">→</span></span>
            </Link>
            <Link aria-label="Learning" to="/learning" className="landing-experience">
              <span className="landing-experience-index">03 / APRENDIZAJE</span>
              <span className="landing-experience-title">Learning</span>
              <span className="landing-experience-description">Aprende control radar con lecciones en español y práctica guiada.</span>
              <span className="landing-experience-action">Explorar lecciones <span aria-hidden="true">→</span></span>
            </Link>
          </nav>
        </> : <>
          <div className="home-launch sticky top-0 z-10 bg-header border border-line rounded-lg p-3 mb-5 flex flex-wrap items-center gap-3">
            <Link to="/" className="min-h-11 px-3 flex items-center rounded border border-line hover:border-phosphor">Cancel</Link>
            <span className="text-xs text-ink-dim flex-1">{selectedAirport.icao} · {DIFFICULTY_CONFIG[selectedDifficulty].label}</span>
            <button onClick={handleStartGame} className="min-h-11 px-4 py-3 rounded bg-ink-bright text-scope font-bold hover:bg-phosphor">
              {selectedMode === 'shift' ? 'START FIVE-MINUTE SHIFT' : 'START FREE PLAY'}
            </button>
          </div>

      {/* Main Grid: Sector Configuration (Left) & Radar Preview (Right) */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column — Sector Selection & Parameters (Col 7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Airport / Sector Selector */}
          <div className="bg-panel border border-line rounded-lg p-5 space-y-3.5">
            <div className="flex flex-wrap gap-3 items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold uppercase tracking-widest text-phosphor flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> 1. Select Control Sector (Airport)
              </span>
              <span className="text-[10px] text-ink-faint font-bold">{AIRPORTS.length} SECTORS READY</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AIRPORTS.map(getGeographicAirport).map(a => {
                const isSelected = selectedAirportId === a.id;
                return (
                  <button
                    key={a.id}
                    aria-pressed={isSelected}
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
            <div className="flex flex-wrap gap-3 items-center justify-between pb-2 border-b border-line">
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
                        RWY {r.label} <span className="text-[10px] text-ink-faint font-normal">({Math.round(toMagneticHeading(r.heading, selectedAirport)).toString().padStart(3, '0')}°)</span>
                      </div>
                      <div className="text-[9px] text-ink-faint mt-0.5">
                        {isLanding && isDep ? 'ILS Landing & Takeoffs' : isLanding ? 'ILS Landing Only' : isDep ? 'Takeoffs Only' : 'Inactive Runway'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle ILS Landing */}
                      <button
                        aria-pressed={isLanding}
                        aria-label={`Runway ${r.label} ILS`}
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
                        aria-pressed={isDep}
                        aria-label={`Runway ${r.label} departures`}
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
            <div className="flex flex-wrap gap-3 items-center justify-between pb-2 border-b border-line">
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
                    aria-pressed={active}
                    onClick={() => setSetup(prev => ({ ...prev, selectedDifficulty: d }))}
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

            <fieldset className="border-t border-line pt-4 space-y-3">
              <legend className="text-xs font-bold text-ink">Session length</legend>
              <div className="flex flex-wrap gap-2">
                {(['free', 'shift'] as const).map(mode => <button key={mode} aria-pressed={selectedMode === mode}
                  onClick={() => setSetup(prev => ({ ...prev, selectedMode: mode }))}
                  className={`min-h-11 px-3 rounded border ${selectedMode === mode ? 'border-phosphor text-phosphor' : 'border-line text-ink'}`}>
                  {mode === 'free' ? 'Open-ended free play' : 'Five-minute shift'}
                </button>)}
              </div>
              <p className="text-xs text-ink-dim">Optional quick shift with your own settings. This does not unlock Retos levels.</p>
              {selectedMode === 'shift' && <label className="flex items-center gap-3 text-sm">
                Safe operations goal
                <input type="number" min={1} max={30} value={selectedGoal}
                  onChange={event => { const goal = Number(event.target.value); if (Number.isInteger(goal) && goal >= 1 && goal <= 30) setSetup(prev => ({ ...prev, selectedGoal: goal })); }}
                  className="w-20 min-h-11 bg-inset border border-line rounded px-2" />
              </label>}
            </fieldset>
          </div>
        </div>

        {/* Right Column — Static Radar Sector Preview (Col 5) */}
        <div className="lg:col-span-5 space-y-5">
          <SectorPreview airport={selectedAirport} runwayConfig={runwayConfig} />

        </div>
      </div>
        </>}
          {/* Logged Sessions History */}
          <details className="mt-6 bg-panel border border-line rounded-lg p-5 space-y-3">
            <summary className="cursor-pointer text-xs text-ink min-h-11 flex items-center justify-between">
              <span className="font-bold text-ink uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-ink-dim" /> Previous Sessions
              </span>
              <span className="text-[10px] text-ink-faint font-bold">{savedGames.length} SAVED</span>
            </summary>

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
                        className="text-ink-faint hover:text-conflict p-3 transition-colors"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
      </main>

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


