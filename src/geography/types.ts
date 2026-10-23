import type { Airport, Runway, Waypoint } from '../types';
import type { AirportTerrainMap } from './map-types';

export interface GeographicPoint { longitude: number; latitude: number }
export interface WorldPoint { x: number; y: number }
export interface GeographicRunwayEnd {
  id: string;
  position: WorldPoint;
  threshold: WorldPoint;
  trueHeading: number;
}
export interface LocalizerReference {
  runwayEnd: string;
  operativeRunwayId?: string;
  referenceOnly: boolean;
  antenna: WorldPoint;
  trueCourse: number;
  magneticCourse: number;
  frequencyMHz: number;
  glideslopeDegrees: number;
  status: string;
  restrictions: string[];
  illustrativeLengthNM: number;
}
export interface GeographicCoverage {
  lonLatBounds: number[];
  worldRing: WorldPoint[];
}
export interface AirportGeography {
  reference: GeographicPoint;
  magneticVariationEast: number;
  shortestHalfRange: number;
  physicalRunways: { id: string; ends: GeographicRunwayEnd[] }[];
  localizers: LocalizerReference[];
  contextFixes: Waypoint[];
  holdReferences: Waypoint[];
  terrain: { landPaths: string[]; waterPaths: string[]; neighborPaths: string[] };
  coverage: { land: GeographicCoverage; water: GeographicCoverage };
  source: {
    crs: string;
    effectiveDate: string;
    geodataRetrievedAt: string;
    projection: string;
    terrainCoordinatePrecisionWorld: number;
    notice: string;
    attribution: string;
    sources: { url: string; sha256?: string }[];
  };
}
export type GeographicAirport = Airport & { geographic?: AirportGeography; terrainMap?: AirportTerrainMap };
export interface GeographicAirportData {
  geographic: AirportGeography;
  runways: Runway[];
  waypoints: Waypoint[];
  elevation: number;
}
