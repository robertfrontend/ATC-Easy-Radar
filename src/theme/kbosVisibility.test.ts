import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { scopeColor } from './radarTheme';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const scoped = css.split('[data-airport-theme="kbos"] {')[1].split('}')[0];
const token = (name: string) => scoped.match(new RegExp(`--color-${name}: (#[a-f0-9]+);`))![1];
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = (channels: number[]) => channels.map(value => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

it('uses light neutral KBOS normal tracks, distinct selection, and readable pulse minima over navy water', () => {
  const water = rgb(token('geographic-water'));
  const floor = Number(scoped.match(/--radar-blink-min-opacity: ([.\d]+);/)?.[1] ?? 0.3);
  for (const role of ['target', 'arrival', 'departure', 'uncontrolled'] as const) {
    const color = rgb(token(role));
    expect(Math.max(...color) - Math.min(...color), role).toBeLessThanOrEqual(12);
    expect(Math.min(...color), role).toBeGreaterThanOrEqual(210);
    const dimmest = color.map((value, index) => value * floor + water[index] * (1 - floor));
    expect((luminance(dimmest) + 0.05) / (luminance(water) + 0.05), role).toBeGreaterThanOrEqual(4.5);
    expect(token(role)).not.toBe(token('selected'));
    expect(scopeColor[role]).toBe(`var(--color-${role})`);
  }
  expect(css).toContain('opacity: var(--radar-blink-min-opacity, 0.3)');
  expect(scoped).not.toMatch(/--color-(alert|conflict):/);
  expect(css.split('[data-airport-theme="kbos"]')[0]).toContain('--color-target: #5fd35f');
});
