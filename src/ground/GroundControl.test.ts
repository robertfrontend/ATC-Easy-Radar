// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GroundControl } from './GroundControl';

let container: HTMLDivElement;
let root: Root;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let now: number;
function button(label: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')]
    .find(el => el.getAttribute('aria-label') === label || el.textContent?.trim() === label);
  expect(found, label).toBeDefined();
  return found!;
}
function click(label: string) { act(() => button(label).click()); }
function frame(seconds: number) {
  now += seconds * 1000;
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach(callback => callback(now)));
}
function mount() {
  act(() => root.render(createElement(MemoryRouter, null, createElement(GroundControl))));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  frames = new Map(); nextFrame = 0; now = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame; frames.set(id, callback); return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container); mount();
});
afterEach(() => {
  act(() => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

it('renders the authored airport, readable hold points and two distinct runway resources', () => {
  expect(container.querySelector('h1')?.textContent).toBe('Ground Control');
  expect(container.querySelector('svg[aria-label="Willow Field airport map"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-runway]')).toHaveLength(2);
  expect(container.querySelectorAll('[data-hold-point]').length).toBeGreaterThanOrEqual(4);
  expect(container.textContent).toContain('Taxi clearance is not runway clearance');
  expect(container.querySelector('[aria-label="Flight list"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Shift statistics"]')).not.toBeNull();
});

it('selects flights, shows only relevant actions and reveals the cleared route', () => {
  const flight = container.querySelector<HTMLButtonElement>('[data-flight-kind="departure"]')!;
  act(() => flight.click());
  expect(flight.getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toContain('Parked');
  const taxi = container.querySelector<HTMLButtonElement>('[data-command="taxi"][data-target-runway="09"]')!;
  expect(taxi).not.toBeNull();
  expect(container.querySelector('[data-command="takeoff"]')).toBeNull();
  act(() => taxi.click());
  expect(container.querySelector('[data-selected-route]')).not.toBeNull();
  expect(container.querySelector('[data-command="stop"]')).not.toBeNull();
  click('Stop taxi');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toContain('Stopped');
  click('Resume taxi');
  expect(container.querySelector('[data-command="stop"]')).not.toBeNull();
});

it('freezes all simulation on pause, uses simulation speed and resets without extra clocks', () => {
  frame(0); frame(2);
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('2');
  click('Pause'); frame(10);
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('2');
  click('2×'); click('Resume'); frame(2);
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('6');
  click('Restart');
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('0');
  expect(container.querySelectorAll('[data-flight-kind]')).toHaveLength(2);
  expect(frames.size).toBe(1);
  frame(5);
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('0');
  frame(1);
  expect(container.querySelector('[data-elapsed]')?.getAttribute('data-elapsed')).toBe('1');
  act(() => root.unmount());
  expect(frames.size).toBe(0);
  root = createRoot(container); mount();
  expect(frames.size).toBe(1);
});

it('allows keyboard selection on the map and keeps clearances unavailable during pause', () => {
  const aircraft = container.querySelector<SVGGElement>('[data-aircraft-kind="departure"]')!;
  expect(aircraft.getAttribute('role')).toBe('button');
  act(() => aircraft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(aircraft.getAttribute('aria-pressed')).toBe('true');
  click('Pause');
  expect([...container.querySelectorAll<HTMLButtonElement>('[data-command]')].every(el => el.disabled)).toBe(true);
});

it('completes a departure and an arrival through real UI clearances, including an explicit crossing', () => {
  const select = (id: string) => {
    const flight = container.querySelector<HTMLButtonElement>(`[data-flight-id="${id}"]`)!;
    expect(flight, id).not.toBeNull(); act(() => flight.click());
  };
  const phase = (id: string) => container.querySelector(`[data-aircraft-id="${id}"]`)?.getAttribute('data-aircraft-phase');
  const until = (predicate: () => boolean) => {
    for (let i = 0; i < 450 && !predicate(); i++) frame(0.5);
    expect(predicate()).toBe(true);
  };
  const command = (type: string, runway?: string) => {
    const action = container.querySelector<HTMLButtonElement>(`[data-command="${type}"]${runway ? `[data-target-runway="${runway}"]` : ''}`)!;
    expect(action, type).not.toBeNull(); expect(action.disabled).toBe(false);
    act(() => action.click());
  };
  frame(0);
  select('GC101'); command('taxi', '09');
  until(() => phase('GC101') === 'holding');
  expect(container.querySelector('[aria-label="Shift statistics"]')?.textContent).toContain('0 departures');
  command('takeoff');
  select('GC202');
  const blockedLanding = container.querySelector<HTMLButtonElement>('[data-command="land"]')!;
  expect(blockedLanding.disabled).toBe(true);
  expect(container.querySelector(`[id="${blockedLanding.getAttribute('aria-describedby')}"]`)?.textContent).toMatch(/reserved|occupied/i);
  select('GC101');
  until(() => !phase('GC101'));
  expect(container.querySelector('[aria-label="Selected aircraft"]')).toBeNull();
  expect(container.querySelector('[aria-label="Shift statistics"]')?.textContent).toContain('1 departures');
  until(() => phase('GC202') === 'approach');
  select('GC202'); command('land');
  until(() => phase('GC202') === 'exiting');
  expect(container.querySelector('[aria-label="Runway status"]')?.textContent).toContain('Occupied: GC202');
  until(() => phase('GC202') === 'awaiting-taxi');
  expect(container.querySelector('[aria-label="Runway status"]')?.textContent).not.toContain('Occupied: GC202');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toContain('Taxi to stand');
  expect(container.querySelector('[data-flight-id="GC202"]')?.textContent).toContain('Taxi to gate clearance needed');
  command('taxi'); until(() => phase('GC202') === 'crossing-hold');
  frame(2); expect(phase('GC202')).toBe('crossing-hold');
  command('cross'); until(() => phase('GC202') === 'turnaround');
  expect(container.querySelector('[aria-label="Shift statistics"]')?.textContent).toContain('1 arrivals');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toMatch(/Gate \d reached/);
}, 30_000);

it('explains why a go-around must return before receiving landing clearance', () => {
  frame(0);
  for (let i = 0; i < 80 && container.querySelector('[data-aircraft-id="GC202"]')?.getAttribute('data-aircraft-phase') !== 'go-around'; i++) frame(1);
  act(() => container.querySelector<HTMLButtonElement>('[data-flight-id="GC202"]')!.click());
  expect(container.querySelector('[data-aircraft-id="GC202"]')?.getAttribute('data-aircraft-phase')).toBe('go-around');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toContain('Landing clearance becomes available when the aircraft returns to approach.');
  expect(container.querySelector('[data-command="land"]')).toBeNull();
}, 30_000);


it('makes the arrival landing request visible before selection without silently granting it', () => {
  const arrival = container.querySelector<HTMLButtonElement>('[data-flight-id="GC202"]')!;
  expect(arrival.textContent).toContain('Landing clearance needed');
  act(() => arrival.click());
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).toContain('Clear landing 09');
  expect(container.querySelector('[aria-label="Selected aircraft"]')?.textContent).not.toContain('Twin-engine jet');
  frame(0); frame(40);
  expect(container.querySelector('[data-aircraft-id="GC202"]')?.getAttribute('data-aircraft-phase')).toBe('approach');
  expect(container.querySelector('[data-command="land"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Shift statistics"]')?.textContent).toContain('0 arrivals');
});


it('shows one compact command region inside the map stage, never in the desk or legend', () => {
  expect(container.querySelector('[aria-label="Selected aircraft"]')).toBeNull();
  act(() => container.querySelector<HTMLButtonElement>('[data-flight-id="GC101"]')!.click());
  const stage = container.querySelector('[data-ground-map-stage]')!;
  const controls = container.querySelector('[aria-label="Selected aircraft"]')!;
  expect(stage).not.toBeNull();
  expect(stage.contains(container.querySelector('svg[aria-label="Willow Field airport map"]'))).toBe(true);
  expect(stage.contains(controls)).toBe(true);
  expect(container.querySelectorAll('[aria-label="Selected aircraft"]')).toHaveLength(1);
  expect(controls.classList.contains('ground-aircraft-controls')).toBe(true);
  expect(controls.querySelector('dl')).toBeNull();
  expect(controls.textContent).not.toContain('Destination');
  expect(container.querySelector('[aria-label="Ground control desk"] [data-command]')).toBeNull();
  expect(container.querySelector('[aria-label="Map legend"] [data-command]')).toBeNull();
  expect(controls.getAttribute('role')).not.toBe('dialog');
});

it('switches, closes and reopens floating clearances without stale selection or duplicate actions', () => {
  const select = (id: string) => act(() => container.querySelector<HTMLButtonElement>(`[data-flight-id="${id}"]`)!.click());
  const controls = () => container.querySelector('[aria-label="Selected aircraft"]');
  select('GC101');
  expect(controls()?.textContent).toContain('GC101');
  expect(controls()?.querySelectorAll('[data-command="taxi"]')).toHaveLength(2);
  select('GC202');
  expect(controls()?.textContent).toContain('GC202');
  expect(controls()?.textContent).not.toContain('GC101');
  expect(controls()?.querySelector('[data-command="taxi"]')).toBeNull();
  expect(controls()?.querySelector('[data-command="land"]')).not.toBeNull();
  click('Close aircraft controls');
  expect(controls()).toBeNull();
  const aircraft = container.querySelector<SVGGElement>('[data-aircraft-id="GC202"]')!;
  expect(document.activeElement).toBe(aircraft);
  expect(aircraft.getAttribute('aria-pressed')).toBe('false');
  act(() => aircraft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(controls()?.textContent).toContain('GC202');
  click('Pause');
  expect(controls()?.textContent).toContain('Resume the simulation to issue clearances.');
  expect(controls()?.querySelector<HTMLButtonElement>('[data-command="land"]')?.disabled).toBe(true);
  act(() => controls()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(controls()).toBeNull();
  select('GC101');
  click('Restart');
  expect(controls()).toBeNull();
  expect(container.querySelectorAll('[data-command]')).toHaveLength(0);
});


it('keeps narrow map commands viewport-sticky without an ancestor scroll container', () => {
  const css = readFileSync('src/ground/ground.css', 'utf8');
  expect(css).toMatch(/\.ground-airport\s*\{[^}]*overflow:\s*clip/);
  expect(css).toMatch(/@media\s*\(max-width:\s*1050px\)[\s\S]*?\.ground-aircraft-controls\s*\{[^}]*position:\s*sticky/);
  expect(css).toContain('grid-area: 1 / 1');
  expect(css).toContain('calc(100dvh - 32px)');
});
