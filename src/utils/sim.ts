import { Airport, GameSpeed, Plane, RunwayConfig } from '../types';
import { approachStatus, evaluateIlsCapture, localizerGuidance } from './approach';
import { integrateMotion, motionProfile } from './motion';
import { resolveNavigation } from './navigation';

export interface AdvanceResult {
  plane: Plane;
  justCaptured: boolean;
}

/**
 * One aircraft for one tick: runway track or direct-to, ILS capture,
 * localizer guidance, then motion. Conflict flags are cleared here and
 * reapplied by the separation pass.
 */
export function advancePlane(
  plane: Plane,
  airport: Airport,
  runwayConfig: RunwayConfig,
  ilsWidth: number,
  gameSpeed: GameSpeed,
): AdvanceResult {
  let currentTargetAltitude = plane.targetAltitude;
  let currentTargetSpeed = plane.targetSpeed;

  const nav = resolveNavigation(plane, airport);
  let currentTargetHeading = nav.targetHeading;
  const currentTargetWaypoint = nav.targetWaypoint;
  const markedForRemoval = nav.markedForRemoval;

  const capture = evaluateIlsCapture(plane, airport, runwayConfig, ilsWidth);
  const isEstablished = capture.isEstablished;
  const establishedRunwayId = capture.establishedRunwayId;

  if (isEstablished && plane.status !== 'crashed') {
    const guidance = localizerGuidance(plane, airport, establishedRunwayId);
    currentTargetHeading = guidance.targetHeading;
    currentTargetAltitude = guidance.targetAltitude;
    currentTargetSpeed = guidance.targetSpeed;
  }

  const moved = integrateMotion(
    plane,
    { heading: currentTargetHeading, altitude: currentTargetAltitude, speed: currentTargetSpeed },
    motionProfile(gameSpeed, isEstablished),
  );

  return {
    justCaptured: capture.justCaptured,
    plane: {
      ...plane,
      x: moved.x,
      y: moved.y,
      heading: moved.heading,
      altitude: moved.altitude,
      speed: moved.speed,
      trail: moved.trail,
      targetHeading: currentTargetHeading,
      targetAltitude: currentTargetAltitude,
      targetSpeed: currentTargetSpeed,
      isEstablished,
      establishedRunwayId,
      status: approachStatus(plane, airport, {
        x: moved.x,
        y: moved.y,
        altitude: moved.altitude,
        speed: moved.speed,
        isEstablished,
      }),
      targetWaypoint: currentTargetWaypoint,
      markedForRemoval,
      conflict: false,
    },
  };
}
