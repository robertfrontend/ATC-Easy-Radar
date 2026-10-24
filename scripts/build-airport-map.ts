import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectWgs84 } from '../src/geography/projection.ts';
import type { GeographicPoint } from '../src/geography/types.ts';
import type { MapBuildConfig } from './airport-map-config.ts';

// Offline public-domain inputs only. Configuration never implies verified navigation.
export function buildAirportMap(root: string, config: MapBuildConfig) {
  const { snapshot, bounds } = config;
  if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3] ||
    bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90) throw new Error('Invalid geographic coverage');
  const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
  const read = (name: string) => readFileSync(join(root, name));
  const source = read(`runways-${snapshot}.csv`);
  if (hash(source) !== config.sourceSha256) throw new Error('Runway source hash mismatch');
  const csv = (line: string) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)]
    .map(match => match[1].replace(/^"|"$/g, '').replaceAll('""', '"'));
  const lines = source.toString().trim().split(/\r?\n/);
  const header = csv(lines.shift()!);
  const records = lines.map(line => Object.fromEntries(csv(line).map((value, i) => [header[i], value])));
  const ids = new Set<string>();
  if (!config.surfaces.length) throw new Error('No selected runway surfaces');
  const selected = config.surfaces.map(selection => {
    if (ids.has(selection.id)) throw new Error('Duplicate surface selection');
    ids.add(selection.id);
    const matches = records.filter(row => row.airport_ident === config.icao &&
      row.le_ident === selection.ends[0] && row.he_ident === selection.ends[1]);
    if (matches.length !== 1 || matches[0].closed !== '0') throw new Error('Missing, duplicate or closed runway source');
    const record = matches[0];
    if ((record.le_displaced_threshold_ft || record.he_displaced_threshold_ft) && !selection.endpointCaveat) {
      throw new Error('Nonempty displacement requires an explicit source caveat, not an applied offset');
    }
    const coordinates = ['le', 'he'].map(prefix => {
      const longitude = record[`${prefix}_longitude_deg`], latitude = record[`${prefix}_latitude_deg`];
      if (!longitude || !latitude) throw new Error('Missing source endpoint coordinate');
      return { longitude: Number(longitude), latitude: Number(latitude) };
    });
    return { selection, record, coordinates };
  });
  const coordinates = selected.flatMap(surface => surface.coordinates);
  const reference = { longitude: coordinates.reduce((sum, point) => sum + point.longitude, 0) / coordinates.length,
    latitude: coordinates.reduce((sum, point) => sum + point.latitude, 0) / coordinates.length };
  const project = (point: GeographicPoint) => projectWgs84(reference, point);
  coordinates.forEach(project);

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
    reference, referenceKind: coordinates.length === 2 ? 'derived runway endpoint midpoint' : 'derived selected endpoint mean',
    physicalRunways: selected.map(({ selection, record, coordinates }) => ({
      id: selection.id, ends: coordinates.map((point, i) => ({
        id: selection.ends[i], coordinate: point, position: project(point), displacedThresholdMetres: null,
        ...(selection.endpointCaveat ? { sourceCaveat: selection.endpointCaveat,
          sourceDisplacedThresholdFeet: record[`${i ? 'he' : 'le'}_displaced_threshold_ft`] || null } : {}),
      })),
    })),
    terrain, coverage: { land: coverage, water: coverage },
    source: {
      projection: 'Local WGS84 ellipsoidal azimuthal equidistant; 22.4 world units/NM; north up',
      notice: config.notice,
      attribution: config.attribution,
      runwaySnapshot: snapshot, terrainSha256: hash(JSON.stringify(terrain)), sources,
    },
  };
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, configPath, outputPath] = process.argv.slice(2);
  if (!root || !configPath || !outputPath) throw new Error('Usage: node --experimental-strip-types scripts/build-airport-map.ts <source-directory> <config.json> <output.json>');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as MapBuildConfig;
  writeFileSync(outputPath, JSON.stringify(buildAirportMap(root, config)) + '\n');
}
