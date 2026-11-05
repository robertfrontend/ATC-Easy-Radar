import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIRCRAFT_RADIUS, GROUND_VIEW, NODES, RUNWAYS } from './airport';
import { GroundMap } from './GroundMap';
import { createGroundState, advanceGround } from './simulation';
import { aircraftAppearance, aircraftHeight, arrivalInstruction } from './presentation';

describe('airport scene presentation', () => {
  it('provides visible field around approaches and terminal, but removes departures only outside the camera', () => {
    expect(GROUND_VIEW.x).toBeLessThan(-150);
    expect(GROUND_VIEW.y).toBeLessThan(-150);
    expect(GROUND_VIEW.y + GROUND_VIEW.height - 796).toBeGreaterThan(180);
    expect(NODES['approach-09'].x - GROUND_VIEW.x).toBeGreaterThan(80);
    expect(GROUND_VIEW.y + GROUND_VIEW.height - NODES['approach-36'].y).toBeGreaterThan(80);
    expect(NODES['depart-09'].x).toBeGreaterThan(GROUND_VIEW.x + GROUND_VIEW.width + AIRCRAFT_RADIUS);
    expect(NODES['depart-36'].y).toBeLessThan(GROUND_VIEW.y - AIRCRAFT_RADIUS);
    expect(advanceGround(createGroundState(), 40).aircraft.find(a => a.id === 'GC202')?.phase).toBe('approach');
  });

  it('draws grey taxi pavement without letter labels or yellow centerlines, retaining white safety holds and boarding gates', () => {
    const markup = renderToStaticMarkup(createElement(GroundMap, { state: createGroundState(), selectedId: null, onSelect() {} }));
    expect(markup).toContain(`viewBox="${GROUND_VIEW.x} ${GROUND_VIEW.y} ${GROUND_VIEW.width} ${GROUND_VIEW.height}"`);
    expect(markup).not.toContain('ground-taxi-label');
    expect(markup).not.toMatch(/stroke="#(?:e0c75f|f4d06a)"/);
    expect(markup).toContain('data-taxi-pavement="true"');
    expect(markup).toContain('data-boarding-gate="stand-1"');
    expect(markup).toContain('Gate 1');
    expect(markup).toContain('data-hold-point="hold-09"');
  });

  it('renders stable single- and twin-engine profiles within their physical separation envelope', () => {
    const state = createGroundState();
    const departure = aircraftAppearance(state.aircraft[0].id);
    const arrival = aircraftAppearance(state.aircraft[1].id);
    expect(departure.engines).toBe(1);
    expect(arrival.engines).toBe(2);
    expect(aircraftAppearance(state.aircraft[0].id)).toEqual(departure);
    expect(Math.max(departure.radius, arrival.radius)).toBeLessThanOrEqual(AIRCRAFT_RADIUS);
    const markup = renderToStaticMarkup(createElement(GroundMap, { state, selectedId: null, onSelect() {} }));
    expect(markup).toContain('data-airframe="single-prop"');
    expect(markup).toContain('data-airframe="twin-jet"');
    expect(markup.match(/data-engine="/g)).toHaveLength(3);
  });

  it('brings the aircraft shadow onto the runway at touchdown and explains each required arrival clearance', () => {
    const aircraft = createGroundState().aircraft[1];
    expect(aircraftHeight(aircraft)).toBe(1);
    expect(arrivalInstruction(aircraft)).toContain('Clear landing 09');
    aircraft.phase = 'landing';
    aircraft.position = { ...NODES[RUNWAYS['09'].threshold] };
    expect(aircraftHeight(aircraft)).toBe(0);
    aircraft.phase = 'awaiting-taxi'; aircraft.standId = 'stand-2';
    expect(arrivalInstruction(aircraft)).toContain('Taxi to stand 2');
    aircraft.phase = 'turnaround';
    expect(arrivalInstruction(aircraft)).toContain('Gate 2');
  });
});
