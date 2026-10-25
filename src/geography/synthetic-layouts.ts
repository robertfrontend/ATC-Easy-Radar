import type { WorldPoint } from './types';

/** Deliberate game design, never a source of real navigation coordinates. */
export interface SyntheticLayout {
  kind: 'synthetic';
  fixPositions: Record<string, WorldPoint>;
  holdFixIds: Record<string, string>;
}

export const mdsdSyntheticLayout: SyntheticLayout = {
  kind: 'synthetic',
  fixPositions: {
    'WP-D1': { x: 350, y: 880 },
    'WP-D2': { x: 840, y: 620 },
    'WP-D3': { x: 690, y: 330 },
    'WP-D4': { x: 210, y: 480 },
  },
  holdFixIds: { 'stack-ocean': 'WP-D1' },
};


export const mptoSyntheticLayout: SyntheticLayout = {
  kind: 'synthetic',
  fixPositions: {
    'WP-P1': { x: 80, y: 370 },
    'WP-P2': { x: 380, y: 1040 },
    'WP-P3': { x: 1080, y: 760 },
    'WP-P4': { x: 760, y: 80 },
  },
  holdFixIds: { 'stack-canal': 'WP-P1' },
};
