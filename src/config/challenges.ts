import { Difficulty } from '../types';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  airportId: string;
  difficulty: Difficulty;
  goal: number;
}

/** Presets point at the shared airport catalogue; geometry stays in airports.ts. */
export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'caribbean-first-shift',
    title: 'Caribbean first shift',
    description: 'Build a clean rhythm with six safe operations at Las Américas.',
    airportId: 'las-americas',
    difficulty: 'easy',
    goal: 6,
  },
  {
    id: 'panama-connections',
    title: 'Panama connections',
    description: 'Keep eight arrivals and departures moving through Tocumen.',
    airportId: 'panama-pty',
    difficulty: 'medium',
    goal: 8,
  },
  {
    id: 'heathrow-rush',
    title: 'Heathrow rush',
    description: 'Sequence ten safe operations across Heathrow’s parallel runways.',
    airportId: 'london-lhr',
    difficulty: 'medium',
    goal: 10,
  },
  {
    id: 'boston-crossroads',
    title: 'Boston crossroads',
    description: 'Manage ten safe operations with Logan’s intersecting runway layout.',
    airportId: 'logan-int',
    difficulty: 'hard',
    goal: 10,
  },
  {
    id: 'schiphol-flow',
    title: 'Schiphol flow',
    description: 'Stay ahead of the traffic through twelve safe Schiphol operations.',
    airportId: 'amsterdam-ams',
    difficulty: 'hard',
    goal: 12,
  },
  {
    id: 'dubai-express',
    title: 'Dubai express',
    description: 'Complete twelve safe operations as Dubai traffic builds.',
    airportId: 'dubai-int',
    difficulty: 'hard',
    goal: 12,
  },
];
