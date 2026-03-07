import React, { useState, useEffect } from 'react';
import { useGameLoop, Difficulty } from './hooks/useGameLoop';
import { RadarDisplay } from './components/RadarDisplay';
import { ControlPanel } from './components/ControlPanel';
import { Plane as PlaneIcon, Pause, Play, RotateCcw } from 'lucide-react';

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const { planes, score, accidents, isPaused, togglePause, updatePlaneTarget, restart } = useGameLoop(difficulty, gameSpeed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
            <div className="text-sm opacity-80 mt-1">SECTOR 4 - LOCAL CONTROL</div>
          </div>
          <div className="flex items-center gap-6 pointer-events-auto">
            <div className="bg-slate-950/80 p-3 rounded border border-green-500/30 backdrop-blur-sm flex flex-col gap-1">
              <label className="text-xs text-green-500 font-bold">SIM SPEED</label>
              <div className="flex gap-1">
                {[1, 2, 5].map(speed => (
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
            <div className="bg-slate-950/80 p-3 rounded border border-green-500/30 backdrop-blur-sm flex flex-col gap-1">
              <label className="text-xs text-green-500 font-bold">DIFFICULTY</label>
              <select 
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="bg-slate-900 text-white border border-green-500/50 rounded px-2 py-1 outline-none cursor-pointer hover:border-green-400"
              >
                <option value="easy">EASY (1 min)</option>
                <option value="medium">MEDIUM (30 sec)</option>
                <option value="hard">HARD (15 sec)</option>
              </select>
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
              className={`p-4 rounded border backdrop-blur-sm flex items-center justify-center transition-colors ${
                isPaused
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500 hover:bg-yellow-500/30'
                  : 'bg-slate-950/80 border-green-500/30 text-green-500 hover:border-green-400'
              }`}
            >
              {isPaused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
            </button>

            <button
              onClick={() => { restart(); setSelectedId(null); }}
              className="p-4 rounded border backdrop-blur-sm flex items-center justify-center transition-colors bg-slate-950/80 border-red-500/30 text-red-500 hover:border-red-400 hover:bg-red-500/10"
              title="Restart game"
            >
              <RotateCcw className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Radar Container */}
        <div className="flex-1 w-full relative bg-[#020817] border-t border-green-500/20 overflow-hidden">
          <RadarDisplay 
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
        <ControlPanel plane={selectedPlane} onCommand={updatePlaneTarget} onDeselect={() => setSelectedId(null)} />
      </div>

      {/* Add custom keyframes for sweep */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
