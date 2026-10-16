import { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, Difficulty, GameSpeed, Airport, RunwayConfig } from '../types';
import { trackFate } from '../utils/approach';
import { audioManager } from '../utils/audio';
import { applyClearance } from '../utils/navigation';
import { applySeparation } from '../utils/separation';
import { advancePlane } from '../utils/sim';
import { DIFFICULTY_CONFIG, isSpawnDue, spawnAircraft } from '../utils/spawn';

export type { Plane, Difficulty, GameSpeed };

const TICK_RATE = 50; // ms

export const useGameLoop = (
  airport: Airport,
  runwayConfig: RunwayConfig,
  difficulty: Difficulty,
  gameSpeed: GameSpeed = 1
) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [score, setScore] = useState(0);
  const [accidents, setAccidents] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const lastSpawnRef = useRef(0);
  const initializedRef = useRef(false);
  const planesRef = useRef<Plane[]>([]);
  const runwayConfigRef = useRef<RunwayConfig>(runwayConfig);
  const lastDepartureTimeRef = useRef<Record<string, number>>({});
  const globalLastDepartureRef = useRef<number>(0);

  useEffect(() => {
    runwayConfigRef.current = runwayConfig;
  }, [runwayConfig]);

  useEffect(() => {
    planesRef.current = planes;
  }, [planes]);

  const spawnPlane = useCallback((options?: { arrivals?: boolean }) => {
    const allowArrival = options?.arrivals !== false;
    const now = Date.now();
    const spawned = spawnAircraft({
      airport,
      runwayConfig: runwayConfigRef.current,
      planes: planesRef.current,
      now,
      gameSpeed,
      lastDepartureByRunway: lastDepartureTimeRef.current,
      lastDepartureAt: globalLastDepartureRef.current,
      allowArrival,
    });
    globalLastDepartureRef.current = spawned.lastDepartureAt;
    const plane = spawned.plane;
    if (!plane) return;

    setPlanes(prev => [...prev, plane]);
    audioManager.playBlip();
  }, [airport, gameSpeed]);

  useEffect(() => {
    if (isPaused) return;

    const isReal = gameSpeed === 'real';
    const numSpeed = typeof gameSpeed === 'number' ? gameSpeed : 1;
    const tickInterval = isReal ? TICK_RATE : (TICK_RATE / numSpeed);

    const interval = setInterval(() => {
      const now = Date.now();
      
      if (!initializedRef.current) {
        spawnPlane();
        initializedRef.current = true;
        lastSpawnRef.current = now;
      }

      const currentCount = planesRef.current.length;
      const spawnDue = isSpawnDue({
        now,
        lastSpawnAt: lastSpawnRef.current,
        planeCount: currentCount,
        difficulty,
        gameSpeed,
      });
      if (spawnDue) {
        // At the traffic cap, still roll for a departure. Arrivals need a free slot.
        spawnPlane({ arrivals: currentCount < config.maxPlanes });
        lastSpawnRef.current = now;
      }

      setPlanes(prevPlanes => {
        const currentRwyConfig = runwayConfigRef.current;

        const nextPlanes = prevPlanes.map(plane => {
          const step = advancePlane(plane, airport, currentRwyConfig, config.ilsWidth, gameSpeed);
          if (step.justCaptured) audioManager.playIlsCapture();
          return step.plane;
        });

        const separation = applySeparation(nextPlanes);
        for (let n = 0; n < separation.collisions; n++) {
          setAccidents(a => a + 1);
          audioManager.playCrash();
        }
        if (separation.warning) audioManager.playWarning();

        return nextPlanes.filter(plane => {
          const fate = trackFate(plane, airport);
          if (fate.keep) return true;
          if (fate.score) setScore(s => s + 1);
          if (fate.accident) setAccidents(a => a + 1);
          if (fate.success) audioManager.playSuccess();
          if (fate.accident) audioManager.playCrash();
          return false;
        });
      });
    }, tickInterval);

    return () => clearInterval(interval);
  }, [isPaused, spawnPlane, difficulty, gameSpeed, airport, config]);

  // Audio sweep
  useEffect(() => {
    if (isPaused) return;
    const isReal = gameSpeed === 'real';
    const numSpeed = typeof gameSpeed === 'number' ? gameSpeed : 1;
    const sweepInterval = isReal ? 4500 : (4000 / numSpeed);
    const interval = setInterval(() => audioManager.playBlip(), sweepInterval);
    return () => clearInterval(interval);
  }, [isPaused, gameSpeed]);

  const updatePlaneTarget = (id: string, updates: Partial<Plane>) => {
    setPlanes(prev => prev.map(p => p.id === id ? applyClearance(p, updates) : p));
  };

  const togglePause = () => setIsPaused(p => !p);
  const setPaused = (paused: boolean) => setIsPaused(paused);

  const restart = () => {
    setPlanes([]);
    setScore(0);
    setAccidents(0);
    setIsPaused(false);
    initializedRef.current = false;
    lastSpawnRef.current = 0;
  };

  return { planes, score, accidents, isPaused, togglePause, setPaused, updatePlaneTarget, restart };
};
