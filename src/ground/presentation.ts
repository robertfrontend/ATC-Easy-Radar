import { NODES, RUNWAYS, distance } from './airport';
import type { Aircraft, Phase } from './model';
import { trackPresentation } from '../utils/trackPresentation';
import { GROUND_VIEW } from './airport';

const groundPhase: Record<Phase, string> = {
  parked: 'PARKED', taxiing: 'TAXI', stopped: 'STOPPED',
  'crossing-hold': 'HOLD CROSS', crossing: 'CROSSING', holding: 'HOLD SHORT',
  'taking-off': 'TAKEOFF', approach: 'APPROACH', 'go-around': 'GO AROUND',
  landing: 'LANDING', exiting: 'EXITING', 'awaiting-taxi': 'AWAIT TAXI', turnaround: 'AT GATE',
};

/** Ground tracks have no invented airspace altitude, speed or exit-fix readout. */
export function groundTrackReadout(aircraft: Aircraft) {
  const atGate = aircraft.phase === 'parked' || aircraft.phase === 'turnaround';
  const taxiToGate = aircraft.kind === 'arrival' && ['taxiing', 'stopped', 'crossing-hold', 'crossing', 'awaiting-taxi'].includes(aircraft.phase);
  const gate = (atGate || taxiToGate) && aircraft.standId?.split('-')[1];
  return { line1: aircraft.id, line2: groundPhase[aircraft.phase], line3: gate ? `GATE ${gate}` : `RWY ${aircraft.runway}` };
}

export function groundTrackPresentation(aircraft: Aircraft, scale: number, nearbyIndex = 0, clusterSize = 1) {
  const readout = groundTrackReadout(aircraft);
  const view = { x: GROUND_VIEW.x, y: GROUND_VIEW.y, w: GROUND_VIEW.width, h: GROUND_VIEW.height };
  const metrics = trackPresentation(aircraft.position, readout, view, scale);
  const projection = 1 / metrics.inverseScale;
  const top = (view.y - aircraft.position.y) * projection + 15;
  const bottom = (view.y + view.h - aircraft.position.y) * projection - 33;
  // Vertically stagger close gate blocks; keep the whole cluster inside the scene.
  const firstRow = Math.max(top, Math.min(-40, bottom - (clusterSize - 1) * 44));
  const moving = !aircraft.blocked && ['taxiing', 'crossing', 'taking-off', 'approach', 'go-around', 'landing', 'exiting'].includes(aircraft.phase);
  return {
    ...metrics, readout,
    labelY: Math.max(top, Math.min(bottom, firstRow + nearbyIndex * 44)),
    // Existing radar arrows point north at zero; surface headings start at east.
    heading: moving ? aircraft.heading + 90 : null,
  };
}

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
