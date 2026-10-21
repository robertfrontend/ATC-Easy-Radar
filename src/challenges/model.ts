import { Airport, RunwayConfig } from '../types';
import { AIRPORTS } from '../config/airports';

export const CHALLENGE_DURATION_MS = 300000;
export const CHALLENGE_LEVELS = 20;
/** Initial balance: slower intake for constrained geometry, same flight rules. */
export const airportBalance: Record<string, { spacing: number; capacity: number }> = {
  'las-americas': { spacing: 1.1, capacity: 0 },
  'panama-pty': { spacing: 1.05, capacity: 0 },
  'london-lhr': { spacing: 1, capacity: 1 },
  'logan-int': { spacing: 1.2, capacity: -1 },
  'amsterdam-ams': { spacing: 1.1, capacity: 0 },
  'dubai-int': { spacing: .95, capacity: 1 },
};

export interface Intensity {
  airportId: string;
  level: number;
  spawnIntervalMs: number;
  maxPlanes: number;
  departureProbability: number;
  minimumOperations: number;
  description: string;
}

export function getIntensity(airportId: string, level: number): Intensity | null {
  const balance = Object.hasOwn(airportBalance, airportId) ? airportBalance[airportId] : undefined;
  if (!balance || !Number.isInteger(level) || level < 1 || level > CHALLENGE_LEVELS) return null;
  const band = Math.floor((level - 1) / 5);
  return {
    airportId, level,
    spawnIntervalMs: Math.round((30000 - (level - 1) * 1100) * balance.spacing),
    maxPlanes: Math.max(3, 3 + Math.floor((level - 1) / 2) + balance.capacity),
    departureProbability: .9 - (level - 1) * .025,
    minimumOperations: band + 1,
    description: [
      'Tráfico ligero, entradas espaciadas y predominio de salidas.',
      'Más tráfico simultáneo y mezcla gradual de llegadas y salidas.',
      'Menos descansos y entradas más frecuentes.',
      'Intensidad sostenida: anticipa y organiza varias aeronaves.',
    ][band],
  };
}

/** One published game runway setup per airport, fixed only in challenges. */
export function challengeRunways(airport: Airport): RunwayConfig {
  return Object.fromEntries(airport.runways.map((runway, index) => [runway.id, {
    landing: index === 0, departure: index === 0,
  }]));
}

export const CHALLENGE_PROGRESS_KEY = 'atc_challenges_progress_v1';
export interface ChallengeProgress { version: 1; completed: Record<string, number> }
const empty = (): ChallengeProgress => ({ version: 1, completed: {} });

/** Store only the contiguous completed frontier; unknown/invalid entries never unlock. */
export function readChallengeProgress(raw: string | null): ChallengeProgress {
  try {
    const parsed = JSON.parse(raw ?? 'null');
    if (parsed?.version !== 1 || !parsed.completed || typeof parsed.completed !== 'object') return empty();
    const progress = empty();
    for (const airport of AIRPORTS) {
      const value = parsed.completed[airport.id];
      if (Number.isInteger(value) && value >= 0 && value <= CHALLENGE_LEVELS) progress.completed[airport.id] = value;
    }
    return progress;
  } catch { return empty(); }
}

export function isLevelUnlocked(progress: ChallengeProgress, airportId: string, level: number): boolean {
  return !!getIntensity(airportId, level) && level <= Math.min(CHALLENGE_LEVELS, (progress.completed[airportId] ?? 0) + 1);
}

export function completeLevel(progress: ChallengeProgress, airportId: string, level: number): ChallengeProgress {
  if (!isLevelUnlocked(progress, airportId, level) || level <= (progress.completed[airportId] ?? 0)) return progress;
  return { version: 1, completed: { ...progress.completed, [airportId]: level } };
}

export function nextLevel(level: number): number | null {
  return Number.isInteger(level) && level >= 1 && level < CHALLENGE_LEVELS ? level + 1 : null;
}

export function challengeResult(elapsedMs: number, accidents: number, effectiveOperations: number, minimum: number) {
  if (accidents > 0) return 'failed' as const;
  if (elapsedMs < CHALLENGE_DURATION_MS) return 'active' as const;
  return effectiveOperations >= minimum ? 'completed' as const : 'failed' as const;
}
