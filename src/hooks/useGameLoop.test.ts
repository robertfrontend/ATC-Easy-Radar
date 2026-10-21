// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { Difficulty, GameSpeed, Plane, RunwayConfig } from '../types';
import { isRunwaySafeForDeparture } from '../utils/departure';
import * as spawn from '../utils/spawn';
import { createTutorialScenario } from '../utils/tutorial';
import { SHIFT_DURATION_MS, useGameLoop } from './useGameLoop';

vi.mock('../utils/audio', () => ({
  audioManager: {
    playBlip: vi.fn(),
    playIlsCapture: vi.fn(),
    playWarning: vi.fn(),
    playSuccess: vi.fn(),
    playCrash: vi.fn(),
  },
}));

type Loop = ReturnType<typeof useGameLoop>;
type Options = NonNullable<Parameters<typeof useGameLoop>[4]>;

let root: Root;
let container: HTMLDivElement;
let loop: Loop;
let props: {
  options: Options;
  runwayConfig: RunwayConfig;
  difficulty: Difficulty;
  gameSpeed: GameSpeed;
};

function Harness() {
  loop = useGameLoop(field, props.runwayConfig, props.difficulty, props.gameSpeed, props.options);
  return null;
}

function mount(options: Options = {}, runwayConfig = fieldRunways, difficulty: Difficulty = 'easy') {
  props = { options, runwayConfig, difficulty, gameSpeed: 1 };
  act(() => root.render(createElement(Harness)));
}

