import { Airport, Plane } from '../types';

/**
 * Three-line scope data block.
 * Departures show the assigned exit fix (OCKHM, BNN, …) in place of the
 * heading field so the controller can clear them direct without opening
 * the strip. The block stays three lines.
 */
export function trackReadout(plane: Plane, airport: Airport) {
  const curHundreds = Math.round(plane.altitude / 100);
  const tgtHundreds = Math.round(plane.targetAltitude / 100);
  const prefix = plane.altitude >= 6000 ? 'F' : 'A';
  const curAltStr = `${prefix}${curHundreds}`;
  const altDiff = plane.targetAltitude - plane.altitude;
  const trendSign = altDiff < -150 ? `↓${tgtHundreds}` :
    altDiff > 150 ? `↑${tgtHundreds}` :
    `=${curHundreds}`;

  const estRwy = airport.runways.find(r => r.id === plane.establishedRunwayId);
  const directLabel = plane.targetWaypoint
    ? airport.waypoints.find(w => w.id === plane.targetWaypoint)?.label || 'DIR'
    : null;
  const exitLabel = plane.type === 'departure' && plane.exitWaypointId
    ? airport.waypoints.find(w => w.id === plane.exitWaypointId)?.label || null
    : null;

  let field = '';
  let headingField = false;
  if (plane.isEstablished) {
    field = `ILS${estRwy ? estRwy.label : 'LOC'}`;
  } else if (directLabel) {
    field = directLabel;
  } else if (exitLabel) {
    field = exitLabel;
  } else {
    field = Math.round(plane.heading).toString().padStart(3, '0');
    headingField = true;
  }

  const speed = Math.round(plane.speed);
  const line3 = headingField ? `${speed}H ${field}` : `${speed} ${field}`;
  return { line1: plane.callsign, line2: `${curAltStr} ${trendSign}`, line3 };
}
