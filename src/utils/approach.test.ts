import { describe, expect, it } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { approachStatus, evaluateIlsCapture, localizerGuidance, trackFate } from './approach';
import { advancePlane } from './sim';

const ILS = 0.4;

function onApproach(extra: Partial<Parameters<typeof makePlane>[0]> = {}) {
  return makePlane({
    x: field.x,
    y: field.y + 200,
    heading: 0,
    altitude: 4000,
    speed: 180,
    type: 'arrival',
    ...extra,
  });
}

describe('ILS capture', () => {
  it('captures an aligned arrival inside the cone at or below 10,000 ft', () => {
    const captured = evaluateIlsCapture(onApproach(), field, fieldRunways, ILS);
    expect(captured.justCaptured).toBe(true);
    expect(captured.isEstablished).toBe(true);
    expect(captured.establishedRunwayId).toBe('rwy-36');

    const atCeiling = evaluateIlsCapture(onApproach({ altitude: 10000 }), field, fieldRunways, ILS);
    expect(atCeiling.justCaptured).toBe(true);
  });

  it('rejects the cone edges, a high aircraft, and a heading outside 50 degrees', () => {
    expect(evaluateIlsCapture(onApproach({ y: field.y + 20 }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ y: field.y + 21 }), field, fieldRunways, ILS).justCaptured).toBe(true);
    expect(evaluateIlsCapture(onApproach({ y: field.y + 520 }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ y: field.y + 519 }), field, fieldRunways, ILS).justCaptured).toBe(true);

    const lateralLimit = 200 * ILS;
    expect(evaluateIlsCapture(onApproach({ x: field.x + lateralLimit }), field, fieldRunways, ILS).justCaptured).toBe(true);
    expect(evaluateIlsCapture(onApproach({ x: field.x + lateralLimit + 1 }), field, fieldRunways, ILS).justCaptured).toBe(false);

    expect(evaluateIlsCapture(onApproach({ altitude: 10001 }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ heading: 49 }), field, fieldRunways, ILS).justCaptured).toBe(true);
    expect(evaluateIlsCapture(onApproach({ heading: 50 }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ heading: 311 }), field, fieldRunways, ILS).justCaptured).toBe(true);
    expect(evaluateIlsCapture(onApproach({ heading: 310 }), field, fieldRunways, ILS).justCaptured).toBe(false);
  });

  it('uses the tighter cone when the difficulty width is smaller', () => {
    const offset = onApproach({ x: field.x + 40 });
    expect(evaluateIlsCapture(offset, field, fieldRunways, 0.4).justCaptured).toBe(true);
    expect(evaluateIlsCapture(offset, field, fieldRunways, 0.12).justCaptured).toBe(false);
  });

  it('does not capture departures, go-arounds, crashed tracks, or an aircraft already established', () => {
    expect(evaluateIlsCapture(onApproach({ type: 'departure' }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ goAround: true }), field, fieldRunways, ILS).justCaptured).toBe(false);
    expect(evaluateIlsCapture(onApproach({ status: 'crashed' }), field, fieldRunways, ILS).justCaptured).toBe(false);
    const already = evaluateIlsCapture(
      onApproach({ isEstablished: true, establishedRunwayId: 'rwy-36' }),
      field,
      fieldRunways,
      ILS,
    );
    expect(already.justCaptured).toBe(false);
    expect(already.isEstablished).toBe(true);
  });

  it('only considers the assigned runway, and only when it is landing', () => {
    const on36 = onApproach({ assignedRunwayId: 'rwy-18' });
    expect(evaluateIlsCapture(on36, field, fieldRunways, ILS).justCaptured).toBe(false);

    const on18 = onApproach({ x: field.x + 40, y: field.y - 200, heading: 180 });
    expect(evaluateIlsCapture(on18, field, fieldRunways, ILS).justCaptured).toBe(false);

    const bothLanding: typeof fieldRunways = {
      'rwy-36': { landing: true, departure: true },
      'rwy-18': { landing: true, departure: false },
    };
    const captured = evaluateIlsCapture(on18, field, bothLanding, ILS);
    expect(captured.justCaptured).toBe(true);
    expect(captured.establishedRunwayId).toBe('rwy-18');
  });

  it('locks the glideslope on the same tick the localizer is captured', () => {
    const step = advancePlane(onApproach(), field, fieldRunways, ILS, 1);
    expect(step.justCaptured).toBe(true);
    expect(step.plane.isEstablished).toBe(true);
    expect(step.plane.targetAltitude).toBe(0);
    expect(step.plane.targetSpeed).toBe(140);

    const next = advancePlane(step.plane, field, fieldRunways, ILS, 1);
    expect(next.justCaptured).toBe(false);
    expect(next.plane.isEstablished).toBe(true);
  });
});

