import { describe, expect, it } from 'vitest';
import { AIRCRAFT_RADIUS, EDGES, GROUND_VIEW, NODES, RUNWAYS, distance, findRoute } from './airport';
import { advanceGround, commandGround, createGroundState, getAircraftActions, runwayOccupancy } from './simulation';
import type { GroundState } from './model';

const step = (state: GroundState, seconds: number) => advanceGround(state, seconds);
const send = (state: GroundState, id: string, type: 'taxi' | 'land' | 'takeoff' | 'cross' | 'stop' | 'resume', runway?: '09' | '36') => commandGround(state, { type, id, runway });
const plane = (state: GroundState, id: string) => state.aircraft.find(a => a.id === id)!;
function until(state: GroundState, predicate: (s: GroundState) => boolean, limit = 180) {
  for (let i = 0; i < limit * 4 && !predicate(state); i++) state = step(state, 0.25);
  expect(predicate(state)).toBe(true);
  return state;
}

describe('airport surface graph', () => {
  it('routes only over connected segments and exposes mandatory runway crossings', () => {
    const route = findRoute('stand-1', 'hold-36');
    expect(route[0]).toBe('stand-1');
    expect(route.at(-1)).toBe('hold-36');
    expect(route.some((id, i) => i && EDGES.some(e => e.runway && ((e.from === route[i - 1] && e.to === id) || (e.to === route[i - 1] && e.from === id))))).toBe(true);
    for (let i = 1; i < route.length; i++) expect(EDGES.some(e => e.from === route[i - 1] && e.to === route[i] || e.to === route[i - 1] && e.from === route[i])).toBe(true);
    expect(Object.values(NODES).every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(findRoute('missing', 'hold-09')).toEqual([]);
  });
});

describe('ground clearances and flows', () => {
  it('starts reproducibly with a departure and a visible arrival', () => {
    expect(createGroundState()).toEqual(createGroundState());
    expect(createGroundState().aircraft.map(a => a.kind)).toEqual(['departure', 'arrival']);
  });
  it('taxi ends at a hold and never grants takeoff or runway entry', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '09');
    state = until(state, s => plane(s, 'GC101').phase === 'holding');
    expect(state.operations.departures).toBe(0);
    expect(state.reservation).toBeNull();
    expect(plane(state, 'GC101').position).toEqual(NODES['hold-09']);
    expect(runwayOccupancy(state)['09']).not.toContain('GC101');
    state = send(state, 'GC101', 'takeoff');
    state = until(state, s => !s.aircraft.some(a => a.id === 'GC101'));
    expect(state.operations.departures).toBe(1);
    expect(state.reservation).toBeNull();
  });
  it('requires separate crossing clearance while taxiing to runway 36', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '36');
    state = until(state, s => plane(s, 'GC101').phase === 'crossing-hold');
    const before = plane(state, 'GC101').position;
    state = step(state, 4);
    expect(plane(state, 'GC101').position).toEqual(before);
    expect(state.reservation).toBeNull();
    state = send(state, 'GC101', 'cross');
    expect(state.reservation?.owner).toBe('GC101');
    state = until(state, s => plane(s, 'GC101').phase === 'holding');
    expect(state.reservation).toBeNull();
    expect(plane(state, 'GC101').position).toEqual(NODES['hold-36']);
  });
  it('blocks intersecting operations even before physical occupancy', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '09');
    state = until(state, s => plane(s, 'GC101').phase === 'holding');
    state = send(state, 'GC101', 'takeoff');
    const result = send(state, 'GC202', 'land');
    expect(plane(result, 'GC202').phase).not.toBe('landing');
    expect(result.message).toMatch(/reserved|occupied/i);
    expect(getAircraftActions(state, 'GC202').find(a => a.type === 'land')?.blocked).toMatch(/reserved|occupied/i);
  });
  it('reserves a stand before landing, clears the runway physically, then awaits taxi', () => {
    let state = send(createGroundState(), 'GC202', 'land');
    expect(plane(state, 'GC202').standId).toBeTruthy();
    expect(state.reservation?.owner).toBe('GC202');
    state = until(state, s => plane(s, 'GC202').phase === 'exiting');
    expect(state.reservation?.owner).toBe('GC202');
    expect(runwayOccupancy(state)['09']).toContain('GC202');
    state = until(state, s => plane(s, 'GC202').phase === 'awaiting-taxi');
    expect(runwayOccupancy(state)['09']).not.toContain('GC202');
    expect(state.reservation).toBeNull();
    expect(state.operations.arrivals).toBe(0);
    state = send(state, 'GC202', 'taxi');
    state = until(state, s => plane(s, 'GC202').phase === 'crossing-hold');
    state = send(state, 'GC202', 'cross');
    state = until(state, s => plane(s, 'GC202').phase === 'turnaround');
    expect(state.operations.arrivals).toBe(1);
    state = step(state, 1);
    expect(state.operations.arrivals).toBe(1);
  });
  it('keeps uncleared arrivals visible through a missed approach', () => {
    const state = until(createGroundState(), s => plane(s, 'GC202').phase === 'go-around');
    expect(plane(state, 'GC202')).toBeDefined();
    expect(plane(state, 'GC202').goArounds).toBeGreaterThan(0);
    expect(state.message).toMatch(/go-around/i);
  });
  it('rejects impossible commands without teleporting aircraft', () => {
    const initial = createGroundState();
    const next = send(initial, 'GC101', 'takeoff');
    expect(next.aircraft).toEqual(initial.aircraft);
    expect(next.message).toMatch(/hold|available|state/i);
  });
  it('queues taxi clearances with safe separation and allows stop/resume', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '09');
    state = step(state, 2);
    state = send(state, 'GC101', 'stop');
    const position = plane(state, 'GC101').position;
    state = step(state, 3);
    expect(plane(state, 'GC101').position).toEqual(position);
    state = send(state, 'GC101', 'resume');
    state = step(state, 1);
    expect(plane(state, 'GC101').position).not.toEqual(position);
  });
});

