import type { Runway } from '../types';
import type { GeographicAirport, WorldPoint } from './types';

/** Pavement and LOC are separate source geometries; legacy callers retain their original center/axis. */
export function runwayFrame(airport: GeographicAirport, runway: Runway) {
  const center = { x: airport.x + (runway.offsetX || 0), y: airport.y + (runway.offsetY || 0) };
  const surface = airport.geographic?.physicalRunways.find(item => item.ends.some(end => end.id === runway.label));
  const end = surface?.ends.find(item => item.id === runway.label), other = surface?.ends.find(item => item.id !== runway.label);
  const pavementHeading = end && other ? (Math.atan2(other.position.x - end.position.x, end.position.y - other.position.y) * 180 / Math.PI + 360) % 360 : runway.heading;
  const localizer = airport.geographic?.localizers.find(item => item.operativeRunwayId === runway.id && !item.referenceOnly);
  return { threshold: end?.threshold ?? center, departureStart: end?.position ?? center, pavementHeading,
    approachOrigin: localizer?.antenna ?? center, approachHeading: localizer?.trueCourse ?? runway.heading, localizer };
}

export function approachCoordinates(airport: GeographicAirport, runway: Runway, point: WorldPoint) {
  const frame = runwayFrame(airport, runway), angle = frame.approachHeading * Math.PI / 180;
  const dx = point.x - frame.approachOrigin.x, dy = point.y - frame.approachOrigin.y;
  const axisAlongTrack = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const thresholdAlong = -(frame.threshold.x - frame.approachOrigin.x) * Math.sin(angle) + (frame.threshold.y - frame.approachOrigin.y) * Math.cos(angle);
  return { crossTrack: dx * Math.cos(angle) + dy * Math.sin(angle), alongTrack: axisAlongTrack - thresholdAlong, axisAlongTrack };
}

/** Upstream LOC-axis point, not a relocated pavement threshold or a certified procedure fix. */
export function approachPoint(airport: GeographicAirport, runway: Runway, distance: number): WorldPoint {
  const frame = runwayFrame(airport, runway), angle = frame.approachHeading * Math.PI / 180;
  const offset = (frame.threshold.x - frame.approachOrigin.x) * Math.sin(angle) - (frame.threshold.y - frame.approachOrigin.y) * Math.cos(angle);
  return { x: frame.approachOrigin.x + (offset - distance) * Math.sin(angle), y: frame.approachOrigin.y - (offset - distance) * Math.cos(angle) };
}

/** A simplified vector target inside the common KBOS core, not a published procedure fix. */
export function approachVectorPoint(airport: GeographicAirport, runway: Runway) {
  return approachPoint(airport, runway, airport.geographic ? 8 * 22.4 : 450);
}
