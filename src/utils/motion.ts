import { GameSpeed, Plane } from '../types';

export interface MotionProfile {
  turnRate: number;
  climbRate: number;
  accelRate: number;
  speedMultiplier: number;
  trailThreshold: number;
  maxTrailPoints: number;
}

/**
 * Per-tick rates for one simulation step.
 * Real mode is a standard-rate turn (3°/s → 0.15°/tick), 2,400 ft/min climb
 * (0.65 ft/tick on the glideslope), and 1.2 kt/s acceleration.
 * Arcade mode is 0.6°/tick, 18 ft/tick, and 0.25 kt/tick.
 * Real distance uses 1 NM = 22.4 units at 20 ticks/second.
 */
export function motionProfile(gameSpeed: GameSpeed, isEstablished: boolean): MotionProfile {
  const isReal = gameSpeed === 'real';
  return {
    turnRate: isReal ? 0.15 : 0.6,
    climbRate: isReal ? (isEstablished ? 0.65 : 2.0) : 18,
    accelRate: isReal ? 0.06 : 0.25,
    speedMultiplier: isReal ? (22.4 / (3600 * 20)) : 0.0015,
    trailThreshold: isReal ? 5 : 12,
    maxTrailPoints: isReal ? 25 : 18,
  };
}

export interface MotionState {
  x: number;
  y: number;
  heading: number;
  altitude: number;
  speed: number;
  trail: { x: number; y: number }[];
}

export function integrateMotion(
  plane: Pick<Plane, 'x' | 'y' | 'heading' | 'altitude' | 'speed' | 'trail'>,
  target: { heading: number; altitude: number; speed: number },
  profile: MotionProfile,
): MotionState {
  const { turnRate, climbRate, accelRate, speedMultiplier, trailThreshold, maxTrailPoints } = profile;

  let newHeading = plane.heading;
  if (plane.heading !== target.heading) {
    let diff = target.heading - plane.heading;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    if (Math.abs(diff) < turnRate) newHeading = target.heading;
    else newHeading = (plane.heading + Math.sign(diff) * turnRate + 360) % 360;
  }

  let newAltitude = plane.altitude;
  if (plane.altitude !== target.altitude) {
    const altDiff = target.altitude - plane.altitude;
    if (Math.abs(altDiff) < climbRate) newAltitude = target.altitude;
    else newAltitude = plane.altitude + Math.sign(altDiff) * climbRate;
  }

  let newSpeed = plane.speed;
  if (plane.speed !== target.speed) {
    const speedDiff = target.speed - plane.speed;
    if (Math.abs(speedDiff) < accelRate) newSpeed = target.speed;
    else newSpeed = plane.speed + Math.sign(speedDiff) * accelRate;
  }

  const dx = newSpeed * speedMultiplier * Math.sin(newHeading * Math.PI / 180);
  const dy = -newSpeed * speedMultiplier * Math.cos(newHeading * Math.PI / 180);
  const newX = plane.x + dx;
  const newY = plane.y + dy;

  const newTrail = [...plane.trail];
  if (newTrail.length === 0 || Math.hypot(newTrail[newTrail.length - 1].x - newX, newTrail[newTrail.length - 1].y - newY) > trailThreshold) {
    newTrail.push({ x: newX, y: newY });
    if (newTrail.length > maxTrailPoints) newTrail.shift();
  }

  return {
    x: newX,
    y: newY,
    heading: newHeading,
    altitude: newAltitude,
    speed: newSpeed,
    trail: newTrail,
  };
}
