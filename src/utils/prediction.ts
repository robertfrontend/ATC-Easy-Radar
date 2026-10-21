import { Airport, GameSpeed, Plane, RunwayConfig } from '../types';
import { trackFate } from './approach';
import { advancePlane } from './sim';
import { RadarDomain } from './radarBounds';

export const PREDICTION_SECONDS = 30;

export interface PredictedPoint {
  x: number;
  y: number;
  altitude: number;
  speed: number;
  heading: number;
  seconds: number;
  isEstablished: boolean;
}

export interface FlightPrediction {
  points: PredictedPoint[];
  seconds: number;
  ended: boolean;
}

/**
 * Replay the actual single-aircraft simulation, including direct-to, turns,
 * acceleration, ILS capture and landing/handoff. Seconds are running wall time
 * at the chosen game speed, not a straight-line distance approximation.
 *
 * Traffic, collisions, future commands and runway changes are not predicted.
 * The live plane and trail are never changed.
 */
export function predictFlightPath(
  plane: Plane,
  airport: Airport,
  runwayConfig: RunwayConfig,
  ilsWidth: number,
  gameSpeed: GameSpeed,
  horizonSeconds = PREDICTION_SECONDS,
  domain?: RadarDomain,
): FlightPrediction {
  const secondsPerTick = 0.05 / (gameSpeed === 'real' ? 1 : gameSpeed);
  const ticks = Math.floor(Math.max(0, Math.min(horizonSeconds, 60)) / secondsPerTick);
  const sampleEvery = Math.max(1, Math.round(1 / secondsPerTick));
  const point = (p: Plane, seconds: number): PredictedPoint => ({
    x: p.x,
    y: p.y,
    altitude: p.altitude,
    speed: p.speed,
    heading: p.heading,
    seconds,
    isEstablished: p.isEstablished,
  });
  const points = [point(plane, 0)];
  if (plane.status === 'crashed' || plane.markedForRemoval) return { points, seconds: 0, ended: true };

  let projected = plane;
  let seconds = 0;
  for (let tick = 1; tick <= ticks; tick++) {
    projected = advancePlane(projected, airport, runwayConfig, ilsWidth, gameSpeed).plane;
    seconds = tick * secondsPerTick;
    const ended = !trackFate(projected, airport, domain).keep;
    if (tick % sampleEvery === 0 || tick === ticks || ended) points.push(point(projected, seconds));
    if (ended) return { points, seconds, ended: true };
  }
  return { points, seconds, ended: false };
}
