import type { GeographicCoverage, GeographicPoint, WorldPoint } from './types';

/** Map facts only: never implies verified navigation, thresholds or magnetic variation. */
export interface AirportTerrainMap {
  reference: GeographicPoint;
  referenceKind: 'derived runway endpoint midpoint';
  physicalRunways: { id: string; ends: {
    id: string;
    coordinate: GeographicPoint;
    position: WorldPoint;
    displacedThresholdMetres: null;
  }[] }[];
  terrain: { landPaths: string[]; waterPaths: string[]; neighborPaths: string[] };
  coverage: { land: GeographicCoverage; water: GeographicCoverage };
  source: {
    projection: string;
    notice: string;
    attribution: string;
    runwaySnapshot: string;
    terrainSha256: string;
    sources: { url: string; sha256: string }[];
  };
}
