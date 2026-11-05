export type RunwayId = '09' | '36';
export interface Point { x: number; y: number }
export type Phase = 'parked' | 'taxiing' | 'stopped' | 'crossing-hold' | 'crossing' | 'holding' | 'taking-off' | 'approach' | 'go-around' | 'landing' | 'exiting' | 'awaiting-taxi' | 'turnaround';
export interface Aircraft {
  id: string;
  kind: 'departure' | 'arrival';
  phase: Phase;
  position: Point;
  /** Degrees clockwise from east, matching SVG rotation. */
  heading: number;
  runway: RunwayId;
  standId: string | null;
  destination: string;
  nodeId: string;
  route: string[];
  routeIndex: number;
  waiting: number;
  delay: number;
  age: number;
  goArounds: number;
  arrivalCounted: boolean;
  departureCounted: boolean;
  blocked: string | null;
  resumePhase: 'taxiing' | 'crossing-hold';
}
export interface GroundState {
  aircraft: Aircraft[];
  elapsed: number;
  accumulator: number;
  paused: boolean;
  speed: 1 | 2;
  shift: 'open' | 'closing' | 'complete';
  reservation: { owner: string; runway: RunwayId; operation: 'land' | 'takeoff' | 'cross' } | null;
  taxiOwner: string | null;
  operations: { arrivals: number; departures: number };
  totalDelay: number;
  nextSpawn: number;
  nextId: number;
  message: string;
}
export type AircraftCommand = 'taxi' | 'stop' | 'resume' | 'takeoff' | 'land' | 'cross';
export type GroundCommand =
  | { type: AircraftCommand; id: string; runway?: RunwayId }
  | { type: 'pause' }
  | { type: 'restart' }
  | { type: 'speed'; speed: 1 | 2 };
export interface AircraftAction {
  type: AircraftCommand;
  label: string;
  runway?: RunwayId;
  blocked: string | null;
}
export interface GroundAlert { id: string; severity: 'warning' | 'info'; message: string }