function updateOptions(updates: Partial<Options>) {
  props = { ...props, options: { ...props.options, ...updates } };
  act(() => root.render(createElement(Harness)));
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

function preventRandomTraffic() {
  return vi.spyOn(spawn, 'spawnAircraft').mockImplementation(request => ({
    plane: null,
    lastDepartureAt: request.lastDepartureAt,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('active simulation time', () => {
  it('freezes instruction/menu time separately from the user’s manual pause', () => {
    const scenario = createTutorialScenario(field);
    mount({ mode: 'tutorial', initialPlanes: scenario.planes }, scenario.runwayConfig);
    advance(100);
    expect(loop.elapsedMs).toBe(100);
    const position = { x: loop.planes[0].x, y: loop.planes[0].y };

    updateOptions({ blocked: true });
    advance(10000);
    expect(loop.elapsedMs).toBe(100);
    expect(loop.planes[0]).toMatchObject(position);
    expect(loop.isPaused).toBe(false);

    act(() => loop.togglePause());
    expect(loop.isPaused).toBe(true);
    updateOptions({ blocked: false });
    advance(10000);
    expect(loop.elapsedMs).toBe(100);
    expect(loop.isPaused).toBe(true);

    act(() => loop.togglePause());
    advance(50);
    expect(loop.elapsedMs).toBe(150);
    expect(loop.planes[0].y).not.toBe(position.y);
  });

  for (const pauseKind of ['manual', 'menu'] as const) {
    it(`does not create a spawn burst after a long ${pauseKind} pause`, () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
      const spawning = vi.spyOn(spawn, 'spawnAircraft');
      mount();
      advance(50);
      expect(loop.planes).toHaveLength(1);
      expect(spawning).toHaveBeenCalledTimes(1);

      if (pauseKind === 'manual') act(() => loop.setPaused(true));
      else updateOptions({ blocked: true });
      advance(180000);
      expect(loop.elapsedMs).toBe(50);
      expect(spawning).toHaveBeenCalledTimes(1);

      if (pauseKind === 'manual') act(() => loop.setPaused(false));
      else updateOptions({ blocked: false });
      advance(50);
      expect(loop.elapsedMs).toBe(100);
      expect(loop.planes).toHaveLength(1);
      expect(spawning).toHaveBeenCalledTimes(1);
      advance(3950);
      expect(spawning).toHaveBeenCalledTimes(1);
      advance(50);
      expect(spawning).toHaveBeenCalledTimes(2);
    });
  }

  it('ends a timed shift at five active minutes and does not tick afterward', () => {
    preventRandomTraffic();
    mount({ mode: 'shift', goal: 10 });
    advance(SHIFT_DURATION_MS - 50);
    expect(loop.hasEnded).toBe(false);
    expect(loop.session.status).toBe('active');
    advance(50);
    expect(loop.hasEnded).toBe(true);
    expect(loop.elapsedMs).toBe(SHIFT_DURATION_MS);
    advance(60000);
    expect(loop.elapsedMs).toBe(SHIFT_DURATION_MS);
  });

  it('does not overrun a shift when several timer callbacks arrive in one render batch', () => {
    preventRandomTraffic();
    mount({ mode: 'shift' });
    advance(SHIFT_DURATION_MS + 5000);
    expect(loop.hasEnded).toBe(true);
    expect(loop.elapsedMs).toBe(SHIFT_DURATION_MS);
  });
});

describe('real engine events and session completion', () => {
  it('records a missed operation only after a corner departure crosses a square edge', () => {
    preventRandomTraffic();
    const corner = makeDeparture({
      id: 'corner-departure',
      x: field.x + 599,
      y: field.y + 599,
      heading: 90,
      targetHeading: 90,
      headingAssigned: true,
      altitude: 8000,
      targetAltitude: 8000,
      speed: 240,
      targetSpeed: 240,
    });
    mount({ mode: 'shift', initialPlanes: [corner] });
    advance(50);
    expect(loop.planes.map(plane => plane.id)).toEqual(['corner-departure']);
    expect(loop.events.some(event => event.kind === 'missed')).toBe(false);
    advance(100);
    expect(loop.planes).toEqual([]);
    expect(loop.events.filter(event => event.kind === 'missed')).toHaveLength(1);
    expect(loop.events.some(event => event.kind === 'success')).toBe(false);
    expect(loop.score).toBe(0);
    expect(loop.session.operations).toBe(0);
    expect(loop.accidents).toBe(0);
    advance(100);
    expect(loop.events.filter(event => event.kind === 'missed')).toHaveLength(1);
  });

  it('scores a safe handoff once, completes its goal, and freezes the remaining traffic', () => {
    preventRandomTraffic();
    const completedDeparture = makeDeparture({
      id: 'safe-exit',
      x: 900,
      y: 500,
      altitude: 11000,
      targetAltitude: 11000,
      targetWaypoint: 'east',
    });
    const other = makePlane({ id: 'other', x: 100, y: 100, altitude: 20000, targetAltitude: 20000 });
    mount({ mode: 'shift', goal: 1, initialPlanes: [completedDeparture, other] });
    advance(50);

    expect(loop.score).toBe(1);
    expect(loop.session).toMatchObject({ status: 'completed', operations: 1, points: 100, bestStreak: 1 });
    expect(loop.hasEnded).toBe(true);
    expect(loop.events.filter(event => event.kind === 'success')).toHaveLength(1);
    expect(loop.planes.map(plane => plane.id)).toEqual(['other']);
    const stopped = structuredClone(loop.planes);
    advance(10000);
    expect(loop.planes).toEqual(stopped);
    expect(loop.score).toBe(1);
    expect(loop.elapsedMs).toBe(50);
  });

  it('ends a shift on a live collision, records useful context, and does not score wreckage', () => {
    preventRandomTraffic();
    const a = makePlane({ id: 'a', callsign: 'TST101', x: 100, y: 100, heading: 90, targetHeading: 90, altitude: 4000, targetAltitude: 4000 });
    const b = makePlane({ id: 'b', callsign: 'TST202', x: 105, y: 100, heading: 90, targetHeading: 90, altitude: 4000, targetAltitude: 4000 });
    mount({ mode: 'shift', initialPlanes: [a, b] });
    act(() => loop.updatePlaneTarget('a', { targetAltitude: 5000 }));
    advance(50);

    expect(loop.hasEnded).toBe(true);
    expect(loop.session.status).toBe('failed');
    expect(loop.accidents).toBe(1);
    expect(loop.score).toBe(0);
    expect(loop.planes).toEqual([]);
    expect(loop.events.some(event => event.kind === 'accident' && event.advice.includes('5000 ft'))).toBe(true);
    expect(loop.events.some(event => event.kind === 'success')).toBe(false);
    const stopped = structuredClone(loop.events);
    advance(10000);
    expect(loop.events).toEqual(stopped);
    expect(loop.elapsedMs).toBe(50);
  });

  it('ends a shift on an unstable arrival instead of counting it as a successful landing', () => {
    preventRandomTraffic();
    const unstable = makePlane({ heading: 90, targetHeading: 90, altitude: 1000, targetAltitude: 1000, speed: 300, targetSpeed: 300 });
    mount({ mode: 'shift', initialPlanes: [unstable] });
    advance(50);
    expect(loop.hasEnded).toBe(true);
    expect(loop.session.status).toBe('failed');
    expect(loop.accidents).toBe(1);
    expect(loop.score).toBe(0);
    expect(loop.events.some(event => event.message.includes('unstable arrival'))).toBe(true);
  });

  it('stops batched callbacks on the exact tick that resolves the objective', () => {
    preventRandomTraffic();
    mount({
      mode: 'shift',
      goal: 1,
      initialPlanes: [makeDeparture({ x: 900, y: 500, altitude: 11000, targetAltitude: 11000, targetWaypoint: 'east' })],
    });
    advance(5000);
    expect(loop.session.status).toBe('completed');
    expect(loop.elapsedMs).toBe(50);
    expect(loop.score).toBe(1);
  });

  it('records a continuing warning as one episode, not a penalty on every tick', () => {
    preventRandomTraffic();
    const planes = [0, 40].map((offset, index) => makePlane({
      id: `warning-${index}`,
      x: 100 + offset,
      y: 100,
      altitude: 4000,
      targetAltitude: 4000,
    }));
    mount({ mode: 'shift', initialPlanes: planes });
    advance(500);
    expect(loop.session.status).toBe('active');
    expect(loop.session.warningEpisodes).toBe(1);
    expect(loop.events.filter(event => event.kind === 'warning')).toHaveLength(1);
  });
});

describe('clean restart and controlled training traffic', () => {
  it('distinguishes an unused runway from a real departure at simulation timestamp zero', () => {
    const unused = {
      airport: field,
      runway: field.runways[0],
      runwayConfig: fieldRunways,
      planes: [],
      now: 0,
      gameSpeed: 1 as const,
      lastDepartureByRunway: {},
      lastDepartureAt: -Infinity,
    };
    expect(isRunwaySafeForDeparture(unused)).toBe(true);
    const usedAtZero = {
      ...unused,
      lastDepartureByRunway: { 'rwy-36': 0 },
      lastDepartureAt: 0,
    };
    // Global spacing has elapsed at 15s, but this runway still needs 20s.
    expect(isRunwaySafeForDeparture({ ...usedAtZero, now: 15000 })).toBe(false);
    expect(isRunwaySafeForDeparture({ ...usedAtZero, now: 20000 })).toBe(true);
  });

  it('resets traffic, elapsed time, pause, and all departure spawn cooldowns', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    const spawning = vi.spyOn(spawn, 'spawnAircraft');
    mount();
    advance(1000);
    expect(loop.planes).toHaveLength(1);
    expect(loop.planes[0].type).toBe('departure');
    expect(spawning).toHaveBeenCalledTimes(1);
    act(() => loop.setPaused(true));
    act(() => loop.restart());
    expect(loop.planes).toEqual([]);
    expect(loop.elapsedMs).toBe(0);
    expect(loop.isPaused).toBe(false);
    expect(loop.events).toEqual([]);
    expect(loop.session).toMatchObject({ status: 'active', operations: 0, points: 0, resolvedIds: [] });

    advance(50);
    expect(spawning).toHaveBeenCalledTimes(2);
    expect(loop.planes).toHaveLength(1);
    expect(loop.planes[0].type).toBe('departure');
    expect(spawning.mock.calls[1][0]).toMatchObject({ now: 50, lastDepartureAt: -100000 });
  });

  it('clears a failed session and restarts with a fresh, independently cloned scenario', () => {
    preventRandomTraffic();
    const bad = makePlane({ heading: 90, targetHeading: 90, altitude: 1000, targetAltitude: 1000, speed: 300, targetSpeed: 300 });
    mount({ mode: 'shift', initialPlanes: [bad] });
    advance(50);
    expect(loop.session.status).toBe('failed');
    const replacement: Plane[] = [makePlane({ id: 'fresh', x: 100, y: 100 })];
    act(() => loop.restart(replacement));
    expect(loop.hasEnded).toBe(false);
    expect(loop.accidents).toBe(0);
    expect(loop.events).toEqual([]);
    expect(loop.elapsedMs).toBe(0);
    expect(loop.planes).toEqual(replacement);
    expect(loop.planes[0]).not.toBe(replacement[0]);
    expect(loop.planes[0].trail).not.toBe(replacement[0].trail);
    advance(50);
    expect(loop.elapsedMs).toBe(50);
    expect(loop.session.status).toBe('active');
    expect(replacement[0].trail).toEqual([]);
  });

  it('never adds random traffic to a tutorial and restarts from the original practice state', () => {
    const spawning = vi.spyOn(spawn, 'spawnAircraft');
    const scenario = createTutorialScenario(field);
    mount({ mode: 'tutorial', initialPlanes: scenario.planes }, scenario.runwayConfig);
    act(() => loop.updatePlaneTarget(scenario.primaryPlaneId, { targetHeading: 0, targetAltitude: 3000, targetSpeed: 180 }));
    advance(20000);
    expect(spawning).not.toHaveBeenCalled();
    expect(loop.planes.map(plane => plane.id)).toEqual([scenario.primaryPlaneId]);
    expect(loop.planes[0].altitude).toBeLessThan(11000);

    act(() => loop.restart());
    expect(loop.planes).toEqual(scenario.planes);
    expect(loop.elapsedMs).toBe(0);
    expect(loop.score).toBe(0);
    expect(loop.events).toEqual([]);
    expect(scenario.planes[0]).toMatchObject({ altitude: 11000, targetHeading: 60 });
    expect(scenario.planes[0].trail).toEqual([]);
  });
});
