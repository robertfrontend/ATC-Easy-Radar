import { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, Difficulty, GameSpeed, Airport, RunwayConfig } from '../types';
import { trackFate } from '../utils/approach';
import { audioManager } from '../utils/audio';
import { applyClearance } from '../utils/navigation';
import { applySeparation } from '../utils/separation';
import { advancePlane } from '../utils/sim';
import { DIFFICULTY_CONFIG, isSpawnDue, spawnAircraft } from '../utils/spawn';
import { createSession, recordSessionEvents, getSessionDifficulty } from '../utils/session';
import { challengeResult, challengeRunways, getIntensity } from '../challenges/model';
import { spawnIntensityTraffic } from '../challenges/traffic';

export type { Plane, Difficulty, GameSpeed };
export type SessionMode = 'tutorial' | 'shift' | 'free' | 'challenge';
export interface FlightEvent {
  id: string;
  at: number;
  kind: 'success' | 'warning' | 'accident' | 'missed';
  message: string;
  advice: string;
}
interface LoopOptions {
  mode?: SessionMode;
  goal?: number;
  level?: number;
  initialPlanes?: Plane[];
  /** Menus and guided instructions freeze time without changing manual pause. */
  blocked?: boolean;
}
const TICK_RATE = 50;
export const SHIFT_DURATION_MS = 5 * 60 * 1000;

