import { Plane } from '../types';

/**
 * Scope paint priority, matching the pre-restyle track states.
 * Conflict, selection, and alerts still win. Otherwise an arrival with no
 * clearance is uncontrolled, a departure is its own hue, and every other
 * arrival — including one on the localizer — shares the arrival hue.
 */
export type TrackRole =
  | 'conflict'
  | 'selected'
  | 'alert'
  | 'uncontrolled'
  | 'departure'
  | 'arrival';

export function trackRole(
  plane: Pick<Plane, 'type' | 'status' | 'conflict' | 'hasInstructions' | 'isEstablished'>,
  selected: boolean,
): TrackRole {
  if (plane.conflict || plane.status === 'warning' || plane.status === 'crashed') return 'conflict';
  if (selected) return 'selected';
  if (plane.status === 'bad_approach') return 'alert';
  if (!plane.hasInstructions && !plane.isEstablished) return 'uncontrolled';
  if (plane.type === 'departure') return 'departure';
  return 'arrival';
}
