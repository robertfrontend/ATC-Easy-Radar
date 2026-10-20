// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { RadarDisplay } from './RadarDisplay';
import { field, fieldRunways, makePlane } from '../test/field';
import { Plane } from '../types';

vi.mock('../utils/audio', () => ({ audioManager: { playRadio: vi.fn(), playSelect: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
const onCommand = vi.fn();
const onDeselect = vi.fn();
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(performance, 'now').mockReturnValue(100);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onCommand.mockClear();
  onDeselect.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function strip(plane: Plane) {
  act(() => root.render(createElement(ControlPanel, { plane, airport: field, runwayConfig: fieldRunways, onCommand, onDeselect })));
}
function clickText(text: string) {
  const button = [...container.querySelectorAll('button')].find(el => el.textContent?.trim() === text);
  expect(button).toBeTruthy();
  act(() => button!.click());
}
function radar(plane: Plane) {
  act(() => root.render(createElement(RadarDisplay, { planes: [plane], selectedId: plane.id, onSelect: onDeselect, onCommand, airport: field, runwayConfig: fieldRunways })));
}

describe('Flight controls', () => {
  it('keeps altitude drafts while direct-to guidance updates, then transmits once', () => {
    const plane = makePlane({ x: 100, y: 100, targetWaypoint: 'east', targetHeading: 110 });
    strip(plane);
    clickText('3k');
    expect(container.textContent).toContain('DRAFT · Not transmitted');
    expect(onCommand).not.toHaveBeenCalled();
    strip({ ...plane, targetHeading: 111 });
    clickText('TRANSMIT CLEARANCE');
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(plane.id, expect.objectContaining({ targetAltitude: 3000, targetWaypoint: 'east' }));
  });
  it('does not carry an untransmitted draft to a new aircraft', () => {
    strip(makePlane());
    clickText('3k');
    strip(makePlane({ id: 'other', targetAltitude: 9000 }));
    expect(container.textContent).not.toContain('DRAFT · Not transmitted');
    clickText('TRANSMIT CLEARANCE');
    expect(onCommand).toHaveBeenCalledWith('other', expect.objectContaining({ targetAltitude: 9000 }));
  });
  it('updates the selected forecast immediately after a new clearance, even while paused', () => {
    const plane = makePlane({ x: 100, y: 100, heading: 90, targetHeading: 90, altitude: 5000, targetAltitude: 5000 });
    radar(plane);
    const path = () => container.querySelector('[aria-label="30-second forecast using active clearance, not other traffic"] polyline')?.getAttribute('points');
    const before = path();
    expect(before).toBeTruthy();
    // performance.now is unchanged: a clearance must bypass the 500ms throttle.
    radar({ ...plane, targetHeading: 180 });
    expect(path()).not.toEqual(before);
  });
  it('fix activation transmits only direct-to, never an incidental heading', () => {
    const plane = makePlane({ x: 100, y: 100 });
    radar(plane);
    const svg = container.querySelector('svg')!;
    Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }) });
    Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) });
    act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 900, clientY: 500 })));
    const fix = container.querySelector('[aria-label="Transmit direct to EAST"]')!;
    act(() => {
      fix.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      fix.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(plane.id, { targetWaypoint: 'east' });
  });
});