describe('established approach', () => {
  it('corrects toward the centerline and descends at approach speed', () => {
    const centered = localizerGuidance(makePlane({ x: field.x, y: field.y + 200 }), field, 'rwy-36');
    expect(centered.targetHeading).toBe(0);
    expect(centered.targetAltitude).toBe(0);
    expect(centered.targetSpeed).toBe(140);

    const east = localizerGuidance(makePlane({ x: field.x + 10, y: field.y + 200 }), field, 'rwy-36');
    expect(east.targetHeading).toBe(340);

    const west = localizerGuidance(makePlane({ x: field.x - 10, y: field.y + 200 }), field, 'rwy-36');
    expect(west.targetHeading).toBe(20);

    const wide = localizerGuidance(makePlane({ x: field.x + 40, y: field.y + 200 }), field, 'rwy-36');
    expect(wide.targetHeading).toBe(330);
  });
});

describe('unstable approach', () => {
  it('flags a low unestablished arrival near the field', () => {
    const low = { x: field.x, y: field.y + 60, altitude: 2500, speed: 180, isEstablished: false };
    expect(approachStatus(makePlane(), field, low)).toBe('bad_approach');
    expect(approachStatus(makePlane(), field, { ...low, y: field.y + 100 })).toBe('normal');
    expect(approachStatus(makePlane(), field, { ...low, altitude: 2501 })).toBe('normal');
  });

  it('does not flag a departure climbing over the field', () => {
    const overTheField = { x: field.x, y: field.y, altitude: 800, speed: 160, isEstablished: false };
    expect(approachStatus(makeDeparture(), field, overTheField)).toBe('normal');
    expect(approachStatus(makePlane({ type: 'arrival' }), field, overTheField)).toBe('bad_approach');
  });

  it('flags an established arrival that is fast inside the final bubble', () => {
    const onFinal = { x: field.x, y: field.y + 30, altitude: 1200, speed: 161, isEstablished: true };
    expect(approachStatus(makePlane(), field, onFinal)).toBe('bad_approach');
    expect(approachStatus(makePlane(), field, { ...onFinal, speed: 160 })).toBe('normal');
    expect(approachStatus(makePlane(), field, { ...onFinal, y: field.y + 50 })).toBe('normal');
  });

  it('keeps a crashed status', () => {
    const low = { x: field.x, y: field.y, altitude: 500, speed: 200, isEstablished: false };
    expect(approachStatus(makePlane({ status: 'crashed' }), field, low)).toBe('crashed');
  });

  it('marks the moved arrival after a tick and leaves the departure alone', () => {
    const arrival = advancePlane(
      makePlane({ x: field.x, y: field.y, altitude: 1000, speed: 200, targetAltitude: 1000, targetSpeed: 200 }),
      field,
      fieldRunways,
      ILS,
      1,
    );
    expect(arrival.plane.status).toBe('bad_approach');

    const departure = advancePlane(makeDeparture({ altitude: 800, speed: 160 }), field, fieldRunways, ILS, 1);
    expect(departure.plane.status).toBe('normal');
  });
});

