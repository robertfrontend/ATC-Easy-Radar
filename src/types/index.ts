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
  targetWaypoint?: string | null;
  markedForRemoval?: boolean;
  goAround?: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