describe('simulation clock and lifecycle', () => {
  it('is frame-rate independent and speed applies to the entire clock', () => {
    const a = step(createGroundState(), 10);
    let b = createGroundState();
    for (let i = 0; i < 100; i++) b = step(b, 0.1);
    expect(b.elapsed).toBeCloseTo(a.elapsed, 5);
    expect(plane(b, 'GC202').position.x).toBeCloseTo(plane(a, 'GC202').position.x, 5);
    const fast = step(commandGround(createGroundState(), { type: 'speed', speed: 2 }), 5);
    expect(fast.elapsed).toBeCloseTo(a.elapsed, 5);
  });
  it('pause freezes all timers, traffic, position and delay; reset clears everything', () => {
    const state = commandGround(step(createGroundState(), 3), { type: 'pause' });
    expect(step(state, 100)).toEqual(state);
    expect(commandGround(state, { type: 'restart' })).toEqual(createGroundState());
  });
  it('closes traffic at eight simulated minutes, then drains without ending early', () => {
    let state = step(createGroundState(), 481);
    expect(state.shift).toBe('closing');
    const created = state.nextId;
    state = step(state, 50);
    expect(state.nextId).toBe(created);
    expect(state.aircraft.length).toBeGreaterThan(0);
  });
});


describe('resource recovery and traffic soak', () => {
  it('counts waiting landing requests through repeated circuits', () => {
    const state = step(createGroundState(), 65);
    expect(plane(state, 'GC202').delay).toBeGreaterThan(15);
  });
  it('turns a completed arrival into exactly one departure while the shift is open', () => {
    let state = send(createGroundState(), 'GC202', 'land');
    state = until(state, s => plane(s, 'GC202').phase === 'awaiting-taxi');
    state = send(state, 'GC202', 'taxi');
    state = until(state, s => plane(s, 'GC202').phase === 'crossing-hold');
    state = send(state, 'GC202', 'cross');
    state = until(state, s => plane(s, 'GC202').phase === 'turnaround');
    state = step(state, 26);
    expect(plane(state, 'GC202').phase).toBe('parked');
    expect(plane(state, 'GC202').kind).toBe('departure');
    expect(state.operations.arrivals).toBe(1);
  });
  it('autoplays mixed traffic to gradual completion without overlap or leaked resources', () => {
    let state = createGroundState();
    let minimum = Infinity;
    for (let i = 0; i < 1800 * 4 && state.shift !== 'complete'; i++) {
      for (const aircraft of [...state.aircraft]) {
        const action = getAircraftActions(state, aircraft.id).find(a => !a.blocked && a.type !== 'stop' && a.type !== 'resume' && (a.type !== 'taxi' || !a.runway || a.runway === (Number(aircraft.id.slice(2)) % 2 ? '36' : '09')));
        if (action) state = commandGround(state, { type: action.type, id: aircraft.id, runway: action.runway });
      }
      state = step(state, 0.25);
      const surface = state.aircraft.filter(a => !['approach', 'go-around'].includes(a.phase));
      for (let j = 0; j < surface.length; j++) for (let k = j + 1; k < surface.length; k++) {
        minimum = Math.min(minimum, Math.hypot(surface[j].position.x - surface[k].position.x, surface[j].position.y - surface[k].position.y));
      }
    }
    expect(state.shift, JSON.stringify({ reservation: state.reservation, taxiOwner: state.taxiOwner, aircraft: state.aircraft })).toBe('complete');
    expect(state.operations.arrivals).toBeGreaterThan(1);
    expect(state.operations.departures).toBeGreaterThan(1);
    expect(state.reservation).toBeNull();
    expect(state.taxiOwner).toBeNull();
    expect(minimum).toBeGreaterThanOrEqual(33.9);
  });
});


