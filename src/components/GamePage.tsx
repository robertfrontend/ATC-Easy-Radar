import React, { useState, useEffect, useRef } from 'react';
import { Plane as PlaneIcon, Pause, Play, RotateCcw, Save, Home, Volume2, VolumeX } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import { RadarDisplay } from './RadarDisplay';
import { ControlPanel } from './ControlPanel';
import { Airport, Difficulty, SavedGame } from '../types';
import { audioManager } from '../utils/audio';

interface GamePageProps {
  airport: Airport;
  difficulty: Difficulty;
  highScore: number;
  onExit: () => void;
  onSave: (save: Omit<SavedGame, 'id' | 'savedAt'>) => void;
  onScoreUpdate: (score: number) => void;
}

export const GamePage: React.FC<GamePageProps> = ({ airport, difficulty, highScore, onExit, onSave, onScoreUpdate }) => {
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { planes, score, accidents, isPaused, togglePause, updatePlaneTarget, restart } = useGameLoop(airport, difficulty, gameSpeed);

  useEffect(() => {
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  const selectedPlane = planes.find(p => p.id === selectedId) || null;

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
    });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioManager.setMuted(newMuted);
  };

  const [commandInput, setCommandInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault(); // Prevent focus loss
      const tokens = commandInput.trim().toUpperCase().split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      
      if (lastToken) {
        const match = airport.waypoints.find(w => w.label.toUpperCase().startsWith(lastToken));
        if (match) {
          tokens[tokens.length - 1] = match.label.toUpperCase();
          setCommandInput(tokens.join(' ') + ' ');
        }
      }
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !commandInput.trim()) return;

    const fullCmd = commandInput.trim().toUpperCase();
    const updates: Partial<Plane> = {};
    let anyValid = false;

    // Calculate dynamic ILS entry point based on runway heading
    const rad = (airport.runwayHeading * Math.PI) / 180;
    const ilsEntry = {
      x: airport.x - 450 * Math.sin(rad),
      y: airport.y + 450 * Math.cos(rad)
    };

    // Special command: FINAL or ILS
    if (fullCmd.includes('FINAL') || fullCmd.includes('ILS')) {
      const angle = (Math.atan2(ilsEntry.y - selectedPlane!.y, ilsEntry.x - selectedPlane!.x) * 180 / Math.PI) + 90;
      updates.targetHeading = (angle + 360) % 360;
      updates.targetWaypoint = null;
      anyValid = true;
    }

    // 1. Parse Waypoints
    const tokens = fullCmd.split(/\s+/);
    tokens.forEach(token => {
      const wp = airport.waypoints.find(w => w.label.toUpperCase() === token);
      if (wp) {
        updates.targetWaypoint = wp.id;
        anyValid = true;
      }
    });

    // 2. Parse prefixed commands using Regex (handles spaces like "D 3000")
    const cmdRegex = /([CDHS])\s?(\d+)/g;
    let match;
    while ((match = cmdRegex.exec(fullCmd)) !== null) {
      const prefix = match[1];
      const val = parseInt(match[2]);

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

  const ilsEntry = {
    x: airport.x - 450 * Math.sin((airport.runwayHeading * Math.PI) / 180),
    y: airport.y + 450 * Math.cos((airport.runwayHeading * Math.PI) / 180)
  };

  return (
    <div className="flex h-screen bg-slate-900 text-green-400 font-mono overflow-hidden selection:bg-green-500/30">
      {/* Main Radar Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-widest">
              <PlaneIcon className="text-green-500" />
              ✈️ ATC RADAR
            </h1>
            <div className="text-sm opacity-80 mt-1">{airport.name} ({airport.icao}) - LOCAL CONTROL</div>
          </div>
          <div className="flex items-center gap-6 pointer-events-auto">
            <div className="bg-slate-950/80 p-3 rounded border border-green-500/30 backdrop-blur-sm flex flex-col gap-1">
              <label className="text-xs text-green-500 font-bold">SIM SPEED</label>
              <div className="flex gap-1">
                {[0.5, 1, 2, 5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setGameSpeed(speed)}
                    className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${gameSpeed === speed ? 'bg-green-500 text-slate-950 border-green-500' : 'bg-slate-900 text-green-500 border-green-500/50 hover:border-green-400'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
            
            <div className="text-right bg-slate-950/80 p-4 rounded border border-green-500/30 backdrop-blur-sm">
              <div className="text-3xl font-bold text-white">{score.toString().padStart(5, '0')}</div>
              <div className="text-xs opacity-70">SCORE</div>
              <div className="text-sm mt-2 text-green-500">HI: {highScore.toString().padStart(5, '0')}</div>
            </div>

            <div className="text-right bg-slate-950/80 p-4 rounded border border-red-500/30 backdrop-blur-sm">
              <div className="text-3xl font-bold text-red-500">{accidents.toString().padStart(3, '0')}</div>
              <div className="text-xs text-red-400 opacity-70">ACCIDENTS</div>
            </div>

            <button
              onClick={togglePause}
              className={`p-2 rounded border backdrop-blur-sm flex items-center justify-center transition-colors ${
                isPaused
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500 hover:bg-yellow-500/30'
                  : 'bg-slate-950/80 border-green-500/30 text-green-500 hover:border-green-400'
              }`}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleMute}
              className={`p-2 rounded border backdrop-blur-sm flex items-center justify-center transition-colors ${
                isMuted
                  ? 'bg-red-500/20 border-red-500 text-red-500'
                  : 'bg-slate-950/80 border-green-500/30 text-green-500 hover:border-green-400'
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={handleSaveGame}
              title="Save game"
              className={`p-2 rounded border backdrop-blur-sm flex items-center justify-center transition-colors ${
                saveFlash
                  ? 'bg-sky-500/30 border-sky-400 text-sky-300'
                  : 'bg-slate-950/80 border-sky-500/30 text-sky-500 hover:border-sky-400 hover:bg-sky-500/10'
              }`}
            >
              <Save className="w-5 h-5" />
            </button>

            <button
              onClick={() => { restart(); setSelectedId(null); }}
              className="p-2 rounded border backdrop-blur-sm flex items-center justify-center transition-colors bg-slate-950/80 border-red-500/30 text-red-500 hover:border-red-400 hover:bg-red-500/10"
              title="Restart game"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={onExit}
              className="p-2 rounded border backdrop-blur-sm flex items-center justify-center transition-colors bg-slate-950/80 border-green-500/20 text-green-500/60 hover:border-green-500/50 hover:text-green-400"
              title="Go to home"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Radar Container */}
        <div className="flex-1 w-full relative bg-[#020817] border-t border-green-500/20 overflow-hidden">
          <RadarDisplay
            airport={airport}
            planes={planes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            ilsEntry={ilsEntry}
          />

          {/* Command Console Input */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-auto">
            <form onSubmit={handleCommandSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-green-500/20 rounded blur opacity-75 group-hover:opacity-100 transition duration-1000 group-focus-within:bg-green-500/40"></div>
              <div className="relative flex items-center bg-slate-950 border border-green-500/30 rounded px-4 py-3 shadow-2xl">
                <span className="text-green-500 font-bold mr-3 animate-pulse">
                  {selectedPlane ? selectedPlane.callsign : 'SYS'}&gt;
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedPlane ? "C5000, D2000, H090, S210, ALPHA..." : "SELECT AIRCRAFT..."}
                  disabled={!selectedId}
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-green-900/50 uppercase tracking-widest text-lg disabled:cursor-not-allowed"
                />
                {commandInput && (
                  <div className="text-[10px] text-green-500/40 absolute right-4 bottom-1 font-bold">PRESS ENTER TO TX</div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center z-50">
            <div className="text-6xl font-bold text-yellow-500 tracking-[0.3em] mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
              PAUSED
            </div>
            <button
              onClick={togglePause}
              className="px-8 py-4 bg-yellow-500 text-slate-950 font-bold text-xl rounded border-2 border-yellow-400 hover:bg-yellow-400 transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(234,179,8,0.3)]"
            >
              RESUME SESSION
            </button>
          </div>
        )}
      </div>

      {/* Side Panel */}
      <div className="w-96 bg-slate-950 border-l border-green-500/20 p-6 flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <ControlPanel airport={airport} plane={selectedPlane} onCommand={updatePlaneTarget} onDeselect={() => setSelectedId(null)} />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};
