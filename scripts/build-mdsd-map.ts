import { writeFileSync } from 'node:fs';
import { buildAirportMap } from './build-airport-map.ts';
import { mdsdMapBuild } from './airport-map-config.ts';

const root = process.argv[2];
if (!root) throw new Error('Usage: node --experimental-strip-types scripts/build-mdsd-map.ts <source-directory>');
writeFileSync('src/geography/mdsd-map-data.json', JSON.stringify(buildAirportMap(root, mdsdMapBuild)) + '\n');
