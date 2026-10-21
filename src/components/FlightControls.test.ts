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
let resizeRadar: () => void;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resizeRadar = callback; }
    observe() {}
    disconnect() {}
  });
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
    resize(w: number, h: number) { width = w; height = h; act(() => resizeRadar?.()); },
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
  const beforeResize = movedView!.split(' ').map(Number);
  const resized = svg.getAttribute('viewBox')!.split(' ').map(Number);
  expect(resized[0] + resized[2] / 2).toBeCloseTo(beforeResize[0] + beforeResize[2] / 2);
  expect(resized[1] + resized[3] / 2).toBeCloseTo(beforeResize[1] + beforeResize[3] / 2);
  expect(Math.min(resized[2], resized[3])).toBeCloseTo(Math.min(beforeResize[2], beforeResize[3]));
  expect(resized[2] / resized[3]).toBeCloseTo(390 / 500);
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
  const resetView = svg.getAttribute('viewBox')!.split(' ').map(Number);
  expect(resetView[0] + resetView[2] / 2).toBeCloseTo(500);
  expect(resetView[1] + resetView[3] / 2).toBeCloseTo(500);
  expect(Math.min(resetView[2], resetView[3])).toBe(1400);
  expect(original).toBe('-200 -200 1400 1400');
});


it('fits landscape, portrait and square SVG panels without gutters, while preserving anchored zoom and center', () => {
  radar(makePlane());
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  const view = () => svg.getAttribute('viewBox')!.split(' ').map(Number);
  for (const [width, height] of [[860, 482], [390, 700], [390, 390]]) {
    coords.resize(width, height);
    const [x, y, w, h] = view();
    expect(w / h).toBeCloseTo(width / height);
    expect(Math.min(w, h)).toBeCloseTo(1400);
    expect(x + w / 2).toBeCloseTo(500);
    expect(y + h / 2).toBeCloseTo(500);
    const ctm = svg.getScreenCTM()!;
    expect(ctm.a).toBeCloseTo(ctm.d);
    expect(coords.client(x, y).clientX).toBeCloseTo(20, 7);
    expect(coords.client(x, y).clientY).toBeCloseTo(30, 7);
    expect(coords.client(x + w, y + h).clientX).toBeCloseTo(20 + width);
    expect(coords.client(x + w, y + h).clientY).toBeCloseTo(30 + height);
  }
  coords.resize(860, 482);
  const anchor = coords.client(900, 800);
  act(() => svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -40, ...anchor })));
  expect(coords.client(900, 800).clientX).toBeCloseTo(anchor.clientX);
  expect(coords.client(900, 800).clientY).toBeCloseTo(anchor.clientY);
  const zoomed = view();
  expect(Math.min(zoomed[2], zoomed[3])).toBeLessThan(1400);
  coords.resize(0, 0);
  expect(view()).toEqual(zoomed);
  coords.resize(482, 860);
  const portrait = view();
  expect(portrait[2] / portrait[3]).toBeCloseTo(482 / 860);
  expect(Math.min(portrait[2], portrait[3])).toBeCloseTo(Math.min(zoomed[2], zoomed[3]));
  expect(portrait[0] + portrait[2] / 2).toBeCloseTo(zoomed[0] + zoomed[2] / 2);
  expect(portrait[1] + portrait[3] / 2).toBeCloseTo(zoomed[1] + zoomed[3] / 2);
});

it('removes the circular perimeter and 360-degree compass while retaining unclipped world geometry', () => {
  radar(makePlane());
  const svg = container.querySelector('svg')!;
  expect(svg.querySelector('circle[r="560"]')).toBeNull();
  expect([...svg.querySelectorAll('text')].some(text => text.textContent === '360')).toBe(false);
  expect(svg.querySelectorAll('line').length).toBeLessThan(100);
});

it('reserves flow space for zoom, guidance and readback instead of overlaying panel corners', () => {
  radar(makePlane());
  const zoom = container.querySelector('[aria-label="Zoom radar in"]')!.parentElement!;
  expect(zoom.className).not.toContain('absolute');
  const guidance = [...container.querySelectorAll('div')].find(el => el.className.includes('pointer-events-none') && el.textContent?.includes('DASHED PATH'))!;
  expect(guidance.className).not.toContain('absolute');
  const readback = [...container.querySelectorAll('div')].find(el => el.className.includes('pointer-events-none') && el.textContent?.includes('TST100 (A320)'))!;
  expect(readback.className).not.toContain('absolute');
});


it('limits the shortest camera span and resets to the airport center without changing panel coverage', () => {
  const airport = { ...field, x: 650, y: 450 };
  act(() => root.render(createElement(RadarDisplay, { airport, runwayConfig: fieldRunways, planes: [], selectedId: null, onSelect: onDeselect })));
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(900, 450);
  const view = () => svg.getAttribute('viewBox')!.split(' ').map(Number);
  for (let i = 0; i < 20; i++) clickText('+');
  expect(Math.min(view()[2], view()[3])).toBe(400);
  expect((container.querySelector('[aria-label="Zoom radar in"]') as HTMLButtonElement).disabled).toBe(true);
  for (let i = 0; i < 20; i++) clickText('−');
  expect(Math.min(view()[2], view()[3])).toBe(2600);
  expect(view()[2] / view()[3]).toBe(2);
  expect((container.querySelector('[aria-label="Zoom radar out"]') as HTMLButtonElement).disabled).toBe(true);
  const reset = container.querySelector('[aria-label="Reset radar view"]') as HTMLButtonElement;
  expect(reset.textContent).toContain('116 NM');
  act(() => reset.click());
  const [x, y, w, h] = view();
  expect(Math.min(w, h)).toBe(1400);
  expect(x + w / 2).toBe(airport.x);
  expect(y + h / 2).toBe(airport.y);
  expect(w / h).toBe(2);
});
