import { expect, it } from 'vitest';
import { reconstructTerrain } from './terrain-loader';

function fixture() {
  return {
    manifest: { pathCounts: { landPaths: 2, waterPaths: 0, neighborPaths: 0 }, fragmentCount: 2, indexes: [{ file: 'a.json' }, { file: 'b.json' }] },
    files: {
      'a.json': JSON.stringify({ layer: 'landPaths', paths: [{ pathIndex: 1, fragments: ['landPaths-001-00.svgpath'] }] }),
      'b.json': JSON.stringify({ layer: 'landPaths', paths: [{ pathIndex: 0, fragments: ['landPaths-000-00.svgpath'] }] }),
      'landPaths-000-00.svgpath': 'M0,0L1,1Z',
      'landPaths-001-00.svgpath': 'M2,2L3,3Z',
    } as Record<string, string>,
  };
}

it('reassembles by pathIndex rather than glob or index enumeration order', () => {
  const { manifest, files } = fixture();
  expect(reconstructTerrain(manifest, files)).toEqual({ landPaths: ['M0,0L1,1Z', 'M2,2L3,3Z'], waterPaths: [], neighborPaths: [] });
});

it.each(['a.json', 'landPaths-000-00.svgpath'])('rejects missing asset %s', name => {
  const { manifest, files } = fixture();
  delete files[name];
  expect(() => reconstructTerrain(manifest, files)).toThrow();
});

it('rejects duplicate path positions and fragment references', () => {
  const { manifest, files } = fixture();
  files['a.json'] = files['b.json'];
  expect(() => reconstructTerrain(manifest, files)).toThrow();
  files['a.json'] = JSON.stringify({ layer: 'landPaths', paths: [{ pathIndex: 1, fragments: ['landPaths-000-00.svgpath'] }] });
  expect(() => reconstructTerrain(manifest, files)).toThrow();
});

it('rejects gaps and unexpected fragments instead of rendering partial geometry', () => {
  const { manifest, files } = fixture();
  manifest.pathCounts.landPaths = 3;
  expect(() => reconstructTerrain(manifest, files)).toThrow();
  manifest.pathCounts.landPaths = 2;
  files['landPaths-002-00.svgpath'] = 'M4,4Z';
  expect(() => reconstructTerrain(manifest, files)).toThrow();
});

it('rejects duplicate indexes, unknown layers and out-of-range path positions', () => {
  const { manifest, files } = fixture();
  manifest.indexes.push({ file: 'a.json' });
  expect(() => reconstructTerrain(manifest, files)).toThrow();
  manifest.indexes.pop();
  files['a.json'] = JSON.stringify({ layer: 'unknown', paths: [] });
  expect(() => reconstructTerrain(manifest, files)).toThrow();
  files['a.json'] = JSON.stringify({ layer: 'landPaths', paths: [{ pathIndex: 3, fragments: ['landPaths-001-00.svgpath'] }] });
  expect(() => reconstructTerrain(manifest, files)).toThrow();
});
