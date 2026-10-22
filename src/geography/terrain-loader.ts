import type { AirportGeography } from './types';

type Terrain = AirportGeography['terrain'];
export interface TerrainManifest {
  pathCounts: Record<keyof Terrain, number>;
  fragmentCount: number;
  indexes: { file: string }[];
}

/** Compile-time local assets only. Missing or ambiguous data must never become a partial map. */
export function reconstructTerrain(manifest: TerrainManifest, files: Record<string, string>): Terrain {
  const result: Terrain = { landPaths: [], waterPaths: [], neighborPaths: [] };
  const layers = Object.keys(result) as (keyof Terrain)[];
  for (const layer of layers) {
    const count = manifest.pathCounts[layer];
    if (!Number.isInteger(count) || count < 0) throw new Error(`Invalid terrain count: ${layer}`);
    result[layer] = new Array(count);
  }
  const usedIndexes = new Set<string>(), usedFragments = new Set<string>();
  const read = (name: string) => {
    if (!Object.hasOwn(files, name) || typeof files[name] !== 'string') throw new Error(`Missing terrain asset: ${name}`);
    return files[name];
  };
  for (const entry of manifest.indexes) {
    if (usedIndexes.has(entry.file)) throw new Error(`Duplicate terrain index: ${entry.file}`);
    usedIndexes.add(entry.file);
    const index = JSON.parse(read(entry.file));
    if (!Object.hasOwn(result, index.layer) || !Array.isArray(index.paths)) throw new Error('Invalid terrain index');
    const paths = result[index.layer as keyof Terrain];
    for (const record of index.paths) {
      if (!Number.isInteger(record.pathIndex) || record.pathIndex < 0 || record.pathIndex >= paths.length || paths[record.pathIndex] !== undefined) throw new Error('Duplicate or invalid terrain position');
      if (!Array.isArray(record.fragments) || !record.fragments.length) throw new Error('Missing terrain fragments');
      const path = record.fragments.map((name: string) => {
        if (!/^(landPaths|waterPaths|neighborPaths)-\d{3}-\d{2}\.svgpath$/.test(name) || usedFragments.has(name)) throw new Error('Duplicate or invalid terrain fragment');
        usedFragments.add(name);
        return read(name);
      }).join('');
      if (!/^M[MLZ0-9.,-]+Z$/.test(path)) throw new Error('Invalid terrain path');
      paths[record.pathIndex] = path;
    }
  }
  if (layers.some(layer => result[layer].includes(undefined))) throw new Error('Terrain path gap');
  if (usedFragments.size !== manifest.fragmentCount || Object.keys(files).filter(name => name.endsWith('.svgpath')).length !== usedFragments.size) throw new Error('Unexpected terrain fragment inventory');
  return result;
}
