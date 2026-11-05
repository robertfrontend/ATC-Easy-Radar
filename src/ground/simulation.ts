import { AIRCRAFT_RADIUS, NODES, RUNWAYS, STANDS, crossingBetween, distance, findRoute } from './airport';
import type { Aircraft, AircraftAction, GroundAlert, GroundCommand, GroundState, Phase, Point, RunwayId } from './model';

export const SHIFT_SECONDS = 480;
export const WAIT_ALLOWANCE = 30;
export const FIXED_STEP = 1 / 30;
const TAXI_SPEED = 28;
const SEPARATION = AIRCRAFT_RADIUS * 2 + 8;
const waitingPhases: Phase[] = ['parked', 'holding', 'crossing-hold', 'awaiting-taxi', 'stopped', 'approach'];

function makeAircraft(id: string, kind: Aircraft['kind'], runway: RunwayId, standId: string | null): Aircraft {
  const nodeId = kind === 'departure' ? standId! : RUNWAYS[runway].approach;
  return {
    id, kind, runway, standId, phase: kind === 'departure' ? 'parked' : 'approach',
    position: { ...NODES[nodeId] }, heading: kind === 'departure' || runway === '36' ? -90 : 0,
    destination: kind === 'departure' ? 'Awaiting runway assignment' : `Runway ${runway}`,
    nodeId, route: kind === 'arrival' ? [RUNWAYS[runway].decision] : [], routeIndex: 0,
    waiting: 0, delay: 0, age: 0, goArounds: 0,
    arrivalCounted: false, departureCounted: false, blocked: null, resumePhase: 'taxiing',
  };
}
export function createGroundState(): GroundState {
  return {
    aircraft: [makeAircraft('GC101', 'departure', '09', 'stand-1'), makeAircraft('GC202', 'arrival', '09', null)],
    elapsed: 0, accumulator: 0, paused: false, speed: 1, shift: 'open',
    reservation: null, taxiOwner: null, operations: { arrivals: 0, departures: 0 },
    totalDelay: 0, nextSpawn: 40, nextId: 303,
    message: 'Welcome to Willow Field. Select GC101 to taxi or GC202 to clear a landing.',
  };
}
function transition(aircraft: Aircraft, phase: Phase) {
  const approachWait = ['approach', 'go-around'].includes(aircraft.phase) && ['approach', 'go-around'].includes(phase);
  aircraft.phase = phase;
  if (!approachWait) aircraft.waiting = 0;
  aircraft.blocked = null;
}
function setRoute(aircraft: Aircraft, route: string[]) {
  aircraft.route = route;
  aircraft.routeIndex = 0;
}
function freeStand(state: GroundState): string | null {
  return STANDS.find(stand => !state.aircraft.some(a => a.standId === stand)) ?? null;
}
export function runwayOccupancy(state: GroundState): Record<RunwayId, string[]> {
  const result: Record<RunwayId, string[]> = { '09': [], '36': [] };
  for (const aircraft of state.aircraft) {
    if (['approach', 'go-around'].includes(aircraft.phase)) continue;
    for (const id of ['09', '36'] as const) {
      const { start, end } = RUNWAYS[id];
      const p = aircraft.position;
      const along = id === '09' ? p.x : p.y;
      const across = id === '09' ? Math.abs(p.y - start.y) : Math.abs(p.x - start.x);
      const min = id === '09' ? Math.min(start.x, end.x) : Math.min(start.y, end.y);
      const max = id === '09' ? Math.max(start.x, end.x) : Math.max(start.y, end.y);
      if (across <= 22 + AIRCRAFT_RADIUS && along >= min - AIRCRAFT_RADIUS && along <= max + AIRCRAFT_RADIUS) result[id].push(aircraft.id);
    }
  }
  return result;
}
function runwayBlock(state: GroundState, id: string): string | null {
  if (state.reservation && state.reservation.owner !== id) {
    return `Shared runway intersection reserved by ${state.reservation.owner} (${state.reservation.operation}).`;
  }
  const occupied = Object.values(runwayOccupancy(state)).flat().find(other => other !== id);
  return occupied ? `Runway or shared intersection occupied by ${occupied}.` : null;
}
function nextCrossing(aircraft: Aircraft): RunwayId | undefined {
  return crossingBetween(aircraft.nodeId, aircraft.route[aircraft.routeIndex]);
}
export function getAircraftActions(state: GroundState, id: string): AircraftAction[] {
  const aircraft = state.aircraft.find(a => a.id === id);
  if (!aircraft) return [];
  const actions: AircraftAction[] = [];
  const runwayReason = runwayBlock(state, id);
  if (aircraft.phase === 'parked') {
    for (const runway of ['09', '36'] as const) {
      const hold = RUNWAYS[runway].hold;
      const occupied = state.aircraft.some(a => a.id !== id && a.phase === 'holding' && a.nodeId === hold);
      actions.push({ type: 'taxi', runway, label: `Taxi to runway ${runway}`, blocked: occupied ? `Runway ${runway} holding point occupied. Wait for departure.` : null });
    }
  }
  if (aircraft.phase === 'awaiting-taxi') actions.push({ type: 'taxi', label: `Taxi to ${aircraft.standId?.replace('-', ' ')}`, blocked: null });
  if (aircraft.phase === 'taxiing' || aircraft.phase === 'crossing-hold') actions.push({ type: 'stop', label: 'Stop taxi', blocked: null });
  if (aircraft.phase === 'stopped') actions.push({ type: 'resume', label: 'Resume taxi', blocked: null });
  if (aircraft.phase === 'holding') actions.push({ type: 'takeoff', label: `Clear takeoff ${aircraft.runway}`, blocked: runwayReason });
  if (aircraft.phase === 'approach') {
    const exit = NODES[RUNWAYS[aircraft.runway].exit];
    const exitTraffic = state.aircraft.find(other => other.id !== id && groundAircraft(other) && distance(other.position, exit) < SEPARATION);
    const exitReason = exitTraffic ? `Runway exit occupied by ${exitTraffic.id}. Clear its taxi route before landing.` : null;
    actions.push({
      type: 'land', label: `Clear landing ${aircraft.runway}`,
      blocked: runwayReason ?? exitReason ?? (!freeStand(state) ? 'No free stand. Arrival will fly a visible circuit.' : null),
    });
  }
  if (aircraft.phase === 'crossing-hold') actions.push({ type: 'cross', label: `Cross runway ${nextCrossing(aircraft)}`, blocked: runwayReason });
  return actions.map(action => ({ ...action, blocked: state.paused ? 'Simulation paused. Resume before issuing clearances.' : action.blocked }));
}
export function commandGround(current: GroundState, command: GroundCommand): GroundState {
  if (command.type === 'restart') return createGroundState();
  const state = structuredClone(current);
  if (command.type === 'pause') {
    state.paused = !state.paused;
    return state;
  }
  if (command.type === 'speed') {
    state.speed = command.speed;
    return state;
  }
  const aircraft = state.aircraft.find(a => a.id === command.id);
  const action = getAircraftActions(state, command.id).find(a => a.type === command.type && a.runway === command.runway);
  if (!aircraft || !action || action.blocked) {
    state.message = action?.blocked ?? 'Command unavailable in the current state. Taxi to a runway hold before takeoff.';
    return state;
  }
  if (command.type === 'taxi') {
    if (aircraft.kind === 'departure') {
      aircraft.runway = command.runway!;
      aircraft.destination = `Runway ${aircraft.runway} holding point`;
    } else aircraft.destination = aircraft.standId!.replace('-', ' ');
    const target = aircraft.kind === 'departure' ? RUNWAYS[aircraft.runway].hold : aircraft.standId!;
    setRoute(aircraft, findRoute(aircraft.nodeId, target).slice(1));
    transition(aircraft, 'taxiing');
  } else if (command.type === 'stop') {
    aircraft.resumePhase = aircraft.phase as 'taxiing' | 'crossing-hold';
    transition(aircraft, 'stopped');
  } else if (command.type === 'resume') transition(aircraft, aircraft.resumePhase);
  else if (command.type === 'cross') {
    state.reservation = { owner: aircraft.id, runway: nextCrossing(aircraft)!, operation: 'cross' };
    transition(aircraft, 'crossing');
  } else if (command.type === 'takeoff') {
    state.reservation = { owner: aircraft.id, runway: aircraft.runway, operation: 'takeoff' };
    const runway = RUNWAYS[aircraft.runway];
    setRoute(aircraft, [runway.threshold, `end-${aircraft.runway}`, runway.departure]);
    transition(aircraft, 'taking-off');
    aircraft.destination = `Departure runway ${aircraft.runway}`;
  } else if (command.type === 'land') {
    state.reservation = { owner: aircraft.id, runway: aircraft.runway, operation: 'land' };
    aircraft.standId = freeStand(state);
    const runway = RUNWAYS[aircraft.runway];
    setRoute(aircraft, [runway.threshold, runway.rollout, runway.exit]);
    transition(aircraft, 'landing');
    aircraft.destination = `${aircraft.standId!.replace('-', ' ')} via runway ${aircraft.runway}`;
  }
  state.message = `${aircraft.id}: ${action.label}.`;
  return state;
}
function releaseRunway(state: GroundState, aircraft: Aircraft) {
  if (state.reservation?.owner === aircraft.id) state.reservation = null;
}
function releaseTaxi(state: GroundState, aircraft: Aircraft) {
  if (state.taxiOwner === aircraft.id) state.taxiOwner = null;
}
function groundAircraft(aircraft: Aircraft) {
  return !['approach', 'go-around'].includes(aircraft.phase);
}
function move(aircraft: Aircraft, target: Point, speed: number, dt: number, state: GroundState): boolean {
  const length = distance(aircraft.position, target);
  const travel = Math.min(length, speed * dt);
  const next = length === 0 ? { ...target } : {
    x: aircraft.position.x + (target.x - aircraft.position.x) / length * travel,
    y: aircraft.position.y + (target.y - aircraft.position.y) / length * travel,
  };
  if (groundAircraft(aircraft)) {
    const blocker = state.aircraft.find(other => other.id !== aircraft.id && groundAircraft(other) && distance(next, other.position) < SEPARATION);
    if (blocker) {
      aircraft.blocked = `Holding separation from ${blocker.id}.`;
      return false;
    }
  }
  aircraft.blocked = null;
  if (length > 0.001) {
    const desired = Math.atan2(target.y - aircraft.position.y, target.x - aircraft.position.x) * 180 / Math.PI;
    const angle = (desired - aircraft.heading + 540) % 360 - 180;
    aircraft.heading += Math.max(-180 * dt, Math.min(180 * dt, angle));
  }
  aircraft.position = next;
  return length <= travel + 0.00001;
}
function finishWaypoint(state: GroundState, aircraft: Aircraft) {
  aircraft.nodeId = aircraft.route[aircraft.routeIndex];
  aircraft.routeIndex++;
  if (aircraft.phase === 'landing' && aircraft.nodeId === RUNWAYS[aircraft.runway].rollout) transition(aircraft, 'exiting');
  if (aircraft.phase === 'crossing') {
    releaseRunway(state, aircraft);
    transition(aircraft, 'taxiing');
  }
  if (aircraft.routeIndex < aircraft.route.length) return;
  if (aircraft.phase === 'approach') {
    aircraft.goArounds++;
    transition(aircraft, 'go-around');
    setRoute(aircraft, RUNWAYS[aircraft.runway].circuit);
    state.message = `${aircraft.id}: go-around. No landing clearance; flying the marked circuit.`;
  } else if (aircraft.phase === 'go-around') {
    transition(aircraft, 'approach');
    setRoute(aircraft, [RUNWAYS[aircraft.runway].decision]);
  } else if (aircraft.phase === 'taking-off') {
    if (!aircraft.departureCounted) {
      aircraft.departureCounted = true;
      state.operations.departures++;
    }
    releaseRunway(state, aircraft);
    state.aircraft = state.aircraft.filter(a => a.id !== aircraft.id);
    state.message = `${aircraft.id}: departure complete.`;
  } else if (aircraft.phase === 'exiting') {
    releaseRunway(state, aircraft);
    transition(aircraft, 'awaiting-taxi');
    setRoute(aircraft, []);
    state.message = `${aircraft.id}: runway vacated. Awaiting taxi clearance to ${aircraft.standId?.replace('-', ' ')}.`;
  } else if (aircraft.phase === 'taxiing') {
    releaseTaxi(state, aircraft);
    if (aircraft.kind === 'departure') transition(aircraft, 'holding');
    else {
      if (!aircraft.arrivalCounted) {
        aircraft.arrivalCounted = true;
        state.operations.arrivals++;
      }
      transition(aircraft, 'turnaround');
      aircraft.destination = 'Stand reached · arrival complete';
      state.message = `${aircraft.id}: arrival complete. Stand turnaround in 25 seconds.`;
    }
    setRoute(aircraft, []);
  }
}
/** Slow on the paved landing rollout, reaching exit speed before the turn. */
function movementSpeed(aircraft: Aircraft): number {
  switch (aircraft.phase) {
    case 'approach': return 5;
    case 'go-around': return 32;
    case 'taking-off': return 75;
    case 'exiting': return 20;
    case 'landing': {
      const runway = RUNWAYS[aircraft.runway];
      if (aircraft.route[aircraft.routeIndex] !== runway.rollout) return 55;
      const length = distance(NODES[runway.threshold], NODES[runway.rollout]);
      const remaining = distance(aircraft.position, NODES[runway.rollout]);
      return 20 + 35 * Math.min(1, remaining / length);
    }
    default: return TAXI_SPEED;
  }
}
function tickAircraft(state: GroundState, aircraft: Aircraft, dt: number) {
  aircraft.age += dt;
  if (aircraft.phase === 'turnaround') {
    aircraft.waiting += dt;
    if (aircraft.waiting >= 25 && state.shift === 'open') {
      aircraft.kind = 'departure';
      transition(aircraft, 'parked');
      aircraft.destination = 'Turnaround complete · awaiting runway assignment';
    }
    return;
  }
  const queued = aircraft.phase === 'taxiing' && state.taxiOwner && state.taxiOwner !== aircraft.id;
  const delayed = waitingPhases.includes(aircraft.phase) || queued || aircraft.phase === 'go-around' || aircraft.blocked;
  if (delayed) {
    aircraft.waiting += dt;
    if (aircraft.waiting > WAIT_ALLOWANCE) {
      aircraft.delay += dt;
      state.totalDelay += dt;
    }
  } else aircraft.waiting = 0;
  if (['parked', 'holding', 'crossing-hold', 'stopped', 'awaiting-taxi'].includes(aircraft.phase)) return;
  if (aircraft.phase === 'taxiing' || aircraft.phase === 'crossing') {
    if (state.taxiOwner && state.taxiOwner !== aircraft.id) {
      aircraft.blocked = `Taxi corridor queued behind ${state.taxiOwner}.`;
      return;
    }
    state.taxiOwner = aircraft.id;
    if (aircraft.phase === 'taxiing' && nextCrossing(aircraft)) {
      transition(aircraft, 'crossing-hold');
      state.message = `${aircraft.id}: holding short of runway ${nextCrossing(aircraft)}. Separate crossing clearance required.`;
      return;
    }
  }
  const target = NODES[aircraft.route[aircraft.routeIndex]];
  if (!target) return;
  const speed = movementSpeed(aircraft);
  const reached = move(aircraft, target, speed, dt, state);
  // A taxi clearance does not vacate a stand: keep it reserved until physically clear.
  if (aircraft.kind === 'departure' && aircraft.standId && distance(aircraft.position, NODES[aircraft.standId]) > SEPARATION) aircraft.standId = null;
  if (reached) finishWaypoint(state, aircraft);
}
function spawnTraffic(state: GroundState) {
  if (state.shift !== 'open' || state.elapsed < state.nextSpawn) return;
  const interval = Math.max(22, 52 - state.elapsed / 16);
  state.nextSpawn += interval;
  if (state.aircraft.length >= 6) return;
  const number = state.nextId;
  const airborne = state.aircraft.some(a => ['approach', 'go-around', 'landing', 'exiting'].includes(a.phase));
  const stand = freeStand(state);
  const kind = number % 2 === 1 && !airborne ? 'arrival' : 'departure';
  if (kind === 'departure' && (!stand || state.aircraft.some(a => distance(a.position, NODES[stand]) < SEPARATION))) return;
  if (kind === 'arrival' && airborne) return;
  state.nextId++;
  const runway = number % 3 === 0 ? '36' : '09';
  state.aircraft.push(makeAircraft(`GC${number}`, kind, runway, kind === 'departure' ? stand : null));
}
function tick(state: GroundState, dt: number) {
  state.elapsed += dt;
  if (state.elapsed >= SHIFT_SECONDS) state.shift = 'closing';
  for (const aircraft of [...state.aircraft]) tickAircraft(state, aircraft, dt);
  spawnTraffic(state);
  if (state.shift === 'closing' && state.aircraft.every(a => a.phase === 'turnaround')) {
    state.shift = 'complete';
    state.message = 'Shift complete. All pending traffic has been resolved.';
  }
}
/** Fixed-step integration keeps routing, spawning, delays and score independent of rendering. */
export function advanceGround(current: GroundState, realSeconds: number): GroundState {
  if (current.paused || current.shift === 'complete' || !Number.isFinite(realSeconds) || realSeconds <= 0) return current;
  const state = structuredClone(current);
  state.accumulator += realSeconds * state.speed;
  while (state.accumulator + 1e-9 >= FIXED_STEP && state.shift !== 'complete') {
    state.accumulator -= FIXED_STEP;
    tick(state, FIXED_STEP);
  }
  if (Math.abs(state.accumulator) < 1e-9) state.accumulator = 0;
  return state;
}
export function getGroundAlerts(state: GroundState): GroundAlert[] {
  const alerts: GroundAlert[] = [];
  if (state.shift === 'closing') alerts.push({ id: 'closing', severity: 'info', message: 'Shift closing: no new flights. Clear every pending flight to finish.' });
  if (state.reservation) alerts.push({ id: 'reservation', severity: 'info', message: `Runway ${state.reservation.runway} and shared intersection reserved by ${state.reservation.owner}.` });
  for (const aircraft of state.aircraft) {
    if (aircraft.phase === 'go-around') alerts.push({ id: `${aircraft.id}-circuit`, severity: 'warning', message: `${aircraft.id}: go-around; wait for approach to issue landing clearance.` });
    if (aircraft.phase === 'crossing-hold') alerts.push({ id: `${aircraft.id}-cross`, severity: 'warning', message: `${aircraft.id}: holding short of runway ${nextCrossing(aircraft)}. Crossing clearance required.` });
    if (aircraft.blocked) alerts.push({ id: `${aircraft.id}-blocked`, severity: 'info', message: `${aircraft.id}: ${aircraft.blocked}` });
  }
  for (let i = 0; i < state.aircraft.length; i++) for (let j = i + 1; j < state.aircraft.length; j++) {
    const a = state.aircraft[i], b = state.aircraft[j];
    if (groundAircraft(a) && groundAircraft(b) && distance(a.position, b.position) < SEPARATION + 5) {
      alerts.push({ id: `${a.id}-${b.id}`, severity: 'warning', message: `Separation caution: ${a.id} / ${b.id}. Surface movement protected.` });
    }
  }
  return alerts;
}
