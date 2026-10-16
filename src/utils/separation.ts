import { Plane } from '../types';

export interface SeparationOutcome {
  /** Pairs that became a collision on this pass. */
  collisions: number;
  /** At least one pair entered the conflict bubble. */
  warning: boolean;
}

/**
 * Short-term conflict alert. Mutates the passed planes in pair order.
 * A pair both below 1,000 ft is exempt. Otherwise under 20 units and
 * 1,000 ft is a collision, and under 55 units and 1,000 ft is a conflict.
 * A pair already marked for removal is not counted again.
 */
export function applySeparation(planes: Plane[]): SeparationOutcome {
  let collisions = 0;
  let warning = false;

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const p1 = planes[i];
      const p2 = planes[j];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const altDiff = Math.abs(p1.altitude - p2.altitude);

      const p1Safe = p1.altitude < 1000;
      const p2Safe = p2.altitude < 1000;
      const exempt = p1Safe && p2Safe;

      if (dist < 20 && altDiff < 1000 && !exempt) {
        if (!p1.markedForRemoval && !p2.markedForRemoval) {
          collisions += 1;
          p1.markedForRemoval = true;
          p2.markedForRemoval = true;
          p1.status = 'crashed';
          p2.status = 'crashed';
        }
      } else if (dist < 55 && altDiff < 1000 && !exempt) {
        p1.conflict = true;
        p2.conflict = true;
        if (p1.status !== 'crashed') p1.status = 'warning';
        if (p2.status !== 'crashed') p2.status = 'warning';
        if (!warning) warning = true;
      }
    }
  }

  return { collisions, warning };
}
