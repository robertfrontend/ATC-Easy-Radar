import { expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import type { GameSpeed, Plane, RunwayConfig } from '../types';
import { makePlane } from '../test/field';
import { advancePlane } from '../utils/sim';
import { predictFlightPath } from '../utils/prediction';
import { trackFate } from '../utils/approach';
import { createRadarDomain } from '../utils/radarBounds';
import { getGeographicAirport } from './kbos';
import { approachPoint, runwayFrame } from './navigation';

const airport = getGeographicAirport(AIRPORTS.find(item => item.icao === 'KBOS')!);
const width = .4;
const horizon = 30;
interface Scenario { name: string; plane: Plane; config: RunwayConfig; landing?: boolean; transition?: boolean }
const scenarios: Scenario[] = airport.runways.map(runway => {
  const frame = runwayFrame(airport, runway);
  return {
    name: `LOC-${runway.label}`,
    plane: makePlane({ ...approachPoint(airport, runway, 80), heading: frame.approachHeading,
      targetHeading: frame.approachHeading, altitude: 3000, targetAltitude: 3000,
      speed: 180, targetSpeed: 180, assignedRunwayId: runway.id }),
    config: { [runway.id]: { landing: true, departure: false } }, landing: true,
  };
});
const offsetRunway = airport.runways.find(item => item.label === '15R')!;
const offsetFrame = runwayFrame(airport, offsetRunway);
scenarios.push({
  name: '15R-final-transition',
  plane: makePlane({ ...approachPoint(airport, offsetRunway, 20), heading: offsetFrame.approachHeading,
    targetHeading: offsetFrame.approachHeading, altitude: 500, targetAltitude: 0, speed: 140, targetSpeed: 140,
    isEstablished: true, establishedRunwayId: offsetRunway.id, assignedRunwayId: offsetRunway.id }),
  config: { [offsetRunway.id]: { landing: true, departure: false } }, landing: true, transition: true,
});
const common = makePlane({ x: 500, y: 700, heading: 90, targetHeading: 90,
  altitude: 8000, targetAltitude: 8000, speed: 180, targetSpeed: 180 });
scenarios.push(
  { name: 'straight', plane: common, config: {} },
  { name: 'turn-climb-accelerate', plane: { ...common, heading: 350, targetHeading: 90,
    targetAltitude: 10000, targetSpeed: 240 }, config: {} },
  { name: 'direct-to', plane: { ...common, targetWaypoint: airport.waypoints[0].id }, config: {} },
);

// Instrumented model consistency, not independent flight dynamics or real-play evidence.
for (const speed of ['real', 1] as GameSpeed[]) {
  for (const aspect of [1, 2]) {
    for (const scenario of scenarios) {
      it(`matches every forecast sample: ${scenario.name}, ${speed}, aspect ${aspect}`, () => {
        const domain = createRadarDomain(aspect, 392);
        const original = structuredClone(scenario.plane);
        const prediction = predictFlightPath(scenario.plane, airport, scenario.config, width, speed, horizon, domain);
        const secondsPerTick = .05 / (speed === 'real' ? 1 : speed);
        const samples = new Map(prediction.points.map(point => [Math.round(point.seconds / secondsPerTick), point]));
        let live = structuredClone(original);
        let ended = false;
        let elapsed = 0;
        let compared = 0;
        let maxPosition = 0, maxHeading = 0, maxAltitude = 0, maxSpeed = 0;
        const compare = (tick: number) => {
          const point = samples.get(tick);
          if (!point) return;
          compared++;
          maxPosition = Math.max(maxPosition, Math.hypot(point.x - live.x, point.y - live.y));
          maxHeading = Math.max(maxHeading, Math.abs(((point.heading - live.heading + 540) % 360) - 180));
          maxAltitude = Math.max(maxAltitude, Math.abs(point.altitude - live.altitude));
          maxSpeed = Math.max(maxSpeed, Math.abs(point.speed - live.speed));
          expect(point.isEstablished).toBe(live.isEstablished);
        };
        compare(0);
        for (let tick = 1; tick <= Math.floor(horizon / secondsPerTick); tick++) {
          live = advancePlane(live, airport, scenario.config, width, speed).plane;
          elapsed = tick * secondsPerTick;
          const fate = trackFate(live, airport, domain);
          compare(tick);
          if (!fate.keep) {
            ended = true;
            if (scenario.landing) expect(fate.success).toBe(true);
            break;
          }
        }
        expect(compared).toBe(prediction.points.length);
        expect(compared).toBeGreaterThan(1);
        expect(prediction.ended).toBe(ended);
        expect(prediction.seconds).toBe(elapsed);
        // Zero tolerance is justified: identical deterministic steps and inputs, no external integrator.
        expect([maxPosition, maxHeading, maxAltitude, maxSpeed]).toEqual([0, 0, 0, 0]);
        expect(scenario.plane).toEqual(original);
        if (scenario.landing) expect(prediction.points.some(point => point.isEstablished)).toBe(true);
        if (scenario.transition) {
          const thresholdBearing = (Math.atan2(offsetFrame.threshold.x - original.x, original.y - offsetFrame.threshold.y) * 180 / Math.PI + 360) % 360;
          expect(thresholdBearing).not.toBe(offsetFrame.approachHeading);
          expect(live.heading).not.toBe(original.heading);
        }
        console.info('KBOS_FORECAST', JSON.stringify({ scenario: scenario.name, speed, aspect, compared,
          seconds: elapsed, ended, x: live.x, y: live.y, heading: live.heading, altitude: live.altitude,
          maxPosition, maxHeading, maxAltitude, maxSpeed }));
      });
    }
  }
}