describe('landing', () => {
  it('scores an established arrival that reaches the runway', () => {
    const fate = trackFate(makePlane({
      x: field.x + 20,
      isEstablished: true,
      establishedRunwayId: 'rwy-36',
      heading: 90,
      speed: 300,
      altitude: 4000,
    }), field);
    expect(fate).toEqual({ keep: false, score: true, accident: false, success: true });
  });

  it('stays airborne at 30 units even when established', () => {
    const fate = trackFate(makePlane({
      x: field.x + 30,
      isEstablished: true,
      establishedRunwayId: 'rwy-36',
    }), field);
    expect(fate.keep).toBe(true);
  });

  it('lands an unestablished arrival that is low, slow, and aligned', () => {
    const landed = trackFate(makePlane({
      x: field.x,
      y: field.y + 20,
      isEstablished: false,
      altitude: 2000,
      speed: 220,
      heading: 0,
    }), field);
    expect(landed.score).toBe(true);
    expect(landed.accident).toBe(false);

    const barelyAligned = trackFate(makePlane({
      y: field.y + 20,
      altitude: 1500,
      speed: 180,
      heading: 19,
    }), field);
    expect(barelyAligned.score).toBe(true);

    const fromTheOtherSide = trackFate(makePlane({
      y: field.y + 20,
      altitude: 1500,
      speed: 180,
      heading: 341,
    }), field);
    expect(fromTheOtherSide.score).toBe(true);
  });

  it('crashes an unestablished arrival that is fast or not aligned', () => {
    const fast = trackFate(makePlane({
      y: field.y + 10,
      altitude: 2000,
      speed: 221,
      heading: 0,
    }), field);
    expect(fast).toEqual({ keep: false, score: false, accident: true, success: false });

    const offset = trackFate(makePlane({
      y: field.y + 10,
      altitude: 1800,
      speed: 160,
      heading: 20,
    }), field);
    expect(offset.accident).toBe(true);

    const opposite = trackFate(makePlane({
      y: field.y + 10,
      altitude: 1800,
      speed: 160,
      heading: 340,
    }), field);
    expect(opposite.accident).toBe(true);
  });

  it('does not land or crash an unestablished arrival still above 2,000 ft', () => {
    const fate = trackFate(makePlane({
      y: field.y + 10,
      altitude: 2001,
      speed: 250,
      heading: 90,
    }), field);
    expect(fate.keep).toBe(true);
    expect(fate.accident).toBe(false);
  });

  it('scores a departure handoff and drops a crashed one without another point', () => {
    const handoff = trackFate(makeDeparture({ markedForRemoval: true, altitude: 6000 }), field);
    expect(handoff).toEqual({ keep: false, score: true, accident: false, success: true });

    const crashed = trackFate(makeDeparture({ markedForRemoval: true, status: 'crashed' }), field);
    expect(crashed).toEqual({ keep: false, score: false, accident: false, success: false });

    const arrival = trackFate(makePlane({ markedForRemoval: true }), field);
    expect(arrival.score).toBe(false);
    expect(arrival.keep).toBe(false);
  });

  it('drops an uncleared departure that leaves the sector and keeps one cleared direct', () => {
    const left = trackFate(makeDeparture({ x: field.x + 601, altitude: 8000 }), field);
    expect(left).toEqual({ keep: false, score: false, accident: false, success: false });

    const onTheRing = trackFate(makeDeparture({ x: field.x + 600, altitude: 8000 }), field);
    expect(onTheRing.keep).toBe(true);

    const cleared = trackFate(makeDeparture({
      x: field.x + 700,
      altitude: 8000,
      targetWaypoint: 'east',
    }), field);
    expect(cleared.keep).toBe(true);
  });

  it('removes a track that reaches the map edge', () => {
    expect(trackFate(makePlane({ x: field.x + 2499, type: 'arrival' }), field).keep).toBe(true);
    const gone = trackFate(makePlane({ x: field.x + 2500, type: 'arrival' }), field);
    expect(gone).toEqual({ keep: false, score: false, accident: false, success: false });

    const clearedDeparture = trackFate(makeDeparture({
      x: field.x + 2500,
      targetWaypoint: 'east',
      altitude: 10000,
    }), field);
    expect(clearedDeparture.keep).toBe(false);
    expect(clearedDeparture.score).toBe(false);
  });
});
