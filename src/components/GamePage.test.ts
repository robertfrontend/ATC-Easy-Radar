// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { field, fieldRunways, makeDeparture, makePlane } from '../test/field';
import { Plane, SavedGame } from '../types';
import { audioManager } from '../utils/audio';
import * as spawn from '../utils/spawn';
import { GamePage } from './GamePage';
import { AIRPORTS } from '../config/airports';
import type { GeographicAirport } from '../geography/types';
import { RadarDomain } from '../utils/radarBounds';

let measured = true;
let reportAspect: ((aspect: number) => void) | undefined;
let capturedDomain: RadarDomain | undefined;
let capturedAirport: GeographicAirport | undefined;
let capturedControl: { gameSpeed?: unknown; showVectors?: boolean; showExtendedCenterlines?: boolean };

// Retain the real game loop, command parser, tutorial progression, and session
// UI. Only replace the visual radar/strip so these tests need no canvas or GPU.
vi.mock('./RadarDisplay', () => ({
  DEFAULT_SPAN: 1400,
  RadarDisplay: ({ airport, planes, onSelect, selectedId, domain, onViewportAspect }: { airport: GeographicAirport; planes: Plane[]; onSelect: (id: string) => void; selectedId: string | null; domain?: RadarDomain; onViewportAspect?: (aspect: number) => void }) => {
    capturedDomain = domain;
    capturedAirport = airport;
    reportAspect = onViewportAspect;
    useEffect(() => { if (measured) onViewportAspect?.(1); }, [onViewportAspect]);
    return createElement('div', { 'data-testid': 'radar' },
      ...planes.map(plane => createElement('button', {
        key: plane.id,
        type: 'button',
        onClick: () => onSelect(plane.id),
        'data-plane-id': plane.id,
        'data-plane': JSON.stringify(plane),
        'aria-pressed': selectedId === plane.id,
      }, `Select ${plane.callsign}`)));
  },
}));

vi.mock('./ControlPanel', () => ({
  ControlPanel: (props: { plane: Plane | null; gameSpeed?: unknown; showVectors?: boolean; showExtendedCenterlines?: boolean }) => {
    capturedControl = props;
    return createElement('div', { 'data-testid': 'strip' }, props.plane ? `Flight strip: ${props.plane.callsign}` : 'No selected aircraft');
  },
}));

vi.mock('../utils/audio', () => ({
  audioManager: {
    playBlip: vi.fn(),
    playIlsCapture: vi.fn(),
    playWarning: vi.fn(),
    playSuccess: vi.fn(),
    playCrash: vi.fn(),
    playRadio: vi.fn(),
    setMuted: vi.fn(),
  },
}));

let root: Root;
let container: HTMLDivElement;
let onExit = vi.fn<() => void>();
let onSave = vi.fn<(save: Omit<SavedGame, 'id' | 'savedAt'>) => void>();
let onScoreUpdate = vi.fn<(score: number) => void>();

function mount(mode: 'tutorial' | 'shift' | 'free' = 'tutorial', goal = 10) {
  act(() => root.render(createElement(GamePage, {
    airport: field,
    initialRunwayConfig: fieldRunways,
    mode,
    goal,
    difficulty: 'easy',
    highScore: 0,
    onExit,
    onSave,
    onScoreUpdate,
  })));
}

function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const matches = Array.from(scope.querySelectorAll('button')).filter(element => element.textContent?.trim() === label);
  expect(matches, `Expected exactly one button named "${label}"`).toHaveLength(1);
  return matches[0];
}

