/**
 * STARS/ERAM scope colors for SVG attributes.
 * Hex values live in `src/index.css` (`@theme`). Tailwind utilities
 * use the same tokens: `bg-scope`, `text-target`, `border-line`, and so on.
 */
export const scopeColor = {
  scope: 'var(--color-scope)',
  scopeDisk: 'var(--color-scope-disk)',
  map: 'var(--color-map)',
  mapDim: 'var(--color-map-dim)',
  mapLabel: 'var(--color-map-label)',
  airspace: 'var(--color-airspace)',
  airspaceDim: 'var(--color-airspace-dim)',
  runway: 'var(--color-runway)',
  runwayIdle: 'var(--color-runway-idle)',
  centerline: 'var(--color-centerline)',
  fix: 'var(--color-fix)',
  fixLabel: 'var(--color-fix-label)',
  azimuth: 'var(--color-azimuth)',
  target: 'var(--color-target)',
  targetDim: 'var(--color-target-dim)',
  phosphor: 'var(--color-phosphor)',
  selected: 'var(--color-selected)',
  selectedSoft: 'var(--color-selected-soft)',
  alert: 'var(--color-alert)',
  conflict: 'var(--color-conflict)',
  conflictSoft: 'var(--color-conflict-soft)',
  line: 'var(--color-line-strong)',
  ink: 'var(--color-ink-bright)',
  block: 'var(--color-block)',
  tooltip: 'var(--color-tooltip)',
  halo: 'var(--color-halo)',
  haloStroke: 'var(--color-halo-stroke)',
} as const;
