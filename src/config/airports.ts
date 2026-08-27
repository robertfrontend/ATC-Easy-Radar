import { Airport } from '../types';

export const AIRPORTS: Airport[] = [
  {
    id: 'london-lhr',
    name: 'London Heathrow',
    icao: 'EGLL',
    countryFlag: '🇬🇧',
    x: 500,
    y: 500,
    runways: [
      { id: 'egll-27l', label: '27L', heading: 270, length: 85, offsetX: 0, offsetY: 16 },
      { id: 'egll-27r', label: '27R', heading: 270, length: 85, offsetX: 0, offsetY: -16 },
      { id: 'egll-09l', label: '09L', heading: 90, length: 85, offsetX: 0, offsetY: -16 },
      { id: 'egll-09r', label: '09R', heading: 90, length: 85, offsetX: 0, offsetY: 16 },
    ],
    waypoints: [
      { id: 'WP-L1', label: 'BNN', x: 220, y: 150 },
      { id: 'WP-L2', label: 'LAMBO', x: 780, y: 160 },
      { id: 'WP-L3', label: 'BIGIN', x: 760, y: 820 },
      { id: 'WP-L4', label: 'OCKHM', x: 240, y: 800 },
      { id: 'WP-L5', label: 'MAYFI', x: 420, y: 460 },
      { id: 'WP-L6', label: 'MAXIT', x: 430, y: 720 },
    ],
    holdingStacks: [
      { id: 'stack-bnn', label: 'BNN', x: 260, y: 140, width: 140, height: 75, rotation: -15 },
      { id: 'stack-lam', label: 'LAM', x: 740, y: 150, width: 140, height: 75, rotation: 15 },
      { id: 'stack-big', label: 'BIG', x: 720, y: 840, width: 140, height: 75, rotation: -10 },
      { id: 'stack-ock', label: 'OCK', x: 280, y: 850, width: 150, height: 80, rotation: 12 },
    ],
    airspacePolygons: [
      // Central London CTR zone (curved/angled polygon around Heathrow)
      { id: 'egll-ctr', points: '320,340 680,340 760,370 760,540 680,660 320,660 240,540 240,370' },
      // Northern & Eastern sector lines
      { id: 'egll-north-sector', points: '240,370 120,220 880,220 760,370', dashed: true },
      { id: 'egll-south-sector', points: '240,540 120,780 880,780 760,540', dashed: true },
    ],
    airlines: [
      { code: 'BAW', name: 'British Airways', flag: '🇬🇧', weight: 40, models: ['A320', 'A321', 'B77W', 'A359'] },
      { code: 'VIR', name: 'Virgin Atlantic', flag: '🇬🇧', weight: 15, models: ['A359', 'B789'] },
      { code: 'AAL', name: 'American Airlines', flag: '🇺🇸', weight: 10, models: ['B772', 'B77W'] },
      { code: 'AFR', name: 'Air France', flag: '🇫🇷', weight: 5, models: ['A320', 'A223'] },
      { code: 'IBE', name: 'Iberia', flag: '🇪🇸', weight: 5, models: ['A320', 'A321'] },
    ]
  },
  {
    id: 'logan-int',
    name: 'Logan Intl Airport',
    icao: 'KBOS',
    countryFlag: '🇺🇸',
    x: 500,
    y: 500,
    runways: [
      { id: 'bos-33l', label: '33L', heading: 330, length: 75, offsetX: 10, offsetY: -5 },
      { id: 'bos-27', label: '27', heading: 270, length: 65, offsetX: -5, offsetY: 15 },
      { id: 'bos-04r', label: '04R', heading: 40, length: 70, offsetX: -12, offsetY: -10 },
      { id: 'bos-15r', label: '15R', heading: 150, length: 75, offsetX: 10, offsetY: -5 },
    ],
    waypoints: [
      { id: 'WP-B1', label: 'HARBR', x: 500, y: 150 },
      { id: 'WP-B2', label: 'INLET', x: 850, y: 250 },
      { id: 'WP-B3', label: 'JETTY', x: 900, y: 550 },
      { id: 'WP-B4', label: 'LIGHT', x: 250, y: 850 },
      { id: 'WP-B5', label: 'BOSOX', x: 200, y: 350 },
    ],
    holdingStacks: [
      { id: 'stack-harbr', label: 'HARBR', x: 500, y: 140, width: 140, height: 75, rotation: 0 },
      { id: 'stack-jetty', label: 'JETTY', x: 880, y: 550, width: 140, height: 75, rotation: 45 },
    ],
    airspacePolygons: [
      { id: 'bos-class-b', points: '340,320 660,320 740,400 740,600 660,680 340,680 260,600 260,400' },
      { id: 'bos-coastline', points: '200,100 350,300 450,480 480,700 420,900', dashed: true },
    ],
    airlines: [
      { code: 'JBU', name: 'JetBlue', flag: '🇺🇸', weight: 30, models: ['A320', 'A321', 'E190'] },
      { code: 'AAL', name: 'American Airlines', flag: '🇺🇸', weight: 20, models: ['B738', 'A321', 'B772'] },
      { code: 'DAL', name: 'Delta Air Lines', flag: '🇺🇸', weight: 20, models: ['A320', 'B738', 'A321'] },
      { code: 'BAW', name: 'British Airways', flag: '🇬🇧', weight: 5, models: ['B77W', 'A359', 'B789'] },
    ]
  },
  {
    id: 'las-americas',
    name: 'Las Américas Intl',
    icao: 'MDSD',
    countryFlag: '🇩🇴',
    x: 500,
    y: 500,
    runways: [
      { id: 'mdsd-17', label: '17', heading: 170, length: 80, offsetX: 0, offsetY: 0 },
      { id: 'mdsd-35', label: '35', heading: 350, length: 80, offsetX: 0, offsetY: 0 },
    ],
    waypoints: [
      { id: 'WP-D1', label: 'OCEAN', x: 500, y: 850 },
      { id: 'WP-D2', label: 'PALMA', x: 850, y: 750 },
      { id: 'WP-D3', label: 'QUEEN', x: 900, y: 450 },
      { id: 'WP-D4', label: 'UPWAY', x: 150, y: 750 },
    ],
    holdingStacks: [
      { id: 'stack-ocean', label: 'OCEAN', x: 500, y: 840, width: 140, height: 75, rotation: 0 },
    ],
    airspacePolygons: [
      { id: 'mdsd-ctr', points: '350,300 650,300 700,500 650,700 350,700 300,500' },
      { id: 'mdsd-caribbean', points: '100,550 400,520 700,540 900,580', dashed: true },
    ],
    airlines: [
      { code: 'DWI', name: 'Arajet / Pawa', flag: '🇩🇴', weight: 25, models: ['B38M', 'B738', 'E190'] },
      { code: 'JBU', name: 'JetBlue', flag: '🇺🇸', weight: 20, models: ['A320', 'A321'] },
      { code: 'IBE', name: 'Iberia', flag: '🇪🇸', weight: 10, models: ['A332', 'A359'] },
      { code: 'CMP', name: 'Copa Airlines', flag: '🇵🇦', weight: 10, models: ['B738', 'B39M'] },
    ]
  },
  {
    id: 'dubai-int',
    name: 'Dubai Intl Airport',
    icao: 'OMDB',
    countryFlag: '🇦🇪',
    x: 500,
    y: 500,
    runways: [
      { id: 'omdb-30l', label: '30L', heading: 300, length: 85, offsetX: -16, offsetY: 12 },
      { id: 'omdb-30r', label: '30R', heading: 300, length: 85, offsetX: 16, offsetY: -12 },
      { id: 'omdb-12l', label: '12L', heading: 120, length: 85, offsetX: 16, offsetY: -12 },
      { id: 'omdb-12r', label: '12R', heading: 120, length: 85, offsetX: -16, offsetY: 12 },
    ],
    waypoints: [
      { id: 'WP-DX1', label: 'DESRT', x: 800, y: 200 },
      { id: 'WP-DX2', label: 'BURJK', x: 200, y: 300 },
      { id: 'WP-DX3', label: 'PALMJ', x: 150, y: 700 },
      { id: 'WP-DX4', label: 'DUNEA', x: 850, y: 800 },
    ],
    holdingStacks: [
      { id: 'stack-desrt', label: 'DESRT', x: 800, y: 200, width: 140, height: 75, rotation: -30 },
      { id: 'stack-dunea', label: 'DUNEA', x: 850, y: 800, width: 140, height: 75, rotation: 30 },
    ],
    airspacePolygons: [
      { id: 'omdb-ctr', points: '300,320 680,280 750,520 680,680 320,680 260,480' },
      { id: 'omdb-gulf', points: '120,150 320,380 480,550 620,750', dashed: true },
    ],
    airlines: [
      { code: 'UAE', name: 'Emirates', flag: '🇦🇪', weight: 50, models: ['B77W', 'A388', 'A359'] },
      { code: 'FDB', name: 'FlyDubai', flag: '🇦🇪', weight: 20, models: ['B738', 'B38M'] },
      { code: 'QFA', name: 'Qantas', flag: '🇦🇺', weight: 5, models: ['B789', 'A388'] },
      { code: 'DLH', name: 'Lufthansa', flag: '🇩🇪', weight: 5, models: ['A359', 'B748'] },
      { code: 'AIC', name: 'Air India', flag: '🇮🇳', weight: 10, models: ['A320', 'B788', 'B77W'] },
    ]
  },
  {
    id: 'amsterdam-ams',
    name: 'Amsterdam Schiphol',
    icao: 'EHAM',
    countryFlag: '🇳🇱',
    x: 500,
    y: 500,
    runways: [
      { id: 'eham-18r', label: '18R', heading: 180, length: 85, offsetX: -35, offsetY: -20 },
      { id: 'eham-36c', label: '36C', heading: 0, length: 80, offsetX: 0, offsetY: 0 },
      { id: 'eham-06', label: '06', heading: 60, length: 80, offsetX: 15, offsetY: 25 },
      { id: 'eham-24', label: '24', heading: 240, length: 80, offsetX: 15, offsetY: 25 },
    ],
    waypoints: [
      { id: 'WP-A1', label: 'SUGOL', x: 500, y: 100 },
      { id: 'WP-A2', label: 'RIVER', x: 900, y: 500 },
      { id: 'WP-A3', label: 'COAST', x: 100, y: 500 },
      { id: 'WP-A4', label: 'POLDER', x: 500, y: 900 },
    ],
    holdingStacks: [
      { id: 'stack-sugol', label: 'SUGOL', x: 500, y: 100, width: 140, height: 75, rotation: 0 },
      { id: 'stack-river', label: 'RIVER', x: 900, y: 500, width: 140, height: 75, rotation: 90 },
    ],
    airspacePolygons: [
      { id: 'eham-ctr', points: '320,320 680,320 720,480 680,680 320,680 280,480' },
    ],
    airlines: [
      { code: 'KLM', name: 'KLM Royal Dutch', flag: '🇳🇱', weight: 45, models: ['B738', 'B77W', 'B789', 'E190'] },
      { code: 'TRA', name: 'Transavia', flag: '🇳🇱', weight: 15, models: ['B738', 'A321'] },
      { code: 'DLH', name: 'Lufthansa', flag: '🇩🇪', weight: 10, models: ['A320', 'A321'] },
      { code: 'BAW', name: 'British Airways', flag: '🇬🇧', weight: 5, models: ['A320', 'A319'] },
      { code: 'EZY', name: 'easyJet', flag: '🇬🇧', weight: 10, models: ['A320', 'A321'] },
    ]
  },
  {
    id: 'panama-pty',
    name: 'Panama Tocumen',
    icao: 'MPTO',
    countryFlag: '🇵🇦',
    x: 500,
    y: 500,
    runways: [
      { id: 'mpto-03l', label: '03L', heading: 30, length: 85, offsetX: -16, offsetY: 10 },
      { id: 'mpto-03r', label: '03R', heading: 30, length: 85, offsetX: 16, offsetY: -10 },
      { id: 'mpto-21l', label: '21L', heading: 210, length: 85, offsetX: 16, offsetY: -10 },
      { id: 'mpto-21r', label: '21R', heading: 210, length: 85, offsetX: -16, offsetY: 10 },
    ],
    waypoints: [
      { id: 'WP-P1', label: 'CANAL', x: 200, y: 400 },
      { id: 'WP-P2', label: 'TABOG', x: 300, y: 800 },
      { id: 'WP-P3', label: 'DARIW', x: 800, y: 600 },
      { id: 'WP-P4', label: 'CHAGR', x: 600, y: 150 },
    ],
    holdingStacks: [
      { id: 'stack-canal', label: 'CANAL', x: 200, y: 400, width: 140, height: 75, rotation: 45 },
    ],
    airspacePolygons: [
      { id: 'mpto-ctr', points: '320,320 680,320 720,500 680,680 320,680 280,500' },
      { id: 'mpto-canal-zone', points: '120,250 280,450 350,750', dashed: true },
    ],
    airlines: [
      { code: 'CMP', name: 'Copa Airlines', flag: '🇵🇦', weight: 60, models: ['B738', 'B39M', 'B737'] },
      { code: 'AVA', name: 'Avianca', flag: '🇨🇴', weight: 10, models: ['A320', 'A320N'] },
      { code: 'AAL', name: 'American Airlines', flag: '🇺🇸', weight: 10, models: ['B738', 'A321'] },
      { code: 'KLM', name: 'KLM Royal Dutch', flag: '🇳🇱', weight: 5, models: ['B77W', 'B789'] },
      { code: 'IBE', name: 'Iberia', flag: '🇪🇸', weight: 5, models: ['A332', 'A359'] },
    ]
  }
];



