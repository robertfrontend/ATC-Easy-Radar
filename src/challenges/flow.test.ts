// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AIRPORTS } from '../config/airports';
import { Plane } from '../types';
import { makeDeparture, makePlane } from '../test/field';
import { CHALLENGE_PROGRESS_KEY, readChallengeProgress } from './model';

let spawnPlane: Plane | null;
vi.mock('./traffic', () => ({ spawnIntensityTraffic: (request: { lastDepartureAt: number }) => {
  const plane = spawnPlane; spawnPlane = null;
  return { plane, lastDepartureAt: request.lastDepartureAt };
} }));
vi.mock('../utils/audio', () => ({ audioManager: {
  playBlip: vi.fn(), playIlsCapture: vi.fn(), playWarning: vi.fn(), playSuccess: vi.fn(), playCrash: vi.fn(),
  playRadio: vi.fn(), setMuted: vi.fn(),
} }));
vi.mock('../components/RadarDisplay', () => ({ RadarDisplay: ({ planes, selectedId, onSelect }) => createElement('div', {},
  ...planes.map((plane: Plane) => createElement('button', { key: plane.id, onClick: () => onSelect(plane.id),
    'aria-pressed': selectedId === plane.id }, `Select ${plane.callsign}`))) }));
vi.mock('../components/ControlPanel', () => ({ ControlPanel: () => null }));
let root: Root, container: HTMLDivElement;
const airport = AIRPORTS[0];
function mount(path = '/challenges') {
  window.history.replaceState(null, '', path);
  act(() => root.render(createElement(App)));
}
function click(label: string) {
  const element = [...container.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button,a')]
    .find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label);
  expect(element, label).toBeDefined(); act(() => element!.click());
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const stored = () => readChallengeProgress(localStorage.getItem(CHALLENGE_PROGRESS_KEY));
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => window.setTimeout(fn, 16));
  localStorage.clear(); spawnPlane = null;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('airport → intensity level → full turn → persistent unlock', () => {
  it('offers 20 levels for every airport while retaining independent Home/free/Learning links', () => {
    mount('/'); click('Retos');
    for (const item of AIRPORTS) {
      const select = container.querySelector('select')!;
      act(() => { select.value = item.id; select.dispatchEvent(new Event('change', { bubbles: true })); });
      const levels = container.querySelectorAll<HTMLButtonElement>('[aria-label="Niveles de intensidad"] button');
      expect(levels).toHaveLength(20);
      expect(levels[0].disabled).toBe(false);
      expect([...levels].slice(1).every(level => level.disabled)).toBe(true);
      expect(container.textContent).toContain(`${item.icao} · Nivel 1`);
    }
    expect([...container.querySelectorAll('a')].map(link => link.getAttribute('href'))).toContain('/learning');
    click('Home / modo libre');
    expect(container.textContent).toContain('Jugar libre');
  });

  it('does not unlock on abandon, failure, direct locked URL or unattended timeout', () => {
    mount(`/game?mode=challenge&airport=${airport.id}&level=2`);
    expect(container.textContent).toContain('Nivel no disponible');
    expect(localStorage.getItem(CHALLENGE_PROGRESS_KEY)).toBeNull();
    click('Volver a Retos'); click('Iniciar nivel 1');
    click('MENU'); click('Exit');
    expect(stored().completed).toEqual({});
    click('Iniciar nivel 1');
    advance(300000);
    expect(container.textContent).toContain('Nivel no superado');
    expect(stored().completed).toEqual({});
    click('Repetir nivel');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(stored().completed).toEqual({});
  });

  it('waits five active minutes, persists completion, repeats safely and opens the next level', () => {
    localStorage.setItem('atc_learning_progress', 'learning-kept');
    localStorage.setItem('atc_saved_games', '[]');
    mount(); click('Iniciar nivel 1');
    spawnPlane = makeDeparture({ id: 'player-flight', callsign: 'TST123', x: airport.x, y: airport.y,
      heading: airport.runways[0].heading, targetHeading: airport.runways[0].heading,
      assignedRunwayId: airport.runways[0].id, exitWaypointId: airport.waypoints[0].id,
      altitude: 11000, targetAltitude: 11000 });
    advance(50); click('Select TST123');
    act(() => {
      const input = container.querySelector('input[type="text"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'DEP');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('input')!.disabled).toBe(true); // PR18 behavior retained.
    advance(299900);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(stored().completed).toEqual({});
    advance(50);
    expect(container.textContent).toContain('Nivel superado');
    expect(stored().completed[airport.id]).toBe(1);
    expect(localStorage.getItem('atc_learning_progress')).toBe('learning-kept');
    expect(localStorage.getItem('atc_saved_games')).toBe('[]');
    click('Siguiente nivel');
    expect(container.textContent).toContain('NIVEL 2/20');
    act(() => root.unmount()); root = createRoot(container); mount(`/challenges?airport=${airport.id}`);
    expect(container.textContent).toContain('1/20 completados');
    click('Nivel 1Completado'); click('Iniciar nivel 1');
    advance(300000);
    expect(container.textContent).toContain('Nivel no superado');
    expect(stored().completed[airport.id]).toBe(1);
  });

  it('never offers level21 when replaying an already completed level20', () => {
    localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify({ version: 1, completed: { [airport.id]: 20 } }));
    mount(`/game?mode=challenge&airport=${airport.id}&level=20`);
    expect(container.textContent).toContain('NIVEL 20/20');
    advance(300000);
    expect(container.textContent).not.toContain('Siguiente nivel');
    expect(stored().completed[airport.id]).toBe(20);
  });
});