describe('physical reservations and second runway', () => {
  it('keeps a departing stand reserved until the aircraft physically vacates it', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '09');
    expect(plane(state, 'GC101').standId).toBe('stand-1');
    state = step(state, 0.5);
    expect(plane(state, 'GC101').standId).toBe('stand-1');
    state = until(state, s => plane(s, 'GC101').standId === null);
    expect(distance(plane(state, 'GC101').position, NODES['stand-1'])).toBeGreaterThan(AIRCRAFT_RADIUS * 2 + 8);
    expect(plane(state, 'GC101').standId).toBeNull();
  });
  it('stop/resume at a crossing never substitutes for crossing clearance', () => {
    let state = send(createGroundState(), 'GC101', 'taxi', '36');
    state = until(state, s => plane(s, 'GC101').phase === 'crossing-hold');
    const position = plane(state, 'GC101').position;
    state = send(state, 'GC101', 'stop');
    state = send(state, 'GC101', 'resume');
    state = step(state, 3);
    expect(plane(state, 'GC101').phase).toBe('crossing-hold');
    expect(plane(state, 'GC101').position).toEqual(position);
    expect(state.reservation).toBeNull();
  });
  it('clears runway 36 physically before taxi and crosses runway 09 only by clearance', () => {
    let state = createGroundState();
    state.aircraft[1] = { ...state.aircraft[1], runway: '36', nodeId: 'approach-36', position: { ...NODES['approach-36'] }, route: ['decision-36'] };
    state = send(state, 'GC202', 'land');
    state = until(state, s => plane(s, 'GC202').phase === 'exiting');
    expect(runwayOccupancy(state)['36']).toContain('GC202');
    expect(state.reservation?.owner).toBe('GC202');
    state = until(state, s => plane(s, 'GC202').phase === 'awaiting-taxi');
    expect(runwayOccupancy(state)['36']).not.toContain('GC202');
    expect(state.reservation).toBeNull();
    state = send(state, 'GC202', 'taxi');
    state = until(state, s => plane(s, 'GC202').phase === 'crossing-hold');
    expect(plane(state, 'GC202').position).toEqual(NODES['cross-09-north']);
    state = send(state, 'GC202', 'cross');
    state = until(state, s => plane(s, 'GC202').phase === 'turnaround');
    expect(state.operations.arrivals).toBe(1);
  });
  it('blocks landing without a reservable stand', () => {
    const state = createGroundState();
    for (let i = 2; i <= 4; i++) state.aircraft.push({ ...structuredClone(state.aircraft[0]), id: `P${i}`, standId: `stand-${i}`, nodeId: `stand-${i}`, position: { ...NODES[`stand-${i}`] } });
    expect(getAircraftActions(state, 'GC202').find(a => a.type === 'land')?.blocked).toMatch(/stand/i);
    const blocked = send(state, 'GC202', 'land');
    expect(blocked.reservation).toBeNull();
    expect(plane(blocked, 'GC202').phase).toBe('approach');
  });
  it('returns immutable snapshots and keeps reservations through pause and speed changes', () => {
    const initial = createGroundState();
    let state = send(initial, 'GC202', 'land');
    expect(initial.reservation).toBeNull();
    expect(plane(state, 'GC202').position).toEqual(plane(initial, 'GC202').position);
    state = commandGround(state, { type: 'pause' });
    state = commandGround(state, { type: 'speed', speed: 2 });
    expect(state.reservation?.owner).toBe('GC202');
    expect(step(state, 15)).toEqual(state);
  });
});

