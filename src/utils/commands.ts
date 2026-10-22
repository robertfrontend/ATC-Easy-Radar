import { approachVectorPoint } from '../geography/navigation';
import { toTrueHeading } from '../geography/headings';
import { Airport, Plane, Runway, RunwayConfig } from '../types';

export interface CommandContext {
  airport: Airport;
  runwayConfig: RunwayConfig;
  plane: Plane;
}

function vectorToRunway(plane: Plane, airport: Airport, rwy: Runway): Partial<Plane> {
  const fafPoint = approachVectorPoint(airport, rwy);
  const angle = (Math.atan2(fafPoint.y - plane.y, fafPoint.x - plane.x) * 180 / Math.PI) + 90;
  return {
    targetHeading: Math.round((angle + 360) % 360),
    targetAltitude: 3000,
    targetSpeed: 180,
    targetWaypoint: null,
    assignedRunwayId: rwy.id,
  };
}

/**
 * Parse one ATC console line into a plane update.
 * Returns null when nothing in the line is a recognized clearance.
 *
 * `DEP` clears a departure direct to the exit fix assigned at takeoff.
 * `UPWIND` cancels that direct and puts the aircraft back on runway heading.
 */
export function parseAtcCommand(raw: string, ctx: CommandContext): Partial<Plane> | null {
  const fullCmd = raw.trim().toUpperCase();
  if (!fullCmd) return null;

  const { airport, runwayConfig, plane } = ctx;
  const updates: Partial<Plane> = {};
  let anyValid = false;

  const rwyMatch = fullCmd.match(/(?:ILS|RWY|FINAL)\s*([0-9]{1,2}[LRC]?)/);
  if (rwyMatch) {
    const rwy = airport.runways.find(r => r.label === rwyMatch[1]);
    if (rwy) {
      Object.assign(updates, vectorToRunway(plane, airport, rwy));
      anyValid = true;
    }
  } else if ((fullCmd.includes('FINAL') || fullCmd.includes('ILS')) && airport.runways.length > 0) {
    const activeLanding = airport.runways.find(r => runwayConfig[r.id]?.landing) || airport.runways[0];
    Object.assign(updates, vectorToRunway(plane, airport, activeLanding));
    anyValid = true;
  }

  const tokens = fullCmd.split(/\s+/);
  for (const token of tokens) {
    if (token === 'DEP') {
      if (plane.type === 'departure' && plane.exitWaypointId) {
        updates.targetWaypoint = plane.exitWaypointId;
        anyValid = true;
      }
      continue;
    }

    if (token === 'UPWIND') {
      const rwy =
        airport.runways.find(r => r.id === plane.assignedRunwayId) ||
        airport.runways.find(r => runwayConfig[r.id]?.departure) ||
        airport.runways[0];
      if (rwy) {
        updates.targetHeading = rwy.heading;
        updates.targetWaypoint = null;
        anyValid = true;
      }
      continue;
    }

    const wp = airport.waypoints.find(w => w.label.toUpperCase() === token);
    if (wp) {
      updates.targetWaypoint = wp.id;
      if (plane.type !== 'departure') updates.assignedRunwayId = null;
      anyValid = true;
    }
  }

  // Strip approach phrases first so "ILS 33L" is not read as speed 33.
  const withoutApproach = fullCmd.replace(/(?:ILS|RWY|FINAL)\s*[0-9]{1,2}[LRC]?/g, ' ');
  const cmdRegex = /([CDHS])\s?(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = cmdRegex.exec(withoutApproach)) !== null) {
    const prefix = match[1];
    const val = parseInt(match[2], 10);
    if (Number.isNaN(val)) continue;

    if (prefix === 'C' || prefix === 'D') {
      updates.targetAltitude = val;
      anyValid = true;
    } else if (prefix === 'H') {
      updates.targetHeading = toTrueHeading(val % 360, airport);
      updates.targetWaypoint = null;
      anyValid = true;
    } else if (prefix === 'S') {
      updates.targetSpeed = val;
      anyValid = true;
    }
  }

  return anyValid ? updates : null;
}
