export interface Waypoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface Airline {
  code: string;
  flag: string;
  weight: number; // For frequency of spawn (higher = more frequent)
}

export interface Airport {
  id: string;
  name: string;
  icao: string;
  runwayLabel: string;
  runwayHeading: number; // magnetic heading planes land on (0-359)
  x: number;
  y: number;
  waypoints: Waypoint[];
  airlines: Airline[];
}

export interface Plane {
  id: string;
  callsign: string;
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
  hasInstructions: boolean;
  originFlag: string;
  targetWaypoint?: string | null;
  markedForRemoval?: boolean;
  goAround?: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SavedGame {
  id: string;
  savedAt: number;
  score: number;
  accidents: number;
  difficulty: Difficulty;
  airportId: string;
  planesActive: number;
}
