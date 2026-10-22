import { Airport, Plane, Runway, RunwayConfig } from '../types';
import { runwayFrame, approachCoordinates } from '../geography/navigation';
import type { GeographicAirport } from '../geography/types';
import { departureLeftSector } from './departure';
import { DISTANT_WORLD_HALF_EXTENT, domainExtent, RadarDomain } from './radarBounds';

export interface IlsRunwayCheck {
  runway: Runway;
  alongTrack: number;
  crossTrack: number;
  headingDifference: number;
  inRange: boolean;
  inCone: boolean;
  altitudeReady: boolean;
  headingReady: boolean;
  ready: boolean;
  referenceHeading: number;
  sourceAvailable: boolean;
}

/** Shared by the simulation and the UI so capture feedback cannot use looser rules. */
export function checkIlsRunway(
  plane: Plane,
  airport: Airport,
  runway: Runway,
  ilsWidth: number,
): IlsRunwayCheck {
  const frame = runwayFrame(airport, runway);
  const { crossTrack, alongTrack, axisAlongTrack } = approachCoordinates(airport, runway, plane);
  const relHeading = (plane.heading - frame.approachHeading + 360) % 360;
  const inRange = alongTrack > 20 && alongTrack < 520;
  const sourceAvailable = !frame.localizer?.restrictions.some(text => text.includes('33 DEGS LEFT'))
    || Math.atan2(-crossTrack, axisAlongTrack) * 180 / Math.PI <= 33;
  const inCone = inRange && Math.abs(crossTrack) <= alongTrack * ilsWidth && sourceAvailable;
  const altitudeReady = plane.altitude <= 10000;
  const headingReady = relHeading > 310 || relHeading < 50;
  return {
    runway,
    alongTrack,
    crossTrack,
    headingDifference: Math.min(relHeading, 360 - relHeading),
    inRange,
    inCone,
    altitudeReady,
    headingReady,
    ready: inCone && altitudeReady && headingReady,
    referenceHeading: frame.approachHeading, sourceAvailable,
  };
}

function captureRunways(plane: Plane, airport: Airport, runwayConfig: RunwayConfig) {
  return airport.runways.filter(r => {
    if (plane.assignedRunwayId) return r.id === plane.assignedRunwayId && runwayConfig[r.id]?.landing;
    return runwayConfig[r.id]?.landing;
  });
}

export interface IlsReadiness {
  status: 'established' | 'unavailable' | 'ready' | 'blocked';
  message: string;
  check?: IlsRunwayCheck;
}

/**
 * Current-state explanation, not a clearance or a promise of future capture.
 * For an unassigned arrival, show the closest-to-ready active approach.
 */
export function inspectIlsReadiness(
  plane: Plane,
  airport: Airport,
  runwayConfig: RunwayConfig,
  ilsWidth: number,
): IlsReadiness {
  if (plane.status === 'crashed') return { status: 'unavailable', message: 'Track lost. ILS capture is unavailable.' };
  if (plane.isEstablished) {
    const label = airport.runways.find(r => r.id === plane.establishedRunwayId)?.label;
    return { status: 'established', message: `Established${label ? ` on ILS ${label}` : ''}. Automatic heading, descent and speed guidance is active.` };
  }
  if (plane.type !== 'arrival') return { status: 'unavailable', message: 'ILS capture is for arrivals only.' };
  if (plane.goAround) return { status: 'unavailable', message: 'Go-around active. Transmit a new clearance when ready to rejoin an approach.' };

  const candidates = captureRunways(plane, airport, runwayConfig);
  if (candidates.length === 0) {
    return {
      status: 'unavailable',
      message: plane.assignedRunwayId
        ? 'Assigned runway is not active for landing. Select an active ILS and transmit, or change runway use.'
        : 'No landing runway is active. Enable landing in runway settings.',
    };
  }
  const checks = candidates.map(rwy => checkIlsRunway(plane, airport, rwy, ilsWidth));
  // Keep the same runway order as capture when multiple runways are ready.
  const ready = checks.find(check => check.ready);
  const check = ready ?? checks.sort((a, b) => {
    const failed = (c: IlsRunwayCheck) => Number(!c.inCone) + Number(!c.altitudeReady) + Number(!c.headingReady);
    return failed(a) - failed(b)
      || Math.hypot(a.crossTrack, a.alongTrack - 450) - Math.hypot(b.crossTrack, b.alongTrack - 450);
  })[0];
  return {
    status: check.ready ? 'ready' : 'blocked',
    message: check.ready ? 'Capture conditions met. ILS will engage on the next running tick.' : 'Not captured yet. Meet each condition below.',
    check,
  };
}

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
    const candidateRunways = captureRunways(plane, airport, runwayConfig);

    for (const rwy of candidateRunways) {
      if (checkIlsRunway(plane, airport, rwy, ilsWidth).ready) {
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
  if ((airport as GeographicAirport).geographic) {
    const frame = runwayFrame(airport, rwy), { crossTrack, alongTrack } = approachCoordinates(airport, rwy, plane);
    // Simplified last-NM visual transition to the actual displaced threshold, not a published procedure.
    const targetHeading = alongTrack <= 22.4
      ? (Math.atan2(frame.threshold.x - plane.x, plane.y - frame.threshold.y) * 180 / Math.PI + 360) % 360
      : (frame.approachHeading - Math.max(-30, Math.min(30, Math.atan2(crossTrack, 44.8) * 180 / Math.PI)) + 360) % 360;
    return { targetHeading, targetAltitude: 0, targetSpeed: 140 };
  }
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
export function trackFate(plane: Plane, airport: Airport, domain?: RadarDomain): TrackFate {
  if (plane.markedForRemoval) {
    const handoff = plane.type === 'departure' && plane.status !== 'crashed';
    return { keep: false, score: handoff, accident: false, success: handoff };
  }

  if (departureLeftSector(plane, airport, domain)) {
    return { keep: false, score: false, accident: false, success: false };
  }

  if (plane.type === 'arrival') {
    const geographic = !!(airport as GeographicAirport).geographic;
    const rwy = airport.runways.find(r => r.id === plane.establishedRunwayId || geographic && r.id === plane.assignedRunwayId)
      ?? (geographic ? [...airport.runways].sort((a, b) => {
        const left = runwayFrame(airport, a).threshold, right = runwayFrame(airport, b).threshold;
        return Math.hypot(plane.x - left.x, plane.y - left.y) - Math.hypot(plane.x - right.x, plane.y - right.y);
      })[0] : undefined);
    const threshold = rwy && geographic ? runwayFrame(airport, rwy).threshold : null;
    const rwyX = threshold?.x ?? airport.x + (rwy?.offsetX || 0);
    const rwyY = threshold?.y ?? airport.y + (rwy?.offsetY || 0);
    const distToRwy = Math.hypot(plane.x - rwyX, plane.y - rwyY);

    if (distToRwy < (geographic ? 4 : 30)) {
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

  if (domainExtent(plane, airport, domain) < DISTANT_WORLD_HALF_EXTENT) return { keep: true, score: false, accident: false, success: false };
  return { keep: false, score: false, accident: false, success: false };
}
