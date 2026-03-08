import React from 'react';
import { Plane, Radio, Clock, AlertTriangle, Trophy, Trash2, MapPin, CheckCircle2 } from 'lucide-react';
import { Difficulty, SavedGame } from '../types';
import { AIRPORTS } from '../config/airports';

interface HomePageProps {
  savedGames: SavedGame[];
  onNewGame: (difficulty: Difficulty, airportId: string, runwayIndex: number) => void;
  onDeleteGame: (id: string) => void;
  highScore: number;
}

const DIFFICULTY_INFO: Record<Difficulty, { label: string; color: string; spawnRate: string }> = {
  easy:   { label: 'EASY',   color: 'text-green-400',  spawnRate: 'Chill Load' },
  medium: { label: 'MEDIUM', color: 'text-yellow-400', spawnRate: 'Steady Load' },
  hard:   { label: 'HARD',   color: 'text-red-400',    spawnRate: 'Heavy Load' },
};

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<Difficulty>('easy');
  const [selectedAirportId, setSelectedAirportId] = React.useState<string>(AIRPORTS[0].id);
  const [selectedRunwayIndex, setSelectedRunwayIndex] = React.useState<number>(0);

  const selectedAirport = AIRPORTS.find(a => a.id === selectedAirportId) || AIRPORTS[0];

  // Reset runway index when airport changes
  React.useEffect(() => {
    setSelectedRunwayIndex(0);
  }, [selectedAirportId]);

  return (
    <div className="min-h-screen bg-slate-900 text-green-400 font-mono flex flex-col items-center justify-start p-8 selection:bg-green-500/30">
      {/* Header */}
      <div className="w-full max-w-5xl">
        <div className="flex items-center gap-4 mb-2">
          <div className="relative">
            <Plane className="w-10 h-10 text-green-500" />
            <Radio className="w-4 h-4 text-green-300 absolute -bottom-1 -right-1" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-widest">✈️ ATC RADAR</h1>
            <div className="text-sm text-green-500/70 tracking-widest">SECTOR CONTROL</div>
          </div>
          {highScore > 0 && (
            <div className="ml-auto flex items-center gap-2 bg-slate-950 border border-yellow-500/30 rounded px-4 py-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <div>
                <div className="text-xs text-yellow-500/70">ALL-TIME HIGH</div>
                <div className="text-xl font-bold text-yellow-400">{highScore.toString().padStart(5, '0')}</div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-green-500/20 mt-4 mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column — Selection (Col 7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-6">
              <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase">Mission Briefing</h2>

              {/* Airport picker */}
              <div className="space-y-2">
                <label className="text-xs text-green-500/70 tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> SELECT AIRPORT
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AIRPORTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAirportId(a.id)}
                      className={`py-3 px-4 rounded border text-left transition-all ${
                        selectedAirportId === a.id
                          ? 'bg-green-500/20 border-green-500 text-white ring-1 ring-green-500/50'
                          : 'bg-slate-900 border-green-500/10 text-green-500/60 hover:border-green-500/30'
                      }`}
                    >
                      <div className="font-bold text-sm flex items-center gap-2">
                        <span>{a.countryFlag}</span>
                        <span>{a.name}</span>
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">{a.icao} · {a.runways.length} Runways</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Runway picker */}
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                <label className="text-xs text-green-500/70 tracking-wider flex items-center gap-1">
                  <Radio className="w-3 h-3" /> ACTIVE RUNWAY CONFIGURATION
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedAirport.runways.map((r, idx) => (
                    <button
                      key={r.label}
                      onClick={() => setSelectedRunwayIndex(idx)}
                      className={`py-3 px-2 rounded border text-center transition-all flex flex-col items-center gap-1 ${
                        selectedRunwayIndex === idx
                          ? 'bg-sky-500/20 border-sky-500 text-white ring-1 ring-sky-500/50'
                          : 'bg-slate-900 border-green-500/10 text-green-500/60 hover:border-sky-500/30'
                      }`}
                    >
                      <div className="font-bold text-sm">RWY {r.label}</div>
                      <div className="text-[10px] opacity-60">Hdg {r.heading.toString().padStart(3, '0')}°</div>
                      {selectedRunwayIndex === idx && <CheckCircle2 className="w-3 h-3 text-sky-400 mt-1" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                {/* Difficulty picker */}
                <div className="space-y-2">
                  <label className="text-xs text-green-500/70 tracking-wider">DIFFICULTY</label>
                  <div className="flex flex-col gap-2">
                    {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map(d => {
                      const info = DIFFICULTY_INFO[d];
                      const active = selectedDifficulty === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedDifficulty(d)}
                          className={`py-2 px-3 rounded border text-left transition-colors flex justify-between items-center ${
                            active
                              ? 'bg-green-500/20 border-green-500 text-white'
                              : 'bg-slate-900 border-green-500/10 text-green-500/60 hover:border-green-500/30'
                          }`}
                        >
                          <span className="font-bold text-xs">{info.label}</span>
                          <span className="text-[10px] opacity-50">{info.spawnRate}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Button Container */}
                <div className="flex flex-col justify-end">
                  <button
                    onClick={() => onNewGame(selectedDifficulty, selectedAirportId, selectedRunwayIndex)}
                    className="w-full h-full max-h-[100px] bg-green-500/20 hover:bg-green-500/30 border border-green-500 text-green-400 font-bold tracking-widest rounded transition-all active:scale-95 text-lg flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                  >
                    <span>START</span>
                    <Radio className="w-5 h-5 group-hover:animate-pulse" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-3">
              <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase">Operational Manual</h2>
              <ul className="text-[11px] text-green-400/70 space-y-2 leading-relaxed">
                <li><span className="text-green-300 font-bold">Commands:</span> Use console at the bottom or right panel</li>
                <li><span className="text-green-300 font-bold">Multi-Command:</span> E.g. <code className="bg-slate-900 px-1 py-0.5 rounded text-white">D3000 H090 DELTA</code> (Descend, Turn, Waypoint)</li>
                <li><span className="text-green-300 font-bold">Final Approach:</span> Type <code className="bg-slate-900 px-1 py-0.5 rounded text-white">FINAL</code> to intercept ILS entry point</li>
                <li><span className="text-green-300 font-bold">Autocomplete:</span> Press <kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">TAB</kbd> to complete waypoint names</li>
                <li><span className="text-green-300 font-bold">Auto-Landing:</span> Capture ILS while below 3000ft and aligned with runway</li>
              </ul>
              <div className="pt-2 border-t border-green-500/10 flex items-start gap-2 text-[10px] text-orange-400/70 italic">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Separation: Maintain at least 1000ft altitude or 20px lateral distance between aircraft.</span>
              </div>
            </div>
          </div>

          {/* Right Column — History (Col 5) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-4 flex-1">
              <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase flex items-center gap-2">
                <Clock className="w-4 h-4" /> Logged Sessions
              </h2>

              {savedGames.length === 0 ? (
                <div className="text-center text-green-500/20 py-20 text-xs uppercase tracking-widest">
                  <Radio className="w-8 h-8 mx-auto mb-4 opacity-20" />
                  No data logs available
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin scrollbar-thumb-green-500/20">
                  {[...savedGames].sort((a, b) => b.savedAt - a.savedAt).map(game => {
                    const info = DIFFICULTY_INFO[game.difficulty];
                    const gameAirport = AIRPORTS.find(a => a.id === game.airportId);
                    return (
                      <div
                        key={game.id}
                        className="flex items-center gap-3 bg-slate-900 border border-green-500/10 rounded px-4 py-3 hover:border-green-500/30 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold ${info.color}`}>{info.label}</span>
                            <span className="text-green-500/30 text-xs">·</span>
                            <span className="text-green-500/50 text-[10px] font-bold">{gameAirport?.icao || 'KXXX'}</span>
                            <span className="text-green-500/30 text-xs">·</span>
                            <span className="text-green-500/50 text-[10px]">{formatDuration(game.savedAt)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-white font-bold">{game.score.toString().padStart(3, '0')}</span>
                              <span className="text-green-500/50 text-[10px] ml-1">LANDED</span>
                            </div>
                            <div>
                              <span className={`font-bold ${game.accidents > 0 ? 'text-red-400' : 'text-green-400'}`}>{game.accidents}</span>
                              <span className="text-green-500/50 text-[10px] ml-1">ACCD</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteGame(game.id)}
                          className="text-red-500/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 mb-4 text-center space-y-2">
          <p className="text-green-500/40 text-sm tracking-widest uppercase">
            Developed with <span className="text-red-500/60 mx-1">❤️</span> by{' '}
            <a 
              href="https://github.com/robertfrontend" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-400/60 font-bold hover:text-green-400 transition-colors"
            >
              robertfrontend
            </a>
          </p>
          <p className="text-[10px] text-green-500/30 tracking-[0.2em] uppercase">
            This project is a public repository on{' '}
            <a 
              href="https://github.com/robertfrontend/ATC-Easy-Radar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-green-500/50 transition-colors underline decoration-green-500/20"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
