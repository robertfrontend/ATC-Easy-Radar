import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { kbosData } from './kbos-data';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const read = (name: string) => readFileSync(new URL(`./terrain/${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

it('matches every committed index, fragment inventory, reconstructed path and original source bytes', () => {
  const fragments = new Set<string>();
  for (const entry of manifest.indexes) {
    const text = read(entry.file);
    expect(hash(text)).toBe(entry.sha256);
    const index = JSON.parse(text);
    for (const record of index.paths) {
      const path = record.fragments.map((name: string) => {
        expect(fragments.has(name)).toBe(false);
        fragments.add(name);
        const text = read(name);
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(30000);
        return text;
      }).join('');
      expect(hash(path)).toBe(record.sha256);
      expect(kbosData.geographic.terrain[index.layer][record.pathIndex]).toBe(path);
    }
  }
  expect([...fragments].sort()).toEqual(readdirSync(new URL('./terrain', import.meta.url)).filter(name => name.endsWith('.svgpath')).sort());
  expect(fragments.size).toBe(manifest.fragmentCount);
  const facts = readFileSync(new URL('./airport-facts.json', import.meta.url), 'utf8');
  expect(hash(facts)).toBe(manifest.factsSha256);
  const originalSource = '// Generated offline by scripts/build-kbos-geography.ts; narrow structured facts and projected terrain only.\n'
    + 'import type { GeographicAirportData } from "./types";\n'
    + 'export const kbosData: GeographicAirportData = ' + JSON.stringify(kbosData) + ';\n';
  expect(hash(originalSource)).toBe(manifest.originalSourceSha256);
  expect(hash(originalSource)).toBe('b9046ff5f8f5f99ab044a5f8c14f08e0d3aaf955d7c06b8d3359abbf427c5995');
});
