import React, { useState, useEffect } from 'react';
import { useGameLoop, Difficulty } from './hooks/useGameLoop';
import { RadarDisplay } from './components/RadarDisplay';
import { ControlPanel } from './components/ControlPanel';
import { Plane as PlaneIcon, AlertTriangle } from 'lucide-react';

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const { planes, score, gameOver, updatePlaneTarget, restart } = useGameLoop(difficulty, gameSpeed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('atc_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem('atc_highscore', score.toString());
    }
  }, [gameOver, score, highScore]);

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
          </div>
        </div>

        {/* Radar Container */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="aspect-square h-full max-h-[800px] relative rounded-full bg-slate-950 border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.1)] overflow-hidden">
            {/* Sweep Animation */}
            <div 
              className="absolute inset-0 pointer-events-none origin-center"
              style={{
                background: 'conic-gradient(from 0deg, rgba(34, 197, 94, 0.15) 0deg, transparent 60deg)',
                animation: 'spin 4s linear infinite'
              }}
            />
            
            <RadarDisplay 
              planes={planes} 
              selectedId={selectedId} 
              onSelect={setSelectedId} 
              onSetHeading={(id, heading) => {
                updatePlaneTarget(id, { targetHeading: heading });
                setSelectedId(null);
              }}
            />
          </div>
        </div>

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 p-8 rounded-lg border border-red-500/50 text-center max-w-md shadow-2xl shadow-red-500/20">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">INCIDENT DETECTED</h2>
              <p className="text-red-400 mb-6">Separation minimums violated or aircraft crashed.</p>
              <div className="text-2xl font-bold text-white mb-8">
                FINAL SCORE: {score}
              </div>
              <button
                onClick={restart}
                className="w-full bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-4 px-8 rounded transition-colors text-lg"
              >
                START NEW SHIFT
              </button>
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
