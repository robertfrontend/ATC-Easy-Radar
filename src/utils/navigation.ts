import { Airport, Plane } from '../types';

export interface NavigationIntent {
  targetHeading: number;
  targetWaypoint: string | null;
  markedForRemoval: boolean;
}

/**
 * Heading and direct-to guidance for one simulation tick.
 *
 * Departures remember an exit fix (`exitWaypointId`) but do not turn toward it
 * on their own. Until the controller clears them direct, or assigns a heading,
 * they keep the runway heading they took off on — including after the initial
 * climb. An explicit direct-to is followed immediately, even below 2,500 ft.
 */
export function resolveNavigation(plane: Plane, airport: Airport): NavigationIntent {
  let targetHeading = plane.targetHeading;
  let targetWaypoint = plane.targetWaypoint ?? null;
  let markedForRemoval = plane.markedForRemoval ?? false;

  const holdRunwayHeading =
    plane.type === 'departure' &&
    plane.altitude < 2500 &&
    !!plane.assignedRunwayId &&
    !targetWaypoint &&
    !plane.headingAssigned;

  if (holdRunwayHeading) {
    const depRwy = airport.runways.find(r => r.id === plane.assignedRunwayId);
    if (depRwy) targetHeading = depRwy.heading;
  } else if (targetWaypoint && !plane.isEstablished && plane.status !== 'crashed') {
    const wp = airport.waypoints.find(w => w.id === targetWaypoint);
    if (wp) {
      const distToWp = Math.hypot(wp.x - plane.x, wp.y - plane.y);
      if (distToWp < 35) {
        if (plane.type === 'departure') {
          markedForRemoval = true;
        } else {
          targetWaypoint = null;
        }
      } else {
        let headingToWp = (Math.atan2(wp.y - plane.y, wp.x - plane.x) * 180 / Math.PI) + 90;
        headingToWp = (headingToWp + 360) % 360;
        let angleDiff = headingToWp - plane.targetHeading;
        while (angleDiff <= -180) angleDiff += 360;
        while (angleDiff > 180) angleDiff -= 360;
        if (Math.abs(angleDiff) > 1.0) targetHeading = headingToWp;
      }
    }
  }

  return { targetHeading, targetWaypoint, markedForRemoval };
}

/**
 * Merge a controller clearance into a plane.
 * A direct-to releases the automatic runway track. An explicit heading, or
 * cancelling a direct-to, keeps whatever heading was assigned instead of
 * snapping back to the runway.
 */
export function applyClearance(plane: Plane, updates: Partial<Plane>): Plane {
  const next: Plane = {
    ...plane,
    ...updates,
    hasInstructions: true,
    goAround: updates.goAround ?? false,
  };

  const headingChanged =
    updates.targetHeading !== undefined &&
    Math.round(updates.targetHeading) !== Math.round(plane.targetHeading);

  if (updates.targetWaypoint) {
    next.headingAssigned = false;
  } else if (headingChanged || (updates.targetWaypoint === null && !!plane.targetWaypoint)) {
    next.headingAssigned = true;
  }

  return next;
}