function click(label: string, scope: ParentNode = container) {
  act(() => button(label, scope).click());
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

function text() {
  return container.textContent ?? '';
}

function track(id: string): Plane {
  const element = container.querySelector(`[data-plane-id="${id}"]`);
  expect(element, `Expected a visible track for ${id}`).not.toBeNull();
  return JSON.parse(element!.getAttribute('data-plane')!) as Plane;
}

function consoleInput(): HTMLInputElement {
  return container.querySelector('input[type="text"]')!;
}

function typeCommand(command: string) {
  act(() => {
    const input = consoleInput();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, command);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function sendCommand(command: string, via: 'enter' | 'submit' = 'enter') {
  typeCommand(command);
  act(() => {
    if (via === 'enter') {
      consoleInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    } else {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}

function advanceUntil(predicate: () => boolean, limitMs: number, stepMs = 500) {
  let elapsed = 0;
  while (!predicate() && elapsed < limitMs) {
    advance(stepMs);
    elapsed += stepMs;
  }
  expect(predicate(), `Condition did not become true after ${limitMs}ms`).toBe(true);
}

beforeEach(() => {
  measured = true;
  capturedDomain = undefined;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onExit = vi.fn();
  onSave = vi.fn();
  onScoreUpdate = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('guided training with the live simulation', () => {
  it('deselects after a valid typed clearance while preserving its execution and receipt', () => {
    mount();
    click('Select TRN101');
    sendCommand('TRN101 H000');
    expect(track('tutorial-arrival').targetHeading).toBe(0);
    expect(container.querySelector('[data-plane-id="tutorial-arrival"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(text()).toContain('No selected aircraft');
    expect(consoleInput().value).toBe('');
    expect(consoleInput().disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('TRN101: clearance transmitted.');
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Radar aircraft selection"]'));
  });

  it('consumes one selection once and ignores held Enter after another aircraft is selected', () => {
    vi.spyOn(spawn, 'isSpawnDue').mockReturnValue(true);
    vi.spyOn(spawn, 'spawnAircraft').mockImplementation(request => ({
      plane: request.planes.length < 2 ? makePlane({
        id: `test-${request.planes.length}`, callsign: `TST${request.planes.length + 1}00`,
        x: 250 + request.planes.length * 500, heading: 270, targetHeading: 270,
      }) : null,
      lastDepartureAt: request.lastDepartureAt,
    }));
    mount('free');
    advance(100);
    click('Pause');
    click('Select TST100');
    typeCommand('H090');
    act(() => {
      consoleInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(track('test-0').targetHeading).toBe(90);
    expect(track('test-1').targetHeading).toBe(270);
    expect(audioManager.playRadio).toHaveBeenCalledTimes(1);

    // There is no automatic addressing from an unselected console.
    sendCommand('TST200 H180');
    expect(track('test-1').targetHeading).toBe(270);
    click('Select TST200');
    typeCommand('H180');
    act(() => consoleInput().dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', repeat: true, bubbles: true, cancelable: true,
    })));
    expect(track('test-1').targetHeading).toBe(270);
    expect(consoleInput().value).toBe('H180');
    advance(16);
    expect(document.activeElement).toBe(consoleInput());
    sendCommand('H180');
    expect(track('test-1').targetHeading).toBe(180);
    expect(consoleInput().disabled).toBe(true);
    expect(audioManager.playRadio).toHaveBeenCalledTimes(2);
  });

  it('still clears selection and text if radio audio fails after accepting the clearance', () => {
    mount();
    click('Select TRN101');
    vi.mocked(audioManager.playRadio).mockImplementationOnce(() => { throw new Error('audio unavailable'); });
    sendCommand('H000', 'submit');
    expect(track('tutorial-arrival').targetHeading).toBe(0);
    expect(consoleInput().disabled).toBe(true);
    expect(consoleInput().value).toBe('');
    expect(text()).toContain('TRN101: clearance transmitted.');
  });

  it('teaches selection, heading, descent, speed, capture, landing, and actual separation', () => {
    const spawning = vi.spyOn(spawn, 'spawnAircraft');
    mount();
    expect(text()).toContain('1 / SELECT ONE AIRCRAFT');
    expect(consoleInput().disabled).toBe(true);
    const initial = track('tutorial-arrival');
    advance(30000);
    expect(track('tutorial-arrival')).toEqual(initial);
    expect(spawning).not.toHaveBeenCalled();

    click('Select TRN101');
    expect(text()).toContain('2 / TURN ONTO FINAL');
    expect(consoleInput().disabled).toBe(false);
    sendCommand('H090');
    expect(text()).toContain('2 / TURN ONTO FINAL');
    click('Select TRN101');
    sendCommand('H000');
    expect(text()).toContain('3 / DESCEND');
    click('Select TRN101');
    sendCommand('D3000', 'submit');
    expect(text()).toContain('4 / SLOW DOWN');
    expect(track('tutorial-arrival').altitude).toBe(11000);
    click('Select TRN101');
    sendCommand('S180');
    expect(text()).toContain('5 / WATCH ILS CAPTURE');
    expect(consoleInput().value).toBe('');
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Radar aircraft selection"]'));

    advanceUntil(() => text().includes('6 / FIRST LANDING'), 20000);
    expect(track('tutorial-arrival').isEstablished).toBe(true);
    expect(audioManager.playIlsCapture).toHaveBeenCalledTimes(1);
    advanceUntil(() => text().includes('FIRST ARRIVAL COMPLETE'), 120000);
    expect(text()).toContain('OPS: 1');
    expect(onScoreUpdate).toHaveBeenCalledWith(1);
    expect(container.querySelectorAll('[data-plane-id]')).toHaveLength(0);
    expect(spawning).not.toHaveBeenCalled();

    click('START SEPARATION LESSON');
    expect(text()).toContain('7 / SELECT THE CROSSING TRAFFIC');
    expect(container.querySelectorAll('[data-plane-id]')).toHaveLength(2);
    const crossing = track('tutorial-separation-a');
    advance(10000);
    expect(track('tutorial-separation-a')).toEqual(crossing);
    click('Select TRN201');
    expect(text()).toContain('8 / CREATE VERTICAL SPACING');
    sendCommand('C5000');
    expect(text()).toContain('9 / WATCH THE CLIMB');
    expect(track('tutorial-separation-a').altitude).toBe(4000);
    expect(track('tutorial-separation-a').targetAltitude).toBe(5000);
    advance(2000);
    expect(text()).not.toContain('TRAINING COMPLETE');
    expect(track('tutorial-separation-a').altitude).toBeLessThan(5000);

    advanceUntil(() => track('tutorial-separation-a').altitude - track('tutorial-separation-b').altitude >= 1000, 5000, 50);
    expect(text()).not.toContain('TRAINING COMPLETE');
    advance(2950);
    expect(text()).not.toContain('TRAINING COMPLETE');
    advance(50);
    expect(text()).toContain('TRAINING COMPLETE');
    expect(track('tutorial-separation-a').altitude - track('tutorial-separation-b').altitude).toBeGreaterThanOrEqual(1000);
    expect(audioManager.playCrash).not.toHaveBeenCalled();
    expect(audioManager.playWarning).not.toHaveBeenCalled();
    const completed = track('tutorial-separation-a');
    advance(30000);
    expect(track('tutorial-separation-a')).toEqual(completed);
    expect(spawning).not.toHaveBeenCalled();
    click('CHOOSE A SHIFT');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid text visible, explains the error, and allows a corrected clearance', () => {
    mount();
    click('Select TRN101');
    const original = track('tutorial-arrival');
    sendCommand('BANANAS');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Command not recognized');
    expect(consoleInput().value).toBe('BANANAS');
    expect(container.querySelector('[data-plane-id="tutorial-arrival"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(track('tutorial-arrival')).toEqual(original);
    expect(text()).toContain('2 / TURN ONTO FINAL');
    expect(audioManager.playRadio).not.toHaveBeenCalled();

    sendCommand('H000');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('TRN101: clearance transmitted.');
    expect(consoleInput().value).toBe('');
    expect(track('tutorial-arrival').targetHeading).toBe(0);
    expect(audioManager.playRadio).toHaveBeenCalledTimes(1);
  });

  it('restarts training from a clean first lesson and offers a direct exit', () => {
    mount();
    const initial = track('tutorial-arrival');
    click('Select TRN101');
    sendCommand('H000 D3000 S180');
    advance(1000);
    expect(track('tutorial-arrival')).not.toEqual(initial);

    click('Restart training');
    expect(text()).toContain('1 / SELECT ONE AIRCRAFT');
    expect(track('tutorial-arrival')).toEqual(initial);
    expect(consoleInput().disabled).toBe(true);
    expect(consoleInput().value).toBe('');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    expect(text()).toContain('OPS: 0');
    advance(10000);
    expect(track('tutorial-arrival')).toEqual(initial);
    click('Back to sessions');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('accepts the same first clearance immediately after a training restart', () => {
    mount();
    click('Select TRN101');
    sendCommand('H000');
    expect(text()).toContain('3 / DESCEND');
    click('Restart training');
    click('Select TRN101');
    sendCommand('H000');
    expect(text()).toContain('3 / DESCEND');
    expect(consoleInput().value).toBe('');
    expect(audioManager.playRadio).toHaveBeenCalledTimes(2);
  });
});

describe('pause and restart controls', () => {
  it('does not turn a manual pause into a running simulation when the menu closes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    mount('shift');
    advance(50);
    const id = container.querySelector('[data-plane-id]')!.getAttribute('data-plane-id')!;
    click('MENU');
    const stopped = track(id);
    advance(10000);
    expect(track(id)).toEqual(stopped);
    click('Pause', container.querySelector('header')!);
    click('MENU');
    expect(text()).toContain('SIMULATION PAUSED');
    advance(10000);
    expect(track(id)).toEqual(stopped);

    click('MENU');
    expect(text()).not.toContain('SIMULATION PAUSED');
    act(() => container.querySelector('[data-testid="radar"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(text()).toContain('SIMULATION PAUSED');
    advance(10000);
    expect(track(id)).toEqual(stopped);
    click('RESUME RADAR');
    advance(50);
    expect(track(id)).not.toEqual(stopped);
  });

  it('restarts a running session without stale selection or feedback and exits from its menu', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    mount('shift');
    advance(50);
    const first = container.querySelector<HTMLButtonElement>('[data-plane-id]')!;
    act(() => first.click());
    sendCommand('H090');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    click('MENU');
    click('Pause', container.querySelector('header')!);
    click('Restart');
    expect(text()).not.toContain('SIMULATION PAUSED');
    expect(container.querySelectorAll('[data-plane-id]')).toHaveLength(0);
    expect(consoleInput().disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    advance(50);
    expect(container.querySelectorAll('[data-plane-id]')).toHaveLength(1);
    click('MENU');
    click('Exit');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('shift debriefs', () => {
  it('shows the completed objective, supports a fresh attempt, and returns to session choice', () => {
    vi.spyOn(spawn, 'spawnAircraft').mockImplementation(request => ({
      plane: makeDeparture({ id: 'finished', x: 900, y: 500, altitude: 11000, targetAltitude: 11000, targetWaypoint: 'east' }),
      lastDepartureAt: request.now,
    }));
    mount('shift', 1);
    advance(50);
    const debrief = container.querySelector('[role="dialog"]');
    expect(debrief?.textContent).toContain('Objective complete');
    expect(debrief?.textContent).toContain('1/1 safe operations');
    expect(debrief?.textContent).toContain('100 points');
    expect(debrief?.textContent).toContain('exit handoff safely');
    click('SAVE RESULT');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mode: 'shift', score: 1, points: 100, goal: 1 }));
    expect(button('SAVED').disabled).toBe(true);
    advance(5000);
    expect(onScoreUpdate.mock.calls.filter(([score]) => score === 1)).toHaveLength(1);
    click('TRY AGAIN');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain('OPS: 0');
    advance(50);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Objective complete');
    click('CHOOSE SESSION');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows concrete failure feedback instead of a successful debrief after an accident', () => {
    vi.spyOn(spawn, 'spawnAircraft').mockImplementation(request => ({
      plane: makePlane({ heading: 90, targetHeading: 90, altitude: 1000, targetAltitude: 1000, speed: 300, targetSpeed: 300 }),
      lastDepartureAt: request.lastDepartureAt,
    }));
    mount('shift');
    advance(50);
    const debrief = container.querySelector('[role="dialog"]');
    expect(debrief?.textContent).toContain('Let’s learn from this one');
    expect(debrief?.textContent).toContain('unstable arrival');
    expect(debrief?.textContent).toContain('Intercept the active ILS');
    expect(debrief?.textContent).toContain('0/10 safe operations');
    expect(debrief?.textContent).toContain('1 accident');
  });
});

it('keeps one persistent flight strip and places the console below the radar at every screen size', () => {
  mount('tutorial');
  const radar = container.querySelector('[aria-label="Radar aircraft selection"]')!;
  const form = container.querySelector('form')!;
  expect(radar.contains(form)).toBe(false);
  expect(radar.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.firstElementChild?.className).toContain('flex-col');
  expect(container.firstElementChild?.className).toContain('md:flex-row');
  const strip = container.querySelector('[data-testid="strip"]')!;
  expect(strip.parentElement?.className).toContain('w-full');
  expect(strip.parentElement?.className).toContain('md:w-80');
  expect(container.querySelectorAll('[data-testid="strip"]')).toHaveLength(1);
  expect(form.parentElement?.className).not.toContain('absolute');
  expect(form.parentElement?.parentElement?.className).toContain('flex-col');
  expect(radar.className).toContain('md:flex-1');
  const trackButton = container.querySelector('[data-plane-id]') as HTMLButtonElement;
  act(() => trackButton.click());
  expect(container.querySelector('[data-testid="strip"]')).toBe(strip);
});

it('blocks random time until first valid measurement and freezes domain through later measurements', () => {
  measured = false;
  const spawning = vi.spyOn(spawn, 'spawnAircraft');
  mount('free');
  advance(1000);
  expect(spawning).not.toHaveBeenCalled();
  act(() => reportAspect?.(0));
  advance(1000);
  expect(spawning).not.toHaveBeenCalled();
  act(() => reportAspect?.(3));
  expect(capturedDomain).toEqual({ halfWidth: 2100, halfHeight: 700 });
  advance(50);
  expect(spawning).toHaveBeenCalledWith(expect.objectContaining({ domain: capturedDomain }));
  const frozen = capturedDomain;
  act(() => reportAspect?.(.5));
  expect(capturedDomain).toBe(frozen);
});

it('starts with range guides off and keeps the explicit overlay toggle available', () => {
  mount('free');
  click('MENU');
  const label = [...container.querySelectorAll('label')].find(el => el.textContent?.trim() === 'Range Rings')!;
  const input = label.querySelector('input')!;
  expect(input.checked).toBe(false);
  act(() => input.click());
  expect(input.checked).toBe(true);
  act(() => input.click());
  expect(input.checked).toBe(false);
});

it('forwards active forecast speed and visibility to the controls outside the radar', () => {
  mount('free');
  expect(capturedControl).toEqual(expect.objectContaining({ gameSpeed: 1, showVectors: true, showExtendedCenterlines: true }));
  click('MENU');
  click('4x');
  expect(capturedControl.gameSpeed).toBe(4);
  const vectors = [...container.querySelectorAll('label')].find(el => el.textContent?.trim() === 'Vectors')!.querySelector('input')!;
  act(() => vectors.click());
  expect(capturedControl.showVectors).toBe(false);
});

it.each(['free', 'shift', 'tutorial', 'challenge'] as const)('shares the geographic KBOS world and frozen35NM core in %s', mode => {
  measured = false;
  const canonical = AIRPORTS.find(airport => airport.icao === 'KBOS')!;
  act(() => root.render(createElement(GamePage, { airport: canonical, mode, challengeLevel: 1,
    difficulty: 'easy', highScore: 0, onExit, onSave, onScoreUpdate })));
  expect(capturedAirport).not.toBe(canonical);
  expect(capturedAirport!.waypoints).toHaveLength(9);
  expect(container.querySelector('[data-airport-theme="navy"]')).not.toBeNull();
  act(() => reportAspect!(2));
  expect(capturedDomain).toEqual({ halfWidth: 784, halfHeight: 392 });
  act(() => reportAspect!(.5));
  expect(capturedDomain).toEqual({ halfWidth: 784, halfHeight: 392 });
  expect(canonical.waypoints).toHaveLength(5);
});

it('transmits a KBOS magnetic console heading once and consumes Enter selection', () => {
  const airport = AIRPORTS.find(item => item.icao === 'KBOS')!;
  act(() => root.render(createElement(GamePage, { airport, mode: 'free', difficulty: 'easy', highScore: 0, onExit, onSave, onScoreUpdate })));
  advance(50);
  const current = JSON.parse(container.querySelector('[data-plane]')!.getAttribute('data-plane')!);
  click(`Select ${current.callsign}`);
  sendCommand('H090');
  expect(track(current.id).targetHeading).toBe(75);
  expect(consoleInput().disabled).toBe(true);
});

it('keeps a fixed, accessible console feedback slot through empty, error, success and reselect states', () => {
  mount();
  const slot = () => {
    const status = container.querySelector<HTMLElement>('form [role="status"]');
    expect(status).not.toBeNull();
    // Assert the real CSS layout contract, not fabricated jsdom bounding boxes.
    for (const token of ['h-8', 'shrink-0', 'leading-4', 'overflow-y-auto', 'break-words']) {
      expect(status!.classList.contains(token), token).toBe(true);
    }
    expect(status!.tabIndex).toBe(0);
    expect(status!.getAttribute('aria-atomic')).toBe('true');
    return status!;
  };
  const original = slot();
  expect(original.textContent).toBe('');
  click('Select TRN101');
  sendCommand('NOT-A-CLEARANCE');
  expect(slot()).toBe(original);
  expect(slot().textContent).toContain('Command not recognized.');
  sendCommand('H090');
  expect(slot()).toBe(original);
  expect(slot().textContent).toContain('clearance transmitted.');
  click('Select TRN101');
  expect(slot()).toBe(original);
  expect(slot().textContent).toBe('');
});

it('reserves a constant command row and transmit slot before the first character', () => {
  mount();
  const input = consoleInput();
  const row = input.parentElement!;
  const slot = row.querySelector('[data-command-transmit-slot]');
  expect(row.classList.contains('h-8')).toBe(true);
  expect(row.classList.contains('shrink-0')).toBe(true);
  expect(slot?.classList.contains('w-20')).toBe(true);
  expect(slot?.classList.contains('shrink-0')).toBe(true);
  expect(input.classList.contains('text-base')).toBe(true);
  expect(input.classList.contains('md:text-sm')).toBe(true);
  expect(slot?.querySelector('button')).toBeNull();
  const focus = vi.spyOn(input, 'focus');
  click('Select TRN101');
  advance(0);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  for (const command of ['H', 'H0', 'ILS', 'SW', '']) {
    typeCommand(command);
    expect(consoleInput()).toBe(input);
    expect(input.parentElement).toBe(row);
    expect(row.querySelector('[data-command-transmit-slot]')).toBe(slot);
    expect(slot?.querySelectorAll('button')).toHaveLength(command ? 1 : 0);
  }
  const id = container.querySelector('[data-plane-id]')!.getAttribute('data-plane-id')!;
  sendCommand('H090');
  expect(track(id).targetHeading).toBe(90);
  expect(input.parentElement).toBe(row);
  expect(slot?.querySelector('button')).toBeNull();
});


it.each(AIRPORTS)('uses shared navy controls while retaining $icao identity and operative inventory', airport => {
  act(() => root.render(createElement(GamePage, { airport, mode: 'free', difficulty: 'easy',
    highScore: 0, onExit, onSave, onScoreUpdate })));
  expect(container.querySelector('[data-airport-theme="navy"]')).not.toBeNull();
  expect(capturedAirport!.id).toBe(airport.id);
  expect(capturedAirport!.runways.map(runway => runway.id)).toEqual(airport.runways.map(runway => runway.id));
  if (!['KBOS', 'MDSD', 'MPTO'].includes(airport.icao)) expect(capturedAirport).toBe(airport);
  if (['MDSD', 'MPTO'].includes(airport.icao)) {
    expect(capturedAirport!.terrainMap).toBeDefined();
    expect(capturedAirport!.waypoints.map(fix => [fix.id, fix.label])).toEqual(airport.waypoints.map(fix => [fix.id, fix.label]));
    expect(capturedAirport!.syntheticLayout?.kind).toBe('synthetic');
    expect(capturedAirport!.geographic).toBeUndefined();
  }
  expect(consoleInput().parentElement!.classList.contains('h-8')).toBe(true);
});

it.each(['free', 'shift', 'tutorial', 'challenge'] as const)('uses the same cached MPTO map/layout and four controls in %s', mode => {
  const airport = AIRPORTS.find(item => item.icao === 'MPTO')!;
  act(() => root.render(createElement(GamePage, { airport, mode, challengeLevel: 1,
    difficulty: 'easy', highScore: 0, onExit, onSave, onScoreUpdate })));
  expect(capturedAirport!.terrainMap?.referenceKind).toBe('derived selected endpoint mean');
  expect(capturedAirport!.waypoints.map(fix => fix.id)).toEqual(airport.waypoints.map(fix => fix.id));
  expect(capturedAirport!.runways.map(runway => runway.id)).toEqual(airport.runways.map(runway => runway.id));
  expect(capturedAirport!.syntheticLayout?.holdFixIds['stack-canal']).toBe('WP-P1');
});
