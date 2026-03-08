import React, { useState, useEffect } from 'react';
import { Plane as PlaneIcon, Pause, Play, RotateCcw, Save, Home, Volume2, VolumeX } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import { RadarDisplay } from './RadarDisplay';
import { ControlPanel } from './ControlPanel';
import { Airport, Difficulty, SavedGame } from '../types';
import { audioManager } from '../utils/audio';

interface GamePageProps {
  airport: Airport;
  difficulty: Difficulty;
  onExit: () => void;
  onSave: (save: Omit<SavedGame, 'id' | 'savedAt'>) => void;
}

export const GamePage: React.FC<GamePageProps> = ({ airport, difficulty, onExit, onSave }) => {
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  
  const { planes, score, accidents, isPaused, togglePause, updatePlaneTarget, restart } = useGameLoop(airport, difficulty, gameSpeed);

  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('atc_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('atc_highscore', score.toString());
    }
  }, [score, highScore]);

  const selectedPlane = planes.find(p => p.id === selectedId) || null;

  // Deselect if plane is removed
  useEffect(() => {
    if (selectedId && !planes.find(p => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [planes, selectedId]);

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

  return (
    <div className="flex h-screen bg-slate-900 text-green-400 font-mono overflow-hidden selection:bg-green-500/30">
      {/* Main Radar Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-widest">
              <PlaneIcon className="text-green-500" />
              ATC RADAR
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
            onSetHeading={(id, heading) => {
              updatePlaneTarget(id, { targetHeading: heading, targetWaypoint: null });
              setSelectedId(null);
            }}
            onSetWaypoint={(id, wpId) => {
              updatePlaneTarget(id, { targetWaypoint: wpId });
              setSelectedId(null);
            }}
          />
        </div>

        {/* Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
            <div className="text-6xl font-bold text-yellow-500 tracking-widest opacity-80">
              PAUSED
            </div>
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
