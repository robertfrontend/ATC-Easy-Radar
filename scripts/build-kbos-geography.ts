import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { projectNad83 } from '../src/geography/projection.ts';
import type { GeographicAirportData, GeographicPoint } from '../src/geography/types.ts';

// Offline factual extraction only. No downloaded archives, original schema or DEMO tracks are redistributed.
const root = process.argv[2];
if (!root) throw new Error('Usage: node --experimental-strip-types scripts/build-kbos-geography.ts <source-directory>');
const read = (name: string) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const hash = (name: string) => createHash('sha256').update(readFileSync(join(root, name))).digest('hex');
const aviation = read('aviation-subset.json'), ils = read('ils-subset.json'), metadata = read('geodata-metadata.json');
const reference = { longitude: +aviation.airport.LONG_DECIMAL, latitude: +aviation.airport.LAT_DECIMAL };
const coordinate = (record: Record<string, string>, displaced = false): GeographicPoint => ({
  longitude: +(displaced && record.LONG_DISPLACED_THR_DECIMAL || record.LONG_DECIMAL),
  latitude: +(displaced && record.LAT_DISPLACED_THR_DECIMAL || record.LAT_DECIMAL),
});
const project = (point: GeographicPoint) => projectNad83(reference, point);
const pointText = (point: number[]) => {
  const world = project({ longitude: point[0], latitude: point[1] });
  return `${world.x.toFixed(2)},${world.y.toFixed(2)}`;
};
function terrain(name: string) {
  const data = read(name);
  if (data.crs?.properties?.name !== 'EPSG:4269') throw new Error(`${name}: expected NAD83 EPSG:4269`);
  return data.features.map(feature => {
    const rings: number[][][] = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
    return rings.map(ring => `M${ring.map(pointText).join('L')}Z`).join('');
  });
}
function coverage(bounds: number[]) {
  const [west, south, east, north] = bounds;
  const corners = [[west, south], [east, south], [east, north], [west, north]];
  const worldRing = corners.flatMap((corner, i) => Array.from({ length: 16 }, (_, step) => {
    const next = corners[(i + 1) % 4], t = step / 16;
    return project({ longitude: corner[0] + (next[0] - corner[0]) * t, latitude: corner[1] + (next[1] - corner[1]) * t });
  }));
  return { lonLatBounds: bounds, worldRing };
}
const ends = aviation.runwayEnds.map(end => ({ id: end.RWY_END_ID, physicalId: end.RWY_ID,
  position: project(coordinate(end)), threshold: project(coordinate(end, true)), trueHeading: +end.TRUE_ALIGNMENT }));
const physicalRunways = [...new Set<string>(ends.map(end => end.physicalId))].map(id => ({ id,
  ends: ends.filter(end => end.physicalId === id).map(({ physicalId, ...end }) => end) }));
const operative = ['33L', '27', '04R', '15R'];
const runways = operative.map(label => {
  const end = ends.find(item => item.id === label)!, pair = ends.find(item => item.physicalId === end.physicalId && item.id !== label)!;
  return { id: `bos-${label.toLowerCase()}`, label, heading: end.trueHeading,
    offsetX: (end.position.x + pair.position.x) / 2 - 500, offsetY: (end.position.y + pair.position.y) / 2 - 500,
    length: Math.hypot(end.position.x - pair.position.x, end.position.y - pair.position.y) };
});
const selectFixes = (labels: string[]) => labels.map(label => {
  const fix = aviation.fixes.find(item => item.FIX_ID === label);
  if (!fix) throw new Error(`Missing verified fix ${label}`);
  return { id: `KBOS-${label}`, label, ...project(coordinate(fix)) };
});
const base = readFileSync(join(root, 'APT_BASE.csv'), 'utf8').split(/\r?\n/);
const columns = base[0].replaceAll('"', '').split(',');
// Read the single airport elevation fact without distributing the source table.
const airportRow = base.find(line => line.includes('"KBOS"'))?.match(/("[^"]*"|[^,]*)(,|$)/g)?.map(value => value.replace(/,$/, '').replace(/^"|"$/g, ''));
const elevation = Number(airportRow?.[columns.indexOf('ELEV')]);
if (elevation !== 19.1) throw new Error(`Unexpected verified KBOS elevation ${elevation}`);
for (const label of ['WAXEN', 'WINNI']) {
  if (!aviation.holdExistence.some(hold => hold.FIX_ID === label)) throw new Error(`Unverified hold existence ${label}`);
}
const data: GeographicAirportData = {
  elevation, runways, waypoints: selectFixes(['SWIGG', 'WAXEN', 'WOBUR', 'MORIS', 'KLANE', 'MYNOT', 'CELTS', 'WINNI', 'MILIS']),
  geographic: {
    reference, magneticVariationEast: -15, shortestHalfRange: 35 / 2 * 22.4, physicalRunways,
    localizers: ils.localizers.map(loc => ({ runwayEnd: loc.runwayEnd,
      ...(operative.includes(loc.runwayEnd) ? { operativeRunwayId: `bos-${loc.runwayEnd.toLowerCase()}` } : {}),
      referenceOnly: !operative.includes(loc.runwayEnd), antenna: project(coordinate(loc.base)),
      trueCourse: +loc.base.APCH_BEAR - 15, magneticCourse: +loc.base.APCH_BEAR,
      frequencyMHz: +loc.base.LOC_FREQ, glideslopeDegrees: +loc.glideslope.G_S_ANGLE,
      status: loc.base.COMPONENT_STATUS, restrictions: loc.remarks.map(remark => remark.REMARK),
      illustrativeLengthNM: loc.illustrativeLengthNM })),
    contextFixes: selectFixes(['SOSYO', 'WHYBE']), holdReferences: selectFixes(['WAXEN', 'WINNI']),
    terrain: { landPaths: terrain('land-nad83.json'), waterPaths: terrain('water-nad83.json'), neighborPaths: terrain('neighbor-nad83.json') },
    coverage: { land: coverage(metadata.land_query_bbox), water: coverage(metadata.water_query_bbox) },
    source: { crs: 'EPSG:4269', effectiveDate: '2026-10-01', geodataRetrievedAt: metadata.retrieved_at_utc,
      projection: 'NAD83/GRS80 local azimuthal equidistant; true north at reference, 22.4 world units/NM',
      terrainCoordinatePrecisionWorld: 0.01,
      notice: 'Unofficial simplified simulation. Not for navigation or authoritative survey use. No agency endorsement.',
      attribution: metadata.attribution,
      sources: [...read('faa-provenance.json'), read('faa-ils-provenance.json')].map((source): { url: string; sha256?: string } => ({ url: source.source, sha256: source.sha256 }))
        .concat([{ url: metadata.land_item }, { url: metadata.land_source }, { url: metadata.water_source }, { url: metadata.neighbor_source }],
          ['land-nad83.json', 'water-nad83.json', 'neighbor-nad83.json'].map(name => ({ url: `artifact:${name}`, sha256: hash(name) }))) },
  },
};
writeFileSync('src/geography/kbos-data.ts', '// Generated offline by scripts/build-kbos-geography.ts; narrow structured facts and projected terrain only.\nimport type { GeographicAirportData } from "./types";\nexport const kbosData: GeographicAirportData = ' + JSON.stringify(data) + ';\n');
console.log(`Generated KBOS geographic facts and ${data.geographic.terrain.landPaths.length + data.geographic.terrain.waterPaths.length + data.geographic.terrain.neighborPaths.length} terrain paths`);
