import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { buildAirportMap } from '../../scripts/build-airport-map';
import type { MapBuildConfig } from '../../scripts/airport-map-config';

let root: string;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const csv = 'airport_ident,le_ident,he_ident,closed,le_longitude_deg,le_latitude_deg,he_longitude_deg,he_latitude_deg,le_displaced_threshold_ft,he_displaced_threshold_ft\n' +
  'TEST,01,19,0,-0.1,0.1,-0.1,-0.1,,\nTEST,02,20,0,0.1,0.1,0.1,-0.1,150,0\n';
const config = (): MapBuildConfig => ({ icao: 'TEST', snapshot: 'fixture', sourceSha256: hash(csv),
  bounds: [-1, -1, 1, 1], surfaces: [{ id: '01/19', ends: ['01', '19'] },
    { id: '02/20', ends: ['02', '20'], endpointCaveat: 'Approximate source span; may be thresholds. Never extend or double-displace.' }],
  notice: 'Synthetic fixture; datum unspecified, no navigation.', attribution: 'Test fixtures only.',
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atc-map-generator-'));
  writeFileSync(join(root, 'runways-fixture.csv'), csv);
  const rings = [[[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]],
    [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]];
  const content = Buffer.alloc(44 + rings.length * 4 + rings.flat().length * 16);
  content.writeInt32LE(5, 0);
  [-2, -2, 2, 2].forEach((value, i) => content.writeDoubleLE(value, 4 + i * 8));
  content.writeInt32LE(2, 36);
  content.writeInt32LE(10, 40);
  [0, 5].forEach((value, i) => content.writeInt32LE(value, 44 + i * 4));
  rings.flat().forEach((point, i) => point.forEach((value, axis) => content.writeDoubleLE(value, 52 + i * 16 + axis * 8)));
  for (const name of ['land', 'lakes']) {
    const header = Buffer.alloc(100);
    header.writeInt32LE(5, 32);
    const record = Buffer.alloc(8);
    record.writeInt32BE(content.length / 2, 4);
    writeFileSync(join(root, `ne_10m_${name}.shp`), name === 'land' ? Buffer.concat([header, record, content]) : header);
    writeFileSync(join(root, `ne_10m_${name}.prj`), 'GEOGCS["GCS_WGS_1984"]');
    writeFileSync(join(root, `ne_10m_${name}.zip`), `fixture-${name}`);
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('selects multiple exact physical rows without adding navigation or applying displacement metadata', () => {
  const data = buildAirportMap(root, config());
  expect(data.physicalRunways.map(surface => surface.id)).toEqual(['01/19', '02/20']);
  expect(data.reference).toEqual({ longitude: 0, latitude: 0 });
  expect(data.referenceKind).toBe('derived selected endpoint mean');
  const ends = data.physicalRunways[1].ends;
  expect(ends[0].coordinate).toEqual({ longitude: 0.1, latitude: 0.1 });
  expect(ends.map(end => end.displacedThresholdMetres)).toEqual([null, null]);
  expect(ends[0].sourceDisplacedThresholdFeet).toBe('150');
  expect(ends[1].sourceDisplacedThresholdFeet).toBe('0');
  expect(ends[0].sourceCaveat).toContain('Never extend');
  expect(data).not.toHaveProperty('localizers');
  expect(data).not.toHaveProperty('magneticVariationEast');
});

it('reproduces deterministic ring topology, explicit coverage and source hashes', () => {
  const first = buildAirportMap(root, config());
  expect(buildAirportMap(root, config())).toEqual(first);
  expect(first.terrain.landPaths[0].split('M')).toHaveLength(3);
  expect(first.terrain.waterPaths).toEqual([]);
  expect(first.coverage.land.lonLatBounds).toEqual([-1, -1, 1, 1]);
  expect(first.coverage.land.worldRing).toHaveLength(64);
  expect(first.source.sources[0].sha256).toBe(hash(csv));
  expect(first.source.terrainSha256).toBe(hash(JSON.stringify(first.terrain)));
});

it.each(['hash', 'missing', 'duplicate', 'displacement', 'bounds', 'coordinate'])(
  'rejects %s source/configuration gaps explicitly', fault => {
    const value = config();
    if (fault === 'hash') value.sourceSha256 = 'wrong';
    if (fault === 'missing') value.surfaces[0].ends = ['03', '21'];
    if (fault === 'duplicate') value.surfaces[1] = { ...value.surfaces[0] };
    if (fault === 'displacement') delete value.surfaces[1].endpointCaveat;
    if (fault === 'bounds') value.bounds = [1, -1, -1, 1];
    if (fault === 'coordinate') {
      const invalid = csv.replace('-0.1,0.1', ',0.1');
      writeFileSync(join(root, 'runways-fixture.csv'), invalid);
      value.sourceSha256 = hash(invalid);
    }
    expect(() => buildAirportMap(root, value)).toThrow();
  },
);


it('supports the explicit offline CLI with separate source, configuration and output paths', () => {
  const path = join(root, 'config.json'), output = join(root, 'result.json');
  writeFileSync(path, JSON.stringify(config()));
  const result = spawnSync(process.execPath, ['--experimental-strip-types',
    fileURLToPath(new URL('../../scripts/build-airport-map.ts', import.meta.url)), root, path, output], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(buildAirportMap(root, config()));
});
