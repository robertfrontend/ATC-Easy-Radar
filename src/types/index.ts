export interface Waypoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface Airline {
  code: string;
  name?: string;
  flag: string;
  weight: number; // For frequency of spawn (higher = more frequent)
  models?: string[];
}

export interface Runway {
  id: string;
  label: string;
  heading: number;
  length?: number;
  offsetX?: number;
  offsetY?: number;
}

export type RunwayConfig = Record<string, {
  landing: boolean;   // Active ILS for arrivals
  departure: boolean; // Active for takeoffs
}>;

export interface AirspacePolygon {
  id: string;
  points: string;
  label?: string;
  dashed?: boolean;
}

export interface HoldingStack {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Airport {
  id: string;
  name: string;
  icao: string;
  countryFlag: string;
  elevation?: number;
  x: number;
  y: number;
  waypoints: Waypoint[];
  airlines: Airline[];
  runways: Runway[];
  airspacePolygons?: AirspacePolygon[];
  holdingStacks?: HoldingStack[];
}

export interface Plane {
  id: string;
  callsign: string;
  model: string;
  squawk: string;
  type: 'arrival' | 'departure';
  x: number;
  y: number;
  heading: number;
  targetHeading: number;
  altitude: number;
  targetAltitude: number;
  speed: number;
  targetSpeed: number;
  trail: { x: number; y: number }[];
  status: 'normal' | 'warning' | 'crashed' | 'bad_approach';
  isEstablished: boolean;
  establishedRunwayId?: string | null;
  assignedRunwayId?: string | null;
  hasInstructions: boolean;
  originFlag: string;
  /** Active direct-to. Departures leave this empty until the controller clears it. */
  targetWaypoint?: string | null;
  /** Exit fix assigned at takeoff. Not flown until a direct-to clearance. */
  exitWaypointId?: string | null;
  /** Controller has assigned a heading, so the automatic runway track must not override it. */
  headingAssigned?: boolean;
  markedForRemoval?: boolean;
  goAround?: boolean;
  conflict?: boolean;
}

export interface RadarLayers {
  showRangeRings: boolean;
  showFixes: boolean;
  showVectors: boolean;
  showTrails: boolean;
  showHalos: boolean;
  showExtendedCenterlines: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameSpeed = 'real' | 0.5 | 1 | 2 | 4;

export interface SavedGame {
  id: string;
  savedAt: number;
  score: number;
  accidents: number;
  difficulty: Difficulty;
  airportId: string;
  planesActive: number;
  gameSpeed?: GameSpeed;
  mode?: 'tutorial' | 'shift' | 'free';
  points?: number;
  goal?: number;
}


