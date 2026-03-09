import { Airport } from '../types';

export const AIRPORTS: Airport[] = [
  {
    id: 'logan-int',
    name: 'Logan Intl Airport',
    icao: 'KBOS',
    countryFlag: '🇺🇸',
    x: 500,
    y: 500,
    runways: [
      { label: '33L', heading: 330 },
      { label: '27', heading: 270 },
      { label: '04R', heading: 40 },
    ],
    waypoints: [
      { id: 'WP-B1', label: 'HARBR', x: 500, y: 150 },
      { id: 'WP-B2', label: 'INLET', x: 850, y: 250 },
      { id: 'WP-B3', label: 'JETTY', x: 900, y: 550 },
      { id: 'WP-B4', label: 'LIGHT', x: 250, y: 850 },
    ],
    airlines: [
      { code: 'JBU', flag: '🇺🇸', weight: 30 },
      { code: 'AAL', flag: '🇺🇸', weight: 20 },
      { code: 'DAL', flag: '🇺🇸', weight: 20 },
      { code: 'BAW', flag: '🇬🇧', weight: 5 },
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
      { label: '17', heading: 170 },
      { label: '35', heading: 350 },
    ],
    waypoints: [
      { id: 'WP-D1', label: 'OCEAN', x: 500, y: 850 },
      { id: 'WP-D2', label: 'PALMA', x: 850, y: 750 },
      { id: 'WP-D3', label: 'QUEEN', x: 900, y: 450 },
      { id: 'WP-D4', label: 'UPWAY', x: 150, y: 750 },
    ],
    airlines: [
      { code: 'DWI', flag: '🇩🇴', weight: 25 },
      { code: 'JBU', flag: '🇺🇸', weight: 20 },
      { code: 'IBE', flag: '🇪🇸', weight: 10 },
      { code: 'CMP', flag: '🇵🇦', weight: 10 },
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
      { label: '30L', heading: 300 },
      { label: '30R', heading: 300 },
      { label: '12L', heading: 120 },
    ],
    waypoints: [
      { id: 'WP-DX1', label: 'DESRT', x: 800, y: 200 },
      { id: 'WP-DX2', label: 'BURJK', x: 200, y: 300 },
      { id: 'WP-DX3', label: 'PALMJ', x: 150, y: 700 },
      { id: 'WP-DX4', label: 'DUNEA', x: 850, y: 800 },
    ],
    airlines: [
      { code: 'UAE', flag: '🇦🇪', weight: 50 }, // Emirates
      { code: 'FDB', flag: '🇦🇪', weight: 20 }, // FlyDubai
      { code: 'QFA', flag: '🇦🇺', weight: 5 },
      { code: 'DLH', flag: '🇩🇪', weight: 5 },
      { code: 'AIC', flag: '🇮🇳', weight: 10 },
    ]
  },
  {
    id: 'london-lhr',
    name: 'London Heathrow',
    icao: 'EGLL',
    countryFlag: '🇬🇧',
    x: 500,
    y: 500,
    runways: [
      { label: '27R', heading: 270 },
      { label: '27L', heading: 270 },
      { label: '09R', heading: 90 },
    ],
    waypoints: [
      { id: 'WP-L1', label: 'LAMBO', x: 800, y: 150 },
      { id: 'WP-L2', label: 'BIGIN', x: 850, y: 800 },
      { id: 'WP-L3', label: 'OCKHM', x: 200, y: 850 },
      { id: 'WP-L4', label: 'BOVIN', x: 150, y: 200 },
    ],
    airlines: [
      { code: 'BAW', flag: '🇬🇧', weight: 40 }, // British Airways
      { code: 'VIR', flag: '🇬🇧', weight: 15 }, // Virgin Atlantic
      { code: 'AAL', flag: '🇺🇸', weight: 10 },
      { code: 'AFR', flag: '🇫🇷', weight: 5 },
      { code: 'IBE', flag: '🇪🇸', weight: 5 },
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
      { label: '18R', heading: 180 },
      { label: '36L', heading: 0 },
      { label: '06', heading: 60 },
      { label: '24', heading: 240 },
    ],
    waypoints: [
      { id: 'WP-A1', label: 'SUGOL', x: 500, y: 100 },
      { id: 'WP-A2', label: 'RIVER', x: 900, y: 500 },
      { id: 'WP-A3', label: 'COAST', x: 100, y: 500 },
      { id: 'WP-A4', label: 'POLDER', x: 500, y: 900 },
    ],
    airlines: [
      { code: 'KLM', flag: '🇳🇱', weight: 45 }, // KLM
      { code: 'TRA', flag: '🇳🇱', weight: 15 }, // Transavia
      { code: 'DLH', flag: '🇩🇪', weight: 10 },
      { code: 'BAW', flag: '🇬🇧', weight: 5 },
      { code: 'EZY', flag: '🇬🇧', weight: 10 },
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
      { label: '03L', heading: 30 },
      { label: '03R', heading: 30 },
      { label: '21L', heading: 210 },
    ],
    waypoints: [
      { id: 'WP-P1', label: 'CANAL', x: 200, y: 400 },
      { id: 'WP-P2', label: 'TABOG', x: 300, y: 800 },
      { id: 'WP-P3', label: 'DARIW', x: 800, y: 600 },
      { id: 'WP-P4', label: 'CHAGR', x: 600, y: 150 },
    ],
    airlines: [
      { code: 'CMP', flag: '🇵🇦', weight: 60 }, // Copa Airlines
      { code: 'AVA', flag: '🇨🇴', weight: 10 },
      { code: 'AAL', flag: '🇺🇸', weight: 10 },
      { code: 'KLM', flag: '🇳🇱', weight: 5 },
      { code: 'IBE', flag: '🇪🇸', weight: 5 },
    ]
  }
];
