import factsRaw from './airport-facts.json?raw';
import type { GeographicAirportData } from './types';
import { reconstructTerrain } from './terrain-loader';

const assets = {
  ...import.meta.glob<string>('./terrain/*.svgpath', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('./terrain/*.json', { query: '?raw', import: 'default', eager: true }),
};
const files = Object.fromEntries(Object.entries(assets).map(([path, text]) => [path.split('/').at(-1)!, text]));
const facts = JSON.parse(factsRaw) as GeographicAirportData;
const terrain = reconstructTerrain(JSON.parse(files['manifest.json']), files);
// Preserve the original source field order as well as every numerical value.
const { coverage, source, ...geographic } = facts.geographic;
export const kbosData: GeographicAirportData = { ...facts, geographic: { ...geographic, terrain, coverage, source } };
