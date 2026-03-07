import React from 'react';
import { Plane, Radio, Clock, AlertTriangle, Trophy, Trash2, MapPin } from 'lucide-react';
import { Difficulty, SavedGame } from '../types';
import { AIRPORTS } from '../config/airports';

interface HomePageProps {
  savedGames: SavedGame[];
  onNewGame: (difficulty: Difficulty, airportId: string) => void;
  onDeleteGame: (id: string) => void;
  highScore: number;
}

const DIFFICULTY_INFO: Record<Difficulty, { label: string; color: string; spawnRate: string }> = {
  easy:   { label: 'EASY',   color: 'text-green-400',  spawnRate: '60s spawn' },
  medium: { label: 'MEDIUM', color: 'text-yellow-400', spawnRate: '30s spawn' },
  hard:   { label: 'HARD',   color: 'text-red-400',    spawnRate: '15s spawn' },
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

  return (
    <div className="min-h-screen bg-slate-900 text-green-400 font-mono flex flex-col items-center justify-start p-8 selection:bg-green-500/30">
      {/* Header */}
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-4 mb-2">
          <div className="relative">
            <Plane className="w-10 h-10 text-green-500" />
            <Radio className="w-4 h-4 text-green-300 absolute -bottom-1 -right-1" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-widest">ATC RADAR</h1>
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

        {/* Divider */}
        <div className="border-t border-green-500/20 mt-4 mb-8" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left — New Game */}
          <div className="space-y-6">
            <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-5">
              <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase">New Session</h2>

              {/* Airport picker */}
              <div className="space-y-2">
                <label className="text-xs text-green-500/70 tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> AIRPORT SECTOR
                </label>
                <div className="space-y-2">
                  {AIRPORTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAirportId(a.id)}
                      className={`w-full py-3 px-4 rounded border text-left transition-colors flex items-center justify-between ${
                        selectedAirportId === a.id
                          ? 'bg-green-500/20 border-green-500 text-white'
                          : 'bg-slate-900 border-green-500/20 text-green-500/60 hover:border-green-500/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm">{a.name}</div>
                        <div className="text-xs opacity-60 mt-0.5">{a.icao} · RWY {a.runwayLabel} ({a.runwayHeading.toString().padStart(3, '0')}°)</div>
                      </div>
                      {selectedAirportId === a.id && <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty picker */}
              <div className="space-y-2">
                <label className="text-xs text-green-500/70 tracking-wider">DIFFICULTY</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map(d => {
                    const info = DIFFICULTY_INFO[d];
                    const active = selectedDifficulty === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDifficulty(d)}
                        className={`py-3 px-2 rounded border text-center transition-colors ${
                          active
                            ? 'bg-green-500/20 border-green-500 text-white'
                            : 'bg-slate-900 border-green-500/20 text-green-500/60 hover:border-green-500/50'
                        }`}
                      >
                        <div className={`font-bold text-sm ${active ? info.color : ''}`}>{info.label}</div>
                        <div className="text-xs opacity-60 mt-1">{info.spawnRate}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => onNewGame(selectedDifficulty, selectedAirportId)}
                className="w-full py-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500 text-green-400 font-bold tracking-widest rounded transition-colors active:bg-green-500/40 text-lg"
              >
                INITIATE SESSION
              </button>
            </div>

            {/* How to play */}
            <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-3">
              <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase">How To Play</h2>
              <ul className="text-xs text-green-400/70 space-y-2 leading-relaxed">
                <li><span className="text-green-300">Click aircraft</span> on radar to select it</li>
                <li><span className="text-green-300">Set heading, altitude, speed</span> in the right panel and transmit</li>
                <li><span className="text-green-300">Guide planes</span> to the airport (center) to score points</li>
                <li><span className="text-green-300">Landing requirements:</span> Aligned with RWY, Alt ≤3000ft, Spd ≤200kts</li>
                <li><span className="text-green-300">Waypoints</span> can be used to redirect traffic</li>
                <li><span className="text-green-300">GO AROUND</span> if an established plane is in danger</li>
              </ul>
              <div className="pt-2 border-t border-green-500/10 flex items-start gap-2 text-xs text-orange-400/70">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Aircraft within 20px and 1000ft separation will collide — avoid conflicts!</span>
              </div>
            </div>
          </div>

          {/* Right — Game History */}
          <div className="bg-slate-950 border border-green-500/20 rounded p-6 space-y-4">
            <h2 className="text-sm font-bold tracking-widest text-green-300 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4" /> Saved Sessions
            </h2>

            {savedGames.length === 0 ? (
              <div className="text-center text-green-500/30 py-12 text-sm">
                <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
                No saved sessions yet.<br />Start a new game and save your progress.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
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
                          <span className={`text-xs font-bold ${info.color}`}>{info.label}</span>
                          <span className="text-green-500/30 text-xs">·</span>
                          <span className="text-green-500/50 text-xs">{gameAirport?.icao || 'KXXX'}</span>
                          <span className="text-green-500/30 text-xs">·</span>
                          <span className="text-green-500/50 text-xs">{formatDuration(game.savedAt)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-white font-bold">{game.score.toString().padStart(3, '0')}</span>
                            <span className="text-green-500/50 text-xs ml-1">pts</span>
                          </div>
                          <div>
                            <span className={`font-bold ${game.accidents > 0 ? 'text-red-400' : 'text-green-400'}`}>{game.accidents}</span>
                            <span className="text-green-500/50 text-xs ml-1">acc</span>
                          </div>
                          <div>
                            <span className="text-sky-400 font-bold">{game.planesActive}</span>
                            <span className="text-green-500/50 text-xs ml-1">active</span>
                          </div>
                        </div>
                        <div className="text-green-500/30 text-xs mt-1">{formatDate(game.savedAt)}</div>
                      </div>
                      <button
                        onClick={() => onDeleteGame(game.id)}
                        className="text-red-500/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        title="Delete session"
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
    </div>
  );
};
