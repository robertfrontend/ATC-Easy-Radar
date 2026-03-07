import { Airport } from '../types';

export const AIRPORTS: Airport[] = [
  {
    id: 'test-airport',
    name: 'Test Regional Airport',
    icao: 'KXXX',
    runwayLabel: '36',
    runwayHeading: 0,
    x: 500,
    y: 500,
    waypoints: [
      { id: 'WP-A', label: 'ALPHA',   x: 500, y: 100 },  // N
      { id: 'WP-B', label: 'BRAVO',   x: 830, y: 170 },  // NE
      { id: 'WP-C', label: 'CHARLIE', x: 900, y: 500 },  // E
      { id: 'WP-D', label: 'DELTA',   x: 830, y: 830 },  // SE
      { id: 'WP-E', label: 'ECHO',    x: 170, y: 830 },  // SW
      { id: 'WP-F', label: 'FOXTROT', x: 100, y: 500 },  // W
      { id: 'WP-G', label: 'GOLF',    x: 170, y: 170 },  // NW
    ]
  },
  {
    id: 'logan-int',
    name: 'Logan Intl Airport',
    icao: 'KBOS',
    runwayLabel: '33L',
    runwayHeading: 330,
    x: 500,
    y: 500,
    waypoints: [
      { id: 'WP-H', label: 'HARBR',   x: 500, y: 150 },
      { id: 'WP-I', label: 'INLET',   x: 850, y: 250 },
      { id: 'WP-J', label: 'JETTY',   x: 900, y: 550 },
      { id: 'WP-K', label: 'KAYAK',   x: 750, y: 850 },
      { id: 'WP-L', label: 'LIGHT',   x: 250, y: 850 },
      { id: 'WP-M', label: 'MARSH',   x: 100, y: 550 },
      { id: 'WP-N', label: 'NAVIG',   x: 150, y: 250 },
    ]
  },
  {
    id: 'las-americas',
    name: 'Las Américas Intl',
    icao: 'MDSD',
    runwayLabel: '17',
    runwayHeading: 170,
    x: 500,
    y: 500,
    waypoints: [
      { id: 'WP-O', label: 'OCEAN',   x: 500, y: 850 },
      { id: 'WP-P', label: 'PALMA',   x: 850, y: 750 },
      { id: 'WP-Q', label: 'QUEEN',   x: 900, y: 450 },
      { id: 'WP-R', label: 'REEFS',   x: 750, y: 150 },
      { id: 'WP-S', label: 'SUNNY',   x: 250, y: 150 },
      { id: 'WP-T', label: 'TIDES',   x: 100, y: 450 },
      { id: 'WP-U', label: 'UPWAY',   x: 150, y: 750 },
    ]
  }
];
