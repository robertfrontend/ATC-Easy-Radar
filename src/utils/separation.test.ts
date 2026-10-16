import { describe, expect, it } from 'vitest';
import { makePlane } from '../test/field';
import { applySeparation } from './separation';

function pair(left: Partial<Parameters<typeof makePlane>[0]>, right: Partial<Parameters<typeof makePlane>[0]>) {
  return [
    makePlane({ id: 'a', x: 0, y: 0, altitude: 8000, ...left }),
    makePlane({ id: 'b', x: 10, y: 0, altitude: 8000, ...right }),
  ];
}

describe('separation', () => {
  it('crashes a pair inside 20 units and 1,000 ft', () => {
    const planes = pair({}, {});
    const outcome = applySeparation(planes);
    expect(outcome.collisions).toBe(1);
    expect(outcome.warning).toBe(false);
    expect(planes[0].status).toBe('crashed');
    expect(planes[1].status).toBe('crashed');
    expect(planes[0].markedForRemoval).toBe(true);
    expect(planes[1].markedForRemoval).toBe(true);
  });

  it('does not count a pair that is already marked', () => {
    const planes = pair({ markedForRemoval: true, status: 'crashed' }, { markedForRemoval: true, status: 'crashed' });
    const outcome = applySeparation(planes);
    expect(outcome.collisions).toBe(0);
    expect(outcome.warning).toBe(false);
  });

  it('warns between 20 and 55 units without crashing', () => {
    const onTheEdge = pair({}, { x: 20 });
    const edge = applySeparation(onTheEdge);
    expect(edge.collisions).toBe(0);
    expect(edge.warning).toBe(true);
    expect(onTheEdge[0].status).toBe('warning');
    expect(onTheEdge[0].conflict).toBe(true);
    expect(onTheEdge[1].markedForRemoval).toBe(false);

    const wider = pair({}, { x: 40 });
    expect(applySeparation(wider).warning).toBe(true);
  });

  it('is clear at 55 units or at 1,000 ft of vertical separation', () => {
    expect(applySeparation(pair({}, { x: 55 })).warning).toBe(false);
    expect(applySeparation(pair({}, { x: 55 })).collisions).toBe(0);

    const stacked = pair({ altitude: 5000 }, { x: 0, altitude: 6000 });
    const outcome = applySeparation(stacked);
    expect(outcome.collisions).toBe(0);
    expect(outcome.warning).toBe(false);
    expect(stacked[0].status).toBe('normal');
  });

  it('treats 999 ft as a conflict and 1,000 ft as clear', () => {
    const close = pair({ altitude: 5000 }, { x: 0, altitude: 5999 });
    expect(applySeparation(close).collisions).toBe(1);

    const level = pair({ altitude: 4000 }, { x: 30, altitude: 5000 });
    const outcome = applySeparation(level);
    expect(outcome.collisions).toBe(0);
    expect(outcome.warning).toBe(false);
  });

  it('exempts a pair when both aircraft are below 1,000 ft', () => {
    const planes = pair({ altitude: 400 }, { x: 5, altitude: 800 });
    const outcome = applySeparation(planes);
    expect(outcome.collisions).toBe(0);
    expect(outcome.warning).toBe(false);
    expect(planes[0].status).toBe('normal');
  });

  it('still conflicts when only one aircraft is below 1,000 ft', () => {
    const planes = pair({ altitude: 500 }, { x: 30, altitude: 1200 });
    const outcome = applySeparation(planes);
    expect(outcome.collisions).toBe(0);
    expect(outcome.warning).toBe(true);
    expect(planes[0].status).toBe('warning');
  });

  it('does not downgrade a crashed track to a warning', () => {
    const planes = pair({ status: 'crashed' }, { x: 30 });
    applySeparation(planes);
    expect(planes[0].status).toBe('crashed');
    expect(planes[1].status).toBe('warning');
    expect(planes[0].conflict).toBe(true);
  });

  it('counts two separate collisions and only one warning for several conflict pairs', () => {
    const planes = [
      makePlane({ id: 'a', x: 0, y: 0, altitude: 9000 }),
      makePlane({ id: 'b', x: 8, y: 0, altitude: 9000 }),
      makePlane({ id: 'c', x: 400, y: 0, altitude: 7000 }),
      makePlane({ id: 'd', x: 410, y: 0, altitude: 7000 }),
      makePlane({ id: 'e', x: 800, y: 0, altitude: 6000 }),
      makePlane({ id: 'f', x: 830, y: 0, altitude: 6000 }),
    ];
    const outcome = applySeparation(planes);
    expect(outcome.collisions).toBe(2);
    expect(outcome.warning).toBe(true);
    expect(planes[4].status).toBe('warning');
    expect(planes[4].markedForRemoval).toBe(false);
  });
});