it('does not place a departure hold on the landing approach path', () => {
  for (const runway of ['09', '36'] as const) {
    let state = createGroundState();
    const hold = `hold-${runway}`;
    state.aircraft[0] = { ...state.aircraft[0], runway, phase: 'holding', nodeId: hold, position: { ...NODES[hold] }, standId: null };
    state.aircraft[1] = { ...state.aircraft[1], runway, nodeId: `approach-${runway}`, position: { ...NODES[`approach-${runway}`] }, route: [`decision-${runway}`] };
    state = send(state, 'GC202', 'land');
    state = until(state, s => plane(s, 'GC202').phase === 'awaiting-taxi', 60);
    expect(state.reservation).toBeNull();
    expect(plane(state, 'GC101').phase).toBe('holding');
  }
});


describe('landing rollout deceleration', () => {
  it.each(['09', '36'] as const)('slows on runway %s before turning onto the exit', runwayId => {
    const initial = createGroundState();
    initial.aircraft = initial.aircraft.filter(a => a.id === 'GC202');
    initial.nextSpawn = Infinity;
    const arrival = plane(initial, 'GC202');
    const runway = RUNWAYS[runwayId];
    arrival.runway = runwayId;
    arrival.nodeId = runway.approach;
    arrival.position = { ...NODES[runway.approach] };
    const cleared = send(initial, arrival.id, 'land');

    function sample(progress: number) {
      const state = structuredClone(cleared);
      const aircraft = plane(state, arrival.id);
      const start = NODES[runway.threshold];
      const end = NODES[runway.rollout];
      aircraft.nodeId = runway.threshold;
      aircraft.routeIndex = 1;
      aircraft.position = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
      const before = { ...aircraft.position };
      const after = step(state, 1 / 30);
      expect(plane(after, arrival.id).phase).toBe('landing');
      expect(after.reservation?.owner).toBe(arrival.id);
      expect(runwayOccupancy(after)[runwayId]).toContain(arrival.id);
      return distance(before, plane(after, arrival.id).position) * 30;
    }

    const touchdownSpeed = sample(0.1);
    const exitApproachSpeed = sample(0.9);
    expect(exitApproachSpeed).toBeLessThan(touchdownSpeed * 0.75);
    expect(exitApproachSpeed).toBeGreaterThanOrEqual(20);
    expect(exitApproachSpeed).toBeLessThan(30);
  });
});


describe('landing exit availability', () => {
  it('refuses a landing reservation while the previous arrival is still at its exit', () => {
    let state = send(createGroundState(), 'GC202', 'land');
    state = until(state, s => plane(s, 'GC202').phase === 'awaiting-taxi');
    const incoming = structuredClone(plane(createGroundState(), 'GC202'));
    incoming.id = 'GC999';
    state.aircraft.push(incoming);
    expect(state.reservation).toBeNull();
    const landing = getAircraftActions(state, incoming.id).find(action => action.type === 'land');
    expect(landing?.blocked).toMatch(/exit.*GC202/i);
    expect(plane(send(state, incoming.id, 'land'), incoming.id).phase).toBe('approach');
    // A nearby aircraft needs its full separation buffer, not just the exact exit node.
    plane(state, 'GC202').position.y += 45;
    expect(getAircraftActions(state, incoming.id).find(action => action.type === 'land')?.blocked).toMatch(/exit.*GC202/i);
    plane(state, 'GC202').position.y -= 45;

    state = send(state, 'GC202', 'taxi');
    state = until(state, s => plane(s, 'GC202').phase === 'crossing-hold');
    expect(getAircraftActions(state, incoming.id).find(action => action.type === 'land')?.blocked).toBeNull();
    state = send(state, incoming.id, 'land');
    state = until(state, s => plane(s, incoming.id).phase === 'awaiting-taxi');
    expect(state.reservation).toBeNull();
    expect(getAircraftActions(state, 'GC202').find(action => action.type === 'cross')?.blocked).toBeNull();
  });
});


