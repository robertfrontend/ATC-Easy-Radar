import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { projectWgs84 } from '../src/geography/projection.ts';
import type { GeographicPoint } from '../src/geography/types.ts';

// Offline public-domain inputs only; no AIP, radio-navigation or chart extraction.
const root = process.argv[2];
if (!root) throw new Error('Usage: node --experimental-strip-types scripts/build-mdsd-map.ts <source-directory>');
const snapshot = '59574226b6df9417f5a7a8d03eeb6c7158a76168';
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (name: string) => readFileSync(join(root, name));
const csv = (line: string) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)]
  .map(match => match[1].replace(/^"|"$/g, '').replaceAll('""', '"'));
const lines = read(`runways-${snapshot}.csv`).toString().trim().split(/\r?\n/);
const header = csv(lines.shift()!);
const record = lines.map(line => Object.fromEntries(csv(line).map((value, i) => [header[i], value])))
  .find(row => row.airport_ident === 'MDSD' && row.le_ident === '17' && row.he_ident === '35');
if (!record || record.closed !== '0') throw new Error('Expected independent historical MDSD17/35 pavement');
if (record.le_displaced_threshold_ft || record.he_displaced_threshold_ft) throw new Error('Reassess nonempty displacement data');
const coordinate = (prefix: string): GeographicPoint => ({
  longitude: Number(record[`${prefix}_longitude_deg`]), latitude: Number(record[`${prefix}_latitude_deg`]),
});
const first = coordinate('le'), second = coordinate('he');
const reference = { longitude: (first.longitude + second.longitude) / 2, latitude: (first.latitude + second.latitude) / 2 };
const project = (point: GeographicPoint) => projectWgs84(reference, point);
const bounds = [-70.5, 17.4, -68.8, 19.5];
const overlaps = ([west, south, east, north]: number[]) =>
  west <= bounds[2] && east >= bounds[0] && south <= bounds[3] && north >= bounds[1];

/** Rectangle intersection introduces edges only on the explicit coverage mask, not coastline. */
function clipRing(points: GeographicPoint[]) {
  let ring = points;
  for (const [axis, edge, sign] of [['longitude', bounds[0], 1], ['longitude', bounds[2], -1],
    ['latitude', bounds[1], 1], ['latitude', bounds[3], -1]] as const) {
    const output: GeographicPoint[] = [];
    for (let i = 0; i < ring.length; i++) {
      const from = ring[(i + ring.length - 1) % ring.length], to = ring[i];
      const insideFrom = sign * (from[axis] - edge) >= 0, insideTo = sign * (to[axis] - edge) >= 0;
      if (insideFrom !== insideTo) {
        const t = (edge - from[axis]) / (to[axis] - from[axis]);
        output.push({ longitude: from.longitude + (to.longitude - from.longitude) * t,
          latitude: from.latitude + (to.latitude - from.latitude) * t });
      }
      if (insideTo) output.push(to);
    }
    ring = output;
  }
  return ring;
}

/** Preserve source ring parity/holes while intersecting the explicit geographic coverage. */
function paths(name: string) {
  const bytes = read(`ne_10m_${name}.shp`);
  const prj = read(`ne_10m_${name}.prj`).toString();
  if (!prj.includes('WGS_1984') || bytes.readInt32LE(32) !== 5) throw new Error('Expected WGS84 Polygon SHP');
  const result: string[] = [];
  for (let offset = 100; offset < bytes.length;) {
    const size = bytes.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    offset = start + size;
    const shape = bytes.readInt32LE(start);
    if (shape === 0) continue;
    if (shape !== 5) throw new Error('Unexpected SHP record');
    if (!overlaps([0, 8, 16, 24].map(delta => bytes.readDoubleLE(start + 4 + delta)))) continue;
    const partCount = bytes.readInt32LE(start + 36), pointCount = bytes.readInt32LE(start + 40);
    const parts = Array.from({ length: partCount }, (_, i) => bytes.readInt32LE(start + 44 + i * 4));
    const pointsStart = start + 44 + partCount * 4;
    const rings: string[] = [];
    for (let part = 0; part < parts.length; part++) {
      const points = Array.from({ length: (parts[part + 1] ?? pointCount) - parts[part] }, (_, i) => {
        const at = pointsStart + (parts[part] + i) * 16;
        return { longitude: bytes.readDoubleLE(at), latitude: bytes.readDoubleLE(at + 8) };
      });
      const longitude = points.map(point => point.longitude), latitude = points.map(point => point.latitude);
      if (!overlaps([Math.min(...longitude), Math.min(...latitude), Math.max(...longitude), Math.max(...latitude)])) continue;
      const clipped = clipRing(points);
      if (clipped.length < 3) continue;
      rings.push(`M${clipped.map(point => { const world = project(point); return `${world.x.toFixed(2)},${world.y.toFixed(2)}`; }).join('L')}Z`);
    }
    if (rings.length) result.push(rings.join(''));
  }
  return result;
}
const corners = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]];
const coverage = { lonLatBounds: bounds, worldRing: corners.flatMap((point, i) => {
  const next = corners[(i + 1) % 4];
  return Array.from({ length: 16 }, (_, step) => project({ longitude: point[0] + (next[0] - point[0]) * step / 16,
    latitude: point[1] + (next[1] - point[1]) * step / 16 }));
}) };
const terrain = { landPaths: paths('land'), waterPaths: paths('lakes'), neighborPaths: [] };
const sources = [
  { file: `runways-${snapshot}.csv`, url: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/${snapshot}/runways.csv` },
  ...['land', 'lakes'].map(name => ({ file: `ne_10m_${name}.zip`, url: `https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_${name}.zip` })),
].map(({ file, url }) => ({ url, sha256: hash(read(file)) }));
const data = {
  reference, referenceKind: 'derived runway endpoint midpoint',
  physicalRunways: [{ id: '17/35', ends: [first, second].map((point, i) => ({
    id: i ? '35' : '17', coordinate: point, position: project(point), displacedThresholdMetres: null,
  })) }],
  terrain, coverage: { land: coverage, water: coverage },
  source: {
    projection: 'Local WGS84 ellipsoidal azimuthal equidistant; 22.4 world units/NM; north up',
    notice: 'Generalized map only, not navigation or elevation relief. Terrain clipped to explicit coverage; no vertex simplification. OurAirports datum unspecified; coordinates assumed WGS84 for this approximate map. Historical pavement endpoints, unknown threshold displacement. Existing fixes, holds and approach guidance remain synthetic/simplified; no real LOC or magnetic variation asserted.',
    attribution: 'Natural Earth public-domain land5.1.1/lakes5.0.0, 1:10-million cartographic scale (not10m accuracy); OurAirports public-domain runway snapshot2024-12-30.',
    runwaySnapshot: snapshot, terrainSha256: hash(JSON.stringify(terrain)), sources,
  },
};
writeFileSync('src/geography/mdsd-map-data.json', JSON.stringify(data) + '\n');
console.log({ landPaths: terrain.landPaths.length, waterPaths: terrain.waterPaths.length, bytes: JSON.stringify(data).length });
