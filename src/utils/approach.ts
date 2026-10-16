import { Airport, Plane, RunwayConfig } from '../types';
import { departureLeftSector } from './departure';

export interface IlsCapture {
  isEstablished: boolean;
  establishedRunwayId: string | null | undefined;
  justCaptured: boolean;
}

/**
 * Localizer capture for an arrival inside a landing runway's cone,
 * at or below 10,000 ft, and within 50° of the runway heading.
 */
export function evaluateIlsCapture(
  plane: Plane,
  airport: Airport,
  runwayConfig: RunwayConfig,
  ilsWidth: number,
): IlsCapture {
  let isEstablished = plane.isEstablished;
  let establishedRunwayId = plane.establishedRunwayId;
  let justCaptured = false;

  if (!isEstablished && !plane.goAround && plane.status !== 'crashed' && plane.type === 'arrival') {
    const candidateRunways = airport.runways.filter(r => {
      if (plane.assignedRunwayId) return r.id === plane.assignedRunwayId && runwayConfig[r.id]?.landing;
      return runwayConfig[r.id]?.landing;
    });

    for (const rwy of candidateRunways) {
      const rwyX = airport.x + (rwy.offsetX || 0);
      const rwyY = airport.y + (rwy.offsetY || 0);
      const dx = plane.x - rwyX;
      const dy = plane.y - rwyY;
      const rad = -rwy.heading * Math.PI / 180;
      const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);

      const inILSCone = rotatedY > 20 && rotatedY < 520 && Math.abs(rotatedX) <= rotatedY * ilsWidth;
      const relHeading = (plane.heading - rwy.heading + 360) % 360;
      const isHeadingAligned = relHeading > 310 || relHeading < 50;

      if (inILSCone && plane.altitude <= 10000 && isHeadingAligned) {
        isEstablished = true;
        establishedRunwayId = rwy.id;
        justCaptured = true;
        break;
      }
    }
  }

  return { isEstablished, establishedRunwayId, justCaptured };
}

export interface LocalizerGuidance {
  targetHeading: number;
  targetAltitude: number;
  targetSpeed: number;
}

/** Centerline correction, descent to the pavement, and approach speed. */
export function localizerGuidance(
  plane: Pick<Plane, 'x' | 'y'>,
  airport: Airport,
  establishedRunwayId: string | null | undefined,
): LocalizerGuidance {
  const rwy = airport.runways.find(r => r.id === establishedRunwayId) || airport.runways[0];
  const rwyX = airport.x + (rwy.offsetX || 0);
  const rwyY = airport.y + (rwy.offsetY || 0);
  const dx = plane.x - rwyX;
  const dy = plane.y - rwyY;
  const rad = -rwy.heading * Math.PI / 180;
  const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const correction = rotatedX < 0 ? Math.min(30, -rotatedX * 2) : -Math.min(30, rotatedX * 2);
  return {
    targetHeading: (rwy.heading + correction + 360) % 360,
    targetAltitude: 0,
    targetSpeed: 140,
  };
}

/**
 * Unstable-approach flag. A departure over the field is climbing out,
 * so the same geometry is not a bad approach. A crashed track stays crashed.
 */
export function approachStatus(
  plane: Pick<Plane, 'status' | 'type'>,
  airport: Pick<Airport, 'x' | 'y'>,
  position: { x: number; y: number; altitude: number; speed: number; isEstablished: boolean },
): Plane['status'] {
  let newStatus: Plane['status'] = plane.status === 'crashed' ? 'crashed' : 'normal';
  const distToCenter = Math.hypot(position.x - airport.x, position.y - airport.y);
  if (newStatus === 'normal' && plane.type !== 'departure') {
    if (distToCenter < 100 && position.altitude <= 2500 && !position.isEstablished) newStatus = 'bad_approach';
    else if (position.isEstablished && distToCenter < 50 && position.speed > 160) newStatus = 'bad_approach';
  }
  return newStatus;
}

export interface TrackFate {
  keep: boolean;
  /** Departure handoff or a successful landing. */
  score: boolean;
  /** Arrival reached the pavement without a stable landing. */
  accident: boolean;
  success: boolean;
}

/**
 * Whether a track stays on the scope after the tick.
 * Order matches the loop: handoff, uncleared departure leaving the sector,
 * landing, then the map edge.
 */
export function trackFate(plane: Plane, airport: Airport): TrackFate {
  if (plane.markedForRemoval) {
    const handoff = plane.type === 'departure' && plane.status !== 'crashed';
    return { keep: false, score: handoff, accident: false, success: handoff };
  }

  if (departureLeftSector(plane, airport)) {
    return { keep: false, score: false, accident: false, success: false };
  }

  if (plane.type === 'arrival') {
    const rwy = airport.runways.find(r => r.id === plane.establishedRunwayId);
    const rwyX = airport.x + (rwy?.offsetX || 0);
    const rwyY = airport.y + (rwy?.offsetY || 0);
    const distToRwy = Math.hypot(plane.x - rwyX, plane.y - rwyY);

    if (distToRwy < 30) {
      if (plane.isEstablished) {
        return { keep: false, score: true, accident: false, success: true };
      }
      if (plane.altitude <= 2000) {
        const targetHdg = rwy ? rwy.heading : 0;
        const relHeading = (plane.heading - targetHdg + 360) % 360;
        const isAligned = relHeading > 340 || relHeading < 20;
        if (plane.speed <= 220 && isAligned) {
          return { keep: false, score: true, accident: false, success: true };
        }
        return { keep: false, score: false, accident: true, success: false };
      }
    }
  }

  const distToCenter = Math.hypot(plane.x - airport.x, plane.y - airport.y);
  if (distToCenter < 2500) return { keep: true, score: false, accident: false, success: false };
  return { keep: false, score: false, accident: false, success: false };
}
