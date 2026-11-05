import { NODES, RUNWAYS, distance } from './airport';
import type { Aircraft } from './model';

/** Fictional silhouettes share the same protected surface envelope. */
export function aircraftAppearance(id: string) {
  return Number(id.replace(/\D/g, '')) % 2
    ? { airframe: 'single-prop' as const, name: 'Single-engine propeller', engines: 1, radius: 16 }
    : { airframe: 'twin-jet' as const, name: 'Twin-engine jet', engines: 2, radius: 21 };
}

/** Visual height only: the clearance/state machine remains authoritative. */
export function aircraftHeight(aircraft: Aircraft): number {
  if (aircraft.phase === 'approach' || aircraft.phase === 'go-around') return 1;
  const runway = RUNWAYS[aircraft.runway];
  if (aircraft.phase === 'landing' && aircraft.routeIndex === 0) {
    return Math.min(1, distance(aircraft.position, NODES[runway.threshold]) / 160);
  }
  if (aircraft.phase === 'taking-off' && aircraft.routeIndex >= 2) {
    return Math.min(1, distance(aircraft.position, NODES[`end-${aircraft.runway}`]) / 140);
  }
  return 0;
}

export function arrivalInstruction(aircraft: Aircraft): string {
  if (aircraft.kind !== 'arrival') return '';
  const gate = aircraft.standId?.split('-')[1];
  switch (aircraft.phase) {
    case 'approach': return `Select this flight, then Clear landing ${aircraft.runway}. Without clearance it will fly a visible circuit.`;
    case 'go-around': return 'Returning in the visible circuit. Landing clearance becomes available on the next approach.';
    case 'landing': return aircraftHeight(aircraft) > 0 ? 'Cleared to land. Watch the aircraft descend onto the runway.' : 'Touchdown. Decelerating before the runway exit.';
    case 'exiting': return 'Vacating the runway automatically. Wait until the whole aircraft is clear.';
    case 'awaiting-taxi': return `Runway clear. Select Taxi to stand ${gate} to continue to Gate ${gate}.`;
    case 'crossing-hold': return 'Stopped before a runway. Authorize the separate crossing to continue to the gate.';
    case 'turnaround': return `Gate ${gate} reached. Arrival completed and counted.`;
    case 'taxiing': return `Taxiing to Gate ${gate} on the cleared route; crossings need separate clearance.`;
    default: return '';
  }
}
