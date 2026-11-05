import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIRCRAFT_RADIUS, GROUND_VIEW, NODES, RUNWAYS } from './airport';
import { GroundMap } from './GroundMap';
import { createGroundState, advanceGround } from './simulation';
import { aircraftAppearance, aircraftHeight, arrivalInstruction, groundTrackReadout, groundTrackPresentation } from './presentation';
import { scopeColor } from '../theme/radarTheme';

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

  it('omits decorative airport perimeter and map heading while retaining operational landmarks and accessibility', () => {
    const markup = renderToStaticMarkup(createElement(GroundMap, { state: createGroundState(), selectedId: null, onSelect() {} }));
    expect(markup).not.toContain('M 50 680 L 50 60 L 1020 60 L 1020 725');
    expect(markup).not.toContain('class="ground-map-title"');
    expect(markup).not.toContain('Fictional airport · Not for navigation');
    expect(markup).toContain('aria-label="Willow Field airport map"');
    expect(markup).toContain('Willow Field terminal');
    expect(markup).toContain('data-boarding-gate="stand-1"');
    expect(markup).toContain('data-hold-point="hold-09"');
    expect(markup).toContain('data-runway="09"');
  });

  it('preserves physical airframes while rendering radar targets with the shared scope palette', () => {
    const state = createGroundState();
    const departure = aircraftAppearance(state.aircraft[0].id);
    const arrival = aircraftAppearance(state.aircraft[1].id);
    expect(departure.engines).toBe(1);
    expect(arrival.engines).toBe(2);
    expect(aircraftAppearance(state.aircraft[0].id)).toEqual(departure);
    expect(Math.max(departure.radius, arrival.radius)).toBeLessThanOrEqual(AIRCRAFT_RADIUS);
    const markup = renderToStaticMarkup(createElement(GroundMap, { state, selectedId: null, onSelect() {} }));
    expect(markup.match(/data-ground-radar-target="true"/g)).toHaveLength(2);
    expect(markup.match(/>✳</g)).toHaveLength(2);
    expect(markup).toContain(`fill="${scopeColor.arrival}"`);
    expect(markup).toContain(`fill="${scopeColor.departure}"`);
    expect(markup).not.toContain('data-engine=');
    expect(markup).not.toContain('data-aircraft-height=');
    expect(markup).toContain('PARKED');
    expect(markup).toContain('APPROACH');
  });

  it('uses only actual ground state and assigned runway or gate in the radar data block', () => {
    const [departure, arrival] = createGroundState().aircraft;
    expect(groundTrackReadout(departure)).toEqual({ line1: 'GC101', line2: 'PARKED', line3: 'GATE 1' });
    expect(groundTrackReadout(arrival)).toEqual({ line1: 'GC202', line2: 'APPROACH', line3: 'RWY 09' });
    departure.phase = 'holding'; departure.standId = null;
    expect(groundTrackReadout(departure).line3).toBe('RWY 09');
    arrival.phase = 'awaiting-taxi'; arrival.standId = 'stand-2';
    expect(groundTrackReadout(arrival)).toEqual({ line1: 'GC202', line2: 'AWAIT TAXI', line3: 'GATE 2' });
  });

  it('keeps radar annotations screen-sized and staggers nearby gate labels without moving tracks', () => {
    const aircraft = createGroundState().aircraft[0];
    const labels = [0, 1, 2, 3].map(index => groundTrackPresentation(aircraft, .4, index));
    expect(labels[0].inverseScale).toBe(2.5);
    expect(labels[0].hitRadius).toBe(55);
    expect(labels[0].callsignSize).toBe(12);
    expect(labels.map(label => label.labelY)).toEqual([-40, 4, 48, 92]);
    const narrow = [0, 1, 2, 3].map(index => groundTrackPresentation(aircraft, .2, index, 4));
    expect(new Set(narrow.map(label => label.labelY)).size).toBe(4);
    expect(narrow[3].labelY + 28).toBeLessThan((GROUND_VIEW.y + GROUND_VIEW.height - aircraft.position.y) * .2);
    expect(aircraft.position).toEqual(NODES['stand-1']);
  });

  it('uses the ground east-origin bearing for moving cues and omits cues for stopped or blocked aircraft', () => {
    const aircraft = createGroundState().aircraft[0];
    expect(groundTrackPresentation(aircraft, 1).heading).toBeNull();
    aircraft.phase = 'taxiing'; aircraft.heading = 0;
    expect(groundTrackPresentation(aircraft, 1).heading).toBe(90);
    aircraft.phase = 'stopped';
    expect(groundTrackPresentation(aircraft, 1).heading).toBeNull();
    aircraft.phase = 'taxiing'; aircraft.blocked = 'Waiting for corridor';
    expect(groundTrackPresentation(aircraft, 1).heading).toBeNull();
  });

  it('preserves non-color-only selection, warning and keyboard selection cues on radar tracks', () => {
    const state = createGroundState();
    state.aircraft[0].blocked = 'Waiting for corridor';
    const markup = renderToStaticMarkup(createElement(GroundMap, { state, selectedId: 'GC101', onSelect() {} }));
    expect(markup).toContain('aria-label="Select GC101" aria-pressed="true"');
    expect(markup).toContain('data-ground-track-selection="true"');
    expect(markup).toContain('data-ground-track-warning="true"');
    expect(markup).toContain(`fill="${scopeColor.selected}"`);
    expect(markup).toContain('tabindex="0"');
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
