// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { useGameLoop } from '../hooks/useGameLoop';
import { makeDeparture, makePlane } from '../test/field';
import { challengeRunways } from './model';

vi.mock('../utils/audio', () => ({ audioManager: {
  playBlip: vi.fn(), playIlsCapture: vi.fn(), playWarning: vi.fn(), playSuccess: vi.fn(), playCrash: vi.fn(),
} }));
vi.mock('./traffic', () => ({ spawnIntensityTraffic: (request: { lastDepartureAt: number }) => ({
  plane: null, lastDepartureAt: request.lastDepartureAt,
}) }));
const airport = AIRPORTS[0];
let root: Root, container: HTMLDivElement, loop: ReturnType<typeof useGameLoop>;
let options: NonNullable<Parameters<typeof useGameLoop>[4]>;
function Harness() {
  // Challenge must enforce 1× and valid runways even if unrelated settings are passed.
  loop = useGameLoop(airport, {}, 'hard', 4, options);
  return null;
}
function mount(level = 1, count = 1) {
  options = { mode: 'challenge', level, initialPlanes: Array.from({ length: count }, (_, i) => makeDeparture({
    id: `exit-${i}`, markedForRemoval: true, x: airport.x + i * 300,
    y: airport.y + 200, altitude: 12000 + i * 2000, targetAltitude: 12000 + i * 2000,
  })) };
  act(() => root.render(createElement(Harness)));
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

describe('complete active-time challenge turns', () => {
  it('counts commanded operations but never finishes before five minutes; pause and menus freeze time', () => {
    mount();
    act(() => loop.updatePlaneTarget('exit-0', { targetSpeed: 240 }));
    advance(50);
    expect(loop.session.operations).toBe(1);
    expect(loop.hasEnded).toBe(false);
    expect(loop.effectiveDifficulty).toBe('easy');
    act(() => loop.setPaused(true));
    advance(300000);
    expect(loop.elapsedMs).toBe(50);
    act(() => loop.setPaused(false));
    options = { ...options, blocked: true };
    act(() => root.render(createElement(Harness)));
    advance(300000);
    expect(loop.elapsedMs).toBe(50);
    options = { ...options, blocked: false };
    act(() => root.render(createElement(Harness)));
    advance(299900);
    expect(loop.session.status).toBe('active');
    expect(loop.elapsedMs).toBe(299950);
    advance(50);
    expect(loop.session.status).toBe('completed');
    expect(loop.elapsedMs).toBe(300000);
    expect(loop.hasEnded).toBe(true);
    act(() => loop.restart([]));
    expect(loop.elapsedMs).toBe(0);
    expect(loop.session.operations).toBe(0);
    expect(loop.session.status).toBe('active');
  });
  it('fails an unattended turn even when the engine reports an automatic success', () => {
    mount();
    advance(300000);
    expect(loop.score).toBe(1);
    expect(loop.session.operations).toBe(0);
    expect(loop.session.status).toBe('failed');
  });
  it('level 20 requires four effective operations and remains a full timed turn', () => {
    mount(20, 4);
    act(() => { for (let i = 0; i < 4; i++) loop.updatePlaneTarget(`exit-${i}`, { targetSpeed: 240 }); });
    advance(50);
    expect(loop.session.operations).toBe(4);
    expect(loop.session.status).toBe('active');
    advance(299950);
    expect(loop.session.status).toBe('completed');
  });
  it('fails on an accident and keeps the fixed runway setup available', () => {
    options = { mode: 'challenge', level: 1, initialPlanes: [makePlane({ x: airport.x, y: airport.y, altitude: 15000 }),
      makePlane({ id: 'collision', x: airport.x, y: airport.y, altitude: 15000 })] };
    act(() => root.render(createElement(Harness)));
    advance(50);
    expect(loop.session.status).toBe('failed');
    expect(loop.hasEnded).toBe(true);
    expect(Object.values(challengeRunways(airport)).some(value => value.landing && value.departure)).toBe(true);
  });
});
