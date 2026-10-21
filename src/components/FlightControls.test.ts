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

// Model browser SVG transforms from the live viewBox, including resize/letterboxing.
function radarCoordinates(svg: SVGSVGElement) {
  let width = 700;
  let height = 700;
  const matrix = (a: number, d: number, e: number, f: number) => ({
    a, d, e, f,
    inverse: () => matrix(1 / a, 1 / d, -e / a, -f / d),
  });
  Object.defineProperty(svg, 'createSVGPoint', { value: () => ({
    x: 0, y: 0,
    matrixTransform(m: ReturnType<typeof matrix>) { return { x: this.x * m.a + m.e, y: this.y * m.d + m.f }; },
  }) });
  Object.defineProperty(svg, 'getScreenCTM', { value: () => {
    const [x, y, w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const scale = Math.min(width / w, height / h);
    return matrix(scale, scale, 20 + (width - w * scale) / 2 - x * scale, 30 + (height - h * scale) / 2 - y * scale);
  } });
  vi.spyOn(svg, 'getBoundingClientRect').mockImplementation(() => ({ width, height, left: 20, top: 30 }) as DOMRect);
  return {
    resize(w: number, h: number) { width = w; height = h; },
    client(x: number, y: number) {
      const ctm = svg.getScreenCTM()!;
      return { clientX: x * ctm.a + ctm.e, clientY: y * ctm.d + ctm.f };
    },
  };
}

it('renders the whole rectangular map and corner bloom without circular masking', () => {
  radar(makePlane({ x: 1080, y: 1080 }));
  const svg = container.querySelector('svg')!;
  radarCoordinates(svg);
  expect(svg.querySelector('clipPath, [clip-path]')).toBeNull();
  expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  expect(svg.getAttribute('class')).toContain('aspect-square');
  expect(svg.style.overflow).toBe('hidden');
  expect(container.querySelector('[aria-label="Zoom radar in"]')?.parentElement?.className).toContain('relative');
  const background = svg.querySelector('rect[pointer-events="all"]');
  expect(background?.getAttribute('fill')).not.toBe('transparent');
  const ctx = new Proxy({ clip: vi.fn(), fillText: vi.fn() }, {
    get(target, key) { return key in target ? target[key as keyof typeof target] : vi.fn(); },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const draw = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  act(() => draw(100));
  expect(ctx.clip).not.toHaveBeenCalled();
  expect(ctx.fillText).toHaveBeenCalledWith('✳', expect.any(Number), expect.any(Number));
});

it.each([[-1, -1], [1, -1], [-1, 1], [1, 1]])('selects corner tracks by mouse and keyboard (%s,%s)', (sx, sy) => {
  const plane = makePlane({ x: 500 + sx * 580, y: 500 + sy * 580 });
  radar(plane);
  const target = container.querySelector('[data-aircraft]')!;
  act(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onDeselect).toHaveBeenLastCalledWith(plane.id);
  for (const key of ['Enter', ' ']) {
    onDeselect.mockClear();
    act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    expect(onDeselect).toHaveBeenCalledExactlyOnceWith(plane.id);
  }
});

it('preserves corner heading coordinates after zoom, drag and non-square resize, then resets the camera', () => {
  const plane = makePlane({ x: 500, y: 500 });
  radar(plane);
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  const original = svg.getAttribute('viewBox');
  clickText('+');
  expect(svg.getAttribute('viewBox')).not.toBe(original);
  act(() => svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200 })));
  act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 230, clientY: 220 })));
  act(() => svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  expect(onCommand).not.toHaveBeenCalled();
  const movedView = svg.getAttribute('viewBox');
  coords.resize(390, 500);
  act(() => window.dispatchEvent(new Event('resize')));
  expect(svg.getAttribute('viewBox')).toBe(movedView);
  for (const [x, y, heading] of [[-80, -80, 315], [1080, -80, 45], [-80, 1080, 225], [1080, 1080, 135]]) {
    const client = coords.client(x, y);
    act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...client })));
    act(() => svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ...client })));
    act(() => svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, ...client })));
    expect(onCommand).toHaveBeenLastCalledWith(plane.id, { targetHeading: heading, targetWaypoint: null });
  }
  const fix = container.querySelector('[aria-label="Transmit direct to EAST"]')!;
  onCommand.mockClear();
  act(() => {
    fix.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fix.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(plane.id, { targetWaypoint: 'east' });
  const reset = container.querySelector('[aria-label="Reset radar view"]') as HTMLButtonElement;
  act(() => reset.click());
  expect(svg.getAttribute('viewBox')).toBe(original);
  expect(original).toBe('-200 -200 1400 1400');
});