describe('expanded airport camera lifecycle', () => {
  it.each(['09', '36'] as const)('keeps departure %s until its full airframe clears the expanded view', runwayId => {
    const initial = createGroundState();
    initial.nextSpawn = Infinity;
    let state = send(initial, 'GC101', 'taxi', runwayId);
    if (runwayId === '36') {
      state = until(state, s => plane(s, 'GC101').phase === 'crossing-hold');
      state = send(state, 'GC101', 'cross');
    }
    state = until(state, s => plane(s, 'GC101').phase === 'holding');
    state = send(state, 'GC101', 'takeoff');
    expect(plane(state, 'GC101').phase).toBe('taking-off');
    let removed = false;
    for (let i = 0; i < 1200 && !removed; i++) {
      const before = plane(state, 'GC101');
      const next = step(state, 0.1);
      const after = next.aircraft.find(a => a.id === 'GC101');
      if (after) {
        expect(distance(before.position, after.position)).toBeLessThanOrEqual(7.50001);
        expect(next.operations.departures).toBe(0);
        expect(next.reservation?.owner).toBe(before.id);
      } else {
        if (runwayId === '09') expect(before.position.x - AIRCRAFT_RADIUS).toBeGreaterThan(GROUND_VIEW.x + GROUND_VIEW.width);
        else expect(before.position.y + AIRCRAFT_RADIUS).toBeLessThan(GROUND_VIEW.y);
        expect(next.operations.departures).toBe(1);
        expect(next.reservation).toBeNull();
        removed = true;
      }
      state = next;
    }
    expect(removed).toBe(true);
    expect(step(state, 2).operations.departures).toBe(1);
  });

  it.each(['09', '36'] as const)('keeps uncleared arrival %s visible through approach and its missed-approach circuit', runwayId => {
    const state = createGroundState();
    state.nextSpawn = Infinity;
    const arrival = plane(state, 'GC202');
    const runway = RUNWAYS[runwayId];
    arrival.runway = runwayId;
    arrival.nodeId = runway.approach;
    arrival.position = { ...NODES[runway.approach] };
    arrival.route = [runway.decision];
    let current = step(state, 45);
    expect(plane(current, arrival.id).phase).toBe('approach');
    expect(getAircraftActions(current, arrival.id).find(action => action.type === 'land')?.blocked).toBeNull();
    let observedCircuit = false;
    let observedReturn = false;
    for (let i = 0; i < 240; i++) {
      current = step(current, 0.25);
      const aircraft = plane(current, arrival.id);
      expect(aircraft).toBeDefined();
      expect(aircraft.position.x - AIRCRAFT_RADIUS).toBeGreaterThan(GROUND_VIEW.x);
      expect(aircraft.position.x + AIRCRAFT_RADIUS).toBeLessThan(GROUND_VIEW.x + GROUND_VIEW.width);
      expect(aircraft.position.y - AIRCRAFT_RADIUS).toBeGreaterThan(GROUND_VIEW.y);
      expect(aircraft.position.y + AIRCRAFT_RADIUS).toBeLessThan(GROUND_VIEW.y + GROUND_VIEW.height);
      observedCircuit ||= aircraft.phase === 'go-around';
      observedReturn ||= observedCircuit && aircraft.phase === 'approach';
      expect(current.operations.arrivals).toBe(0);
    }
    expect(observedCircuit).toBe(true);
    expect(observedReturn).toBe(true);
  });
});