export const useGameLoop = (
  airport: Airport,
  runwayConfig: RunwayConfig,
  difficulty: Difficulty,
  selectedGameSpeed: GameSpeed = 1,
  options: LoopOptions = {},
) => {
  const mode = options.mode ?? 'free';
  const intensity = mode === 'challenge' ? getIntensity(airport.id, options.level ?? 1) : null;
  const gameSpeed = mode === 'challenge' ? 1 : selectedGameSpeed;
  const goal = intensity?.minimumOperations ?? options.goal ?? 10;
  const makeState = (initialPlanes = options.initialPlanes ?? []) => ({
    planes: initialPlanes.map(p => ({ ...p, trail: [...p.trail] })),
    score: 0,
    accidents: 0,
    elapsedMs: 0,
    session: createSession(goal),
    events: [] as FlightEvent[],
  });
  const [state, setState] = useState(makeState);
  const stateRef = useRef(state);
  const [isPaused, setIsPaused] = useState(false);
  const lastSpawnRef = useRef(-100000);
  const lastDepartureTimeRef = useRef<Record<string, number>>({});
  const globalLastDepartureRef = useRef(-100000);
  const commandRef = useRef<Record<string, string>>({});
  const firstConflictRef = useRef<Record<string, { at: number; distance: number; vertical: number }>>({});
  const hadWarningRef = useRef(false);
  const eventSequenceRef = useRef(0);
  const spawnSequenceRef = useRef(0);
  const runwayConfigRef = useRef(runwayConfig);
  runwayConfigRef.current = mode === 'challenge' ? challengeRunways(airport) : runwayConfig;
  const effectiveDifficulty = mode === 'challenge' ? 'easy' : mode === 'shift' ? getSessionDifficulty(state.session, difficulty) : difficulty;
  const hasEnded = mode !== 'free' && (state.session.status !== 'active' || ((mode === 'shift' || mode === 'challenge') && state.elapsedMs >= SHIFT_DURATION_MS));

  useEffect(() => {
    if (isPaused || options.blocked || hasEnded) return;
    const intervalMs = TICK_RATE / (typeof gameSpeed === 'number' ? gameSpeed : 1);
    const interval = setInterval(() => {
      const previous = stateRef.current;
      if (mode !== 'free' && (previous.session.status !== 'active' || ((mode === 'shift' || mode === 'challenge') && previous.elapsedMs >= SHIFT_DURATION_MS))) return;
      // Active-running time excludes menus, pause, instruction stops and tab throttling.
      const elapsedMs = previous.elapsedMs + intervalMs;
      const trafficDifficulty = mode === 'challenge' ? 'easy' : mode === 'shift' ? getSessionDifficulty(previous.session, difficulty) : difficulty;
      const config = DIFFICULTY_CONFIG[trafficDifficulty];
      let currentPlanes = previous.planes;
      const spawnDue = intensity
        ? currentPlanes.length < intensity.maxPlanes && elapsedMs - lastSpawnRef.current >= intensity.spawnIntervalMs
        : isSpawnDue({
        now: elapsedMs,
        lastSpawnAt: lastSpawnRef.current,
        planeCount: currentPlanes.length,
        difficulty: trafficDifficulty,
        gameSpeed,
        });
      if (mode !== 'tutorial' && spawnDue) {
        const request = {
          airport,
          runwayConfig: runwayConfigRef.current,
          planes: currentPlanes,
          now: elapsedMs,
          gameSpeed,
          lastDepartureByRunway: lastDepartureTimeRef.current,
          lastDepartureAt: globalLastDepartureRef.current,
          allowArrival: currentPlanes.length < (intensity?.maxPlanes ?? config.maxPlanes),
        };
        const result = intensity ? spawnIntensityTraffic(request, intensity, ++spawnSequenceRef.current) : spawnAircraft(request);
        globalLastDepartureRef.current = result.lastDepartureAt;
        lastSpawnRef.current = elapsedMs;
        if (result.plane) {
          currentPlanes = [...currentPlanes, result.plane];
          audioManager.playBlip();
        }
      }
      const nextPlanes = currentPlanes.map(plane => {
        const step = advancePlane(plane, airport, runwayConfigRef.current, config.ilsWidth, gameSpeed);
        if (step.justCaptured) audioManager.playIlsCapture();
        return step.plane;
      });
      const events = [...previous.events];
      const log = (kind: FlightEvent['kind'], message: string, advice: string) => {
        events.push({ id: `${++eventSequenceRef.current}`, at: elapsedMs, kind, message, advice });
      };
      // Capture conflict onset before the separation pass can remove the tracks.
      for (let i = 0; i < nextPlanes.length; i++) {
        for (let j = i + 1; j < nextPlanes.length; j++) {
          const a = nextPlanes[i], b = nextPlanes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          const vertical = Math.abs(a.altitude - b.altitude);
          const key = [a.id, b.id].sort().join(':');
          if (distance < 55 && vertical < 1000 && !(a.altitude < 1000 && b.altitude < 1000)) {
            if (!firstConflictRef.current[key]) {
              firstConflictRef.current[key] = { at: elapsedMs, distance, vertical };
              log('warning', `${a.callsign} / ${b.callsign}: separation ${Math.round(distance)} radar units, ${Math.round(vertical)} ft.`,
                'Assign different altitudes early. Keep at least 1,000 ft vertically or 55 radar units laterally; a target altitude is not separation until reached.');
            }
          } else {
            delete firstConflictRef.current[key];
          }
        }
      }
      const separation = applySeparation(nextPlanes);
      if (separation.warning && !hadWarningRef.current) audioManager.playWarning();
      hadWarningRef.current = separation.warning;
      const successIds: string[] = [];
      const controlledSuccessIds: string[] = [];
      const missedExitIds: string[] = [];
      const accidentIds: string[] = [];
      for (const plane of nextPlanes) {
        if (plane.status === 'crashed') {
          accidentIds.push(plane.id);
          const onsetKey = Object.keys(firstConflictRef.current).find(key => key.split(':').includes(plane.id));
          const onset: { at: number } | undefined = onsetKey ? firstConflictRef.current[onsetKey] : undefined;
          log('accident', `${plane.callsign}: collision${onset ? `, conflict began at ${Math.floor(onset.at / 1000)}s` : ''}.`,
            `Create vertical spacing before tracks converge. Last clearance: ${commandRef.current[plane.id] ?? 'none'}.`);
        }
      }
      const retained = nextPlanes.filter(plane => {
        const fate = trackFate(plane, airport);
        if (fate.keep) return true;
        if (fate.score) {
          successIds.push(plane.id);
          if (commandRef.current[plane.id]) controlledSuccessIds.push(plane.id);
          log('success', `${plane.callsign}: ${plane.type === 'arrival' ? 'landed' : 'exit handoff'} safely.`, 'Keep the next aircraft separated before turning it onto final.');
          audioManager.playSuccess();
        } else if (fate.accident) {
          accidentIds.push(plane.id);
          log('accident', `${plane.callsign}: unstable arrival at the runway.`,
            `Intercept the active ILS before reaching the runway. Last clearance: ${commandRef.current[plane.id] ?? 'none'}.`);
        } else if (plane.status !== 'crashed') {
          missedExitIds.push(plane.id);
          log('missed', `${plane.callsign}: left the sector without a successful operation.`,
            plane.type === 'departure' ? 'Clear the departure direct to its assigned exit with DEP or the DIRECT button.' : 'Turn arrivals toward the active ILS early and descend before capture.');
        }
        delete commandRef.current[plane.id];
        return false;
      });
      const accidents = previous.accidents + separation.collisions + accidentIds.filter(id => !nextPlanes.find(p => p.id === id && p.status === 'crashed')).length;
      if (accidentIds.length) audioManager.playCrash();
      const session = recordSessionEvents(previous.session, {
        successIds: intensity ? controlledSuccessIds : successIds, missedExitIds, accidentIds, warning: separation.warning,
      }, !intensity);
      if (intensity) session.status = challengeResult(elapsedMs, accidents, session.operations, goal);
      const next = { planes: retained, score: previous.score + successIds.length, accidents, elapsedMs, session, events: events.slice(-80) };
      stateRef.current = next;
      setState(next);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [airport, difficulty, gameSpeed, isPaused, options.blocked, hasEnded, mode, options.level]);

  const updatePlaneTarget = useCallback((id: string, updates: Partial<Plane>) => {
    const current = stateRef.current;
    const parts = [
      updates.targetHeading !== undefined ? `heading ${Math.round(updates.targetHeading)}°` : '',
      updates.targetAltitude !== undefined ? `${updates.targetAltitude} ft` : '',
      updates.targetSpeed !== undefined ? `${updates.targetSpeed} kt` : '',
      updates.targetWaypoint ? `direct ${airport.waypoints.find(w => w.id === updates.targetWaypoint)?.label ?? updates.targetWaypoint}` : '',
      updates.assignedRunwayId ? `ILS ${airport.runways.find(r => r.id === updates.assignedRunwayId)?.label ?? ''}` : '',
    ].filter(Boolean);
    commandRef.current[id] = parts.join(', ');
    const next = { ...current, planes: current.planes.map(p => p.id === id ? applyClearance(p, updates) : p) };
    stateRef.current = next;
    setState(next);
  }, [airport]);
  const togglePause = useCallback(() => setIsPaused(p => !p), []);
  const setPaused = useCallback((paused: boolean) => setIsPaused(paused), []);
  const restart = useCallback((initialPlanes?: Plane[]) => {
    const next = makeState(initialPlanes);
    stateRef.current = next;
    setState(next);
    setIsPaused(false);
    lastSpawnRef.current = -100000;
    lastDepartureTimeRef.current = {};
    globalLastDepartureRef.current = -100000;
    commandRef.current = {};
    firstConflictRef.current = {};
    hadWarningRef.current = false;
    eventSequenceRef.current = 0;
    spawnSequenceRef.current = 0;
  }, [goal, options.initialPlanes]);
  return { ...state, isPaused, hasEnded, effectiveDifficulty, togglePause, setPaused, updatePlaneTarget, restart };
};
