import { approachPoint, runwayFrame } from '../geography/navigation';
import { Airport, Plane, RunwayConfig } from '../types';

export type TutorialPhase = 'arrival' | 'separation';
export type TutorialStep = 'select' | 'heading' | 'descent' | 'speed' | 'capture' | 'landed' | 'separation' | 'complete';

export interface TutorialScenario {
  phase: TutorialPhase;
  planes: Plane[];
  runwayConfig: RunwayConfig;
  primaryPlaneId: string;
  secondaryPlaneId: string | null;
  runwayId: string;
  runwayHeading: number;
  targets: { heading: number; altitude: number; speed: number };
}

function headingDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360 + 360) % 360 - 180);
}

/**
 * Restartable practice tracks expressed in the primary runway's coordinates.
 * Freeze the arrival until the clearances are entered, then advance it through
 * the ordinary engine. In separation practice, disable ILS so automatic descent
 * cannot undo the altitude clearance being taught.
 */
export function createTutorialScenario(airport: Airport, phase: TutorialPhase = 'arrival'): TutorialScenario {
  const runway = airport.runways[0];
  if (!runway) throw new Error('Tutorial practice requires an airport with a runway.');
  const frame = runwayFrame(airport, runway);
  const trainingHeading = phase === 'arrival' ? frame.approachHeading : frame.pavementHeading;
  const radians = trainingHeading * Math.PI / 180;
  const position = (crossTrack: number, distanceBehind: number) => {
    const point = approachPoint(airport, runway, distanceBehind);
    return { x: point.x + crossTrack * Math.cos(radians), y: point.y + crossTrack * Math.sin(radians) };
  };
  const normalizeHeading = (value: number) => (value + 360) % 360;
  const makeTrack = (id: string, callsign: string, x: number, y: number, heading: number, altitude: number, speed: number): Plane => ({
    id,
    callsign,
    model: 'A320',
    squawk: '1200',
    type: 'arrival',
    x,
    y,
    heading,
    targetHeading: heading,
    altitude,
    targetAltitude: altitude,
    speed,
    targetSpeed: speed,
    trail: [],
    status: 'normal',
    isEstablished: false,
    establishedRunwayId: null,
    assignedRunwayId: runway.id,
    hasInstructions: false,
    originFlag: airport.countryFlag,
    targetWaypoint: null,
    exitWaypointId: null,
    headingAssigned: false,
    markedForRemoval: false,
    conflict: false,
  });
  const runwayConfig: RunwayConfig = Object.fromEntries(airport.runways.map(r => [
    r.id,
    { landing: phase === 'arrival' && r.id === runway.id, departure: false },
  ]));
  const primaryPlaneId = phase === 'arrival' ? 'tutorial-arrival' : 'tutorial-separation-a';
  const secondaryPlaneId = phase === 'separation' ? 'tutorial-separation-b' : null;

  if (phase === 'arrival') {
    const { x, y } = position(0, 360);
    return {
      phase,
      planes: [makeTrack(primaryPlaneId, 'TRN101', x, y, normalizeHeading(trainingHeading + 60), 11000, 220)],
      runwayConfig,
      primaryPlaneId,
      secondaryPlaneId,
      runwayId: runway.id,
      runwayHeading: trainingHeading,
      targets: { heading: trainingHeading, altitude: 3000, speed: 180 },
    };
  }

  const a = position(-90, 310);
  const b = position(90, 310);
  return {
    phase,
    planes: [
      makeTrack(primaryPlaneId, 'TRN201', a.x, a.y, normalizeHeading(trainingHeading + 90), 4000, 180),
      makeTrack(secondaryPlaneId!, 'TRN202', b.x, b.y, normalizeHeading(runway.heading - 90), 4000, 180),
    ],
    runwayConfig,
    primaryPlaneId,
    secondaryPlaneId,
    runwayId: runway.id,
    runwayHeading: trainingHeading,
    targets: { heading: normalizeHeading(trainingHeading + 90), altitude: 5000, speed: 180 },
  };
}

/** These checks validate the clearance, not a button click or displayed hint. */
export function isTutorialHeadingCleared(plane: Plane | undefined, scenario: TutorialScenario): boolean {
  return !!plane && plane.id === scenario.primaryPlaneId && plane.headingAssigned === true
    && headingDifference(plane.targetHeading, scenario.targets.heading) <= 30;
}

export function isTutorialDescentCleared(plane: Plane | undefined, scenario: TutorialScenario): boolean {
  return !!plane && plane.id === scenario.primaryPlaneId
    && plane.targetAltitude >= 2000 && plane.targetAltitude <= 5000;
}

export function isTutorialSpeedCleared(plane: Plane | undefined, scenario: TutorialScenario): boolean {
  return !!plane && plane.id === scenario.primaryPlaneId
    && plane.targetSpeed >= 140 && plane.targetSpeed <= 210;
}

export function isTutorialArrivalCleared(plane: Plane | undefined, scenario: TutorialScenario): boolean {
  return scenario.phase === 'arrival'
    && isTutorialHeadingCleared(plane, scenario)
    && isTutorialDescentCleared(plane, scenario)
    && isTutorialSpeedCleared(plane, scenario);
}

export function isTutorialSeparationCleared(planes: readonly Plane[], scenario: TutorialScenario): boolean {
  if (scenario.phase !== 'separation') return false;
  const primary = planes.find(p => p.id === scenario.primaryPlaneId);
  const secondary = planes.find(p => p.id === scenario.secondaryPlaneId);
  return !!primary && !!secondary && primary.status !== 'crashed' && secondary.status !== 'crashed'
    && primary.targetAltitude >= scenario.targets.altitude
    && primary.targetAltitude - secondary.targetAltitude >= 1000;
}

/** The hook should require this to stay true for its chosen practice interval. */
export function hasTutorialSeparation(planes: readonly Plane[], scenario: TutorialScenario): boolean {
  if (scenario.phase !== 'separation') return false;
  const primary = planes.find(p => p.id === scenario.primaryPlaneId);
  const secondary = planes.find(p => p.id === scenario.secondaryPlaneId);
  return !!primary && !!secondary
    && !primary.markedForRemoval && !secondary.markedForRemoval
    && primary.status !== 'crashed' && secondary.status !== 'crashed'
    && Math.abs(primary.altitude - secondary.altitude) >= 1000;
}
