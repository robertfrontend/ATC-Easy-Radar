// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { RadarDisplay } from './RadarDisplay';
import { field, fieldRunways, makePlane } from '../test/field';
import { Plane } from '../types';
import { createRadarDomain } from '../utils/radarBounds';

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
  expect(container.querySelector('[aria-label="Zoom radar in"]')).toBeNull();
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

it('preserves fixed corner heading coordinates after drag suppression and non-square resize', () => {
  const plane = makePlane({ x: 500, y: 500 });
  radar(plane);
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  const original = svg.getAttribute('viewBox');

  act(() => svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200 })));
  act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 230, clientY: 220 })));
  act(() => svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  expect(onCommand).not.toHaveBeenCalled();
  expect(svg.getAttribute('viewBox')).toBe(original);
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
  expect(original).toBe('-200 -200 1400 1400');
});


it('fits landscape, portrait and square SVG panels without gutters and retains the fitted center', () => {
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
  const fitted = view();
  expect(Math.min(fitted[2], fitted[3])).toBe(1400);
  coords.resize(0, 0);
  expect(view()).toEqual(fitted);
  coords.resize(482, 860);
  const portrait = view();
  expect(portrait[2] / portrait[3]).toBeCloseTo(482 / 860);
  expect(Math.min(portrait[2], portrait[3])).toBeCloseTo(Math.min(fitted[2], fitted[3]));
  expect(portrait[0] + portrait[2] / 2).toBeCloseTo(fitted[0] + fitted[2] / 2);
  expect(portrait[1] + portrait[3] / 2).toBeCloseTo(fitted[1] + fitted[3] / 2);
});

it('removes the circular perimeter and 360-degree compass while retaining unclipped world geometry', () => {
  radar(makePlane());
  const svg = container.querySelector('svg')!;
  expect(svg.querySelector('circle[r="560"]')).toBeNull();
  expect([...svg.querySelectorAll('text')].some(text => text.textContent === '360')).toBe(false);
  expect(svg.querySelectorAll('line').length).toBeLessThan(100);
});

it('reserves flow space for guidance and readback instead of overlaying panel corners', () => {
  radar(makePlane());
  const guidance = [...container.querySelectorAll('div')].find(el => el.className.includes('pointer-events-none') && el.textContent?.includes('DASHED PATH'))!;
  expect(guidance.className).not.toContain('absolute');
  const readback = [...container.querySelectorAll('div')].find(el => el.className.includes('pointer-events-none') && el.textContent?.includes('TST100 (A320)'))!;
  expect(readback.className).not.toContain('absolute');
});


it('fits a non-default airport center without any interactive camera state', () => {
  const airport = { ...field, x: 650, y: 450 };
  act(() => root.render(createElement(RadarDisplay, { airport, runwayConfig: fieldRunways, planes: [], selectedId: null, onSelect: onDeselect })));
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(900, 450);
  const view = () => svg.getAttribute('viewBox')!.split(' ').map(Number);
  const [x, y, w, h] = view();
  expect(Math.min(w, h)).toBe(1400);
  expect(x + w / 2).toBe(airport.x);
  expect(y + h / 2).toBe(airport.y);
  expect(w / h).toBe(2);
});

it('covers the fixed rectangular viewBox with a quiet world-unit reference grid after resize', () => {
  radar(makePlane());
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(860, 400);
  const pattern = svg.querySelector('pattern');
  expect(pattern).not.toBeNull();
  expect(pattern?.getAttribute('patternUnits')).toBe('userSpaceOnUse');
  expect(pattern?.getAttribute('width')).toBe('112');
  expect(pattern?.getAttribute('height')).toBe('112');
  expect(Number(pattern?.querySelector('path')?.getAttribute('stroke-opacity'))).toBeGreaterThanOrEqual(0.4);
  const major = svg.querySelector('pattern[data-grid="major"]')!;
  expect(major?.getAttribute('width')).toBe('560');
  expect(Number(major?.querySelector('path')?.getAttribute('stroke-opacity'))).toBeGreaterThan(Number(pattern?.querySelector('path')?.getAttribute('stroke-opacity')));
  const grid = svg.querySelector('rect[pointer-events="all"]')!;
  const assertCoverage = () => {
    expect(['x', 'y', 'width', 'height'].map(attribute => Number(grid.getAttribute(attribute))))
      .toEqual(svg.getAttribute('viewBox')!.split(' ').map(Number));
    expect(grid.getAttribute('fill')).toBe(`url(#${pattern?.id})`);
    const majorGrid = [...svg.querySelectorAll('rect')].find(rect => rect.getAttribute('fill') === `url(#${major.id})`)!;
    expect(['x', 'y', 'width', 'height'].map(attribute => Number(majorGrid.getAttribute(attribute))))
      .toEqual(svg.getAttribute('viewBox')!.split(' ').map(Number));
    expect(majorGrid.getAttribute('pointer-events')).toBe('none');
  };
  assertCoverage();
  act(() => svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 150 })));
  act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240, clientY: 170 })));
  act(() => svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  coords.resize(400, 860);
  assertCoverage();
  expect(pattern?.getAttribute('width')).toBe('112');
  expect(svg.querySelector('circle[r="560"]')).toBeNull();
});

it('keeps track annotation pixels stable across fitted resize without scaling geographic halos', () => {
  radar(makePlane({ x: 500, y: 500 }));
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  for (const [width, height] of [[390, 600], [1180, 650]]) {
    coords.resize(width, height);

    const annotation = container.querySelector('[data-track-annotation]')!;
    expect(annotation).toBeTruthy();
    const inverse = Number(annotation.getAttribute('data-inverse-scale'));
    expect(inverse * svg.getScreenCTM()!.a).toBeCloseTo(1);
    expect(annotation.getAttribute('transform')).toContain('translate(500, 500)');
    expect(container.querySelector('[data-track-hit]')?.getAttribute('r')).toBe(String(22 * inverse));
    expect(container.querySelector('[data-aircraft] circle[stroke]')?.getAttribute('r')).toBe('44.8');
  }
});

it('selects the nearest dense track on hit areas, but keeps callsign and keyboard selection explicit', () => {
  const planes = [makePlane({ id: 'near', x: 500, y: 500 }), makePlane({ id: 'last', x: 515, y: 500 })];
  act(() => root.render(createElement(RadarDisplay, { planes, selectedId: null, onSelect: onDeselect, onCommand, airport: field, runwayConfig: fieldRunways })));
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(390, 600);
  const last = container.querySelector('[data-aircraft="last"]')!;
  act(() => svg.querySelector('[data-track-hit][data-aircraft-hit="last"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, ...coords.client(501, 500) })));
  expect(onDeselect).toHaveBeenLastCalledWith('near');
  act(() => last.querySelector('[data-track-annotation] text')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onDeselect).toHaveBeenLastCalledWith('last');
  onDeselect.mockClear();
  act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onDeselect).toHaveBeenCalledExactlyOnceWith('last');
  expect(onCommand).not.toHaveBeenCalled();
});

it('gives clearance controls readable text and practical touch targets without changing their behavior', () => {
  strip(makePlane());
  const controls = container.querySelector('[data-clearance-controls]');
  expect(controls).toBeTruthy();
  expect(controls?.className).toContain('[&_button]:min-h-11');
  expect(controls?.className).toContain('[&_input[type=range]]:h-11');
  clickText('+10°');
  clickText('TRANSMIT CLEARANCE');
  expect(onCommand).toHaveBeenCalledTimes(1);
});


it('paints every hit target below every visible label so a later track cannot intercept a callsign', () => {
  const planes = [makePlane({ id: 'near', x: 500, y: 500 }), makePlane({ id: 'last', x: 535, y: 500 })];
  act(() => root.render(createElement(RadarDisplay, { planes, selectedId: 'near', onSelect: onDeselect, onCommand, airport: field, runwayConfig: fieldRunways })));
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(390, 600);
  const hits = [...svg.querySelectorAll('[data-track-hit]')];
  const annotations = [...svg.querySelectorAll('[data-track-annotation]')];
  expect(hits).toHaveLength(2);
  for (const hit of hits) {
    for (const annotation of annotations) {
      expect(hit.compareDocumentPosition(annotation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  }
  const client = coords.client(501, 500);
  act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...client })));
  act(() => {
    hits[1].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, ...client }));
    hits[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ...client }));
  });
  expect(onDeselect).toHaveBeenLastCalledWith('near');
  expect(onCommand).not.toHaveBeenCalled();
});


it('assigns four nearby rendered labels distinct quadrants while preserving their world centers', () => {
  const planes = [500, 535, 570, 605].map((x, index) => makePlane({ id: String(index), x, y: 500 }));
  act(() => root.render(createElement(RadarDisplay, { planes, selectedId: null, onSelect: onDeselect, airport: field, runwayConfig: fieldRunways })));
  const svg = container.querySelector('svg')!;
  radarCoordinates(svg).resize(390, 600);
  const annotations = [...svg.querySelectorAll('[data-track-annotation]')];
  const positions = annotations.map(annotation => annotation.querySelector('g')!.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number));
  expect(positions.map(([x, y]) => [Math.sign(x), Math.sign(y)])).toEqual([[1, -1], [-1, 1], [-1, -1], [1, 1]]);
  annotations.forEach((annotation, index) => {
    expect(annotation.getAttribute('transform')).toContain(`translate(${planes[index].x}, 500)`);
  });
});

it('reports measured aspect and fits every frozen domain corner after rotation', () => {
  const onViewportAspect = vi.fn();
  const domain = createRadarDomain(3, 700);
  act(() => root.render(createElement(RadarDisplay, { planes: [], selectedId: null, onSelect: onDeselect,
    airport: field, runwayConfig: fieldRunways, domain, onViewportAspect })));
  const svg = container.querySelector('svg')!;
  const screen = radarCoordinates(svg);
  screen.resize(1200, 400);
  expect(onViewportAspect).toHaveBeenLastCalledWith(3);
  expect(svg.getAttribute('viewBox')!.split(' ').map(Number).slice(2)).toEqual([4200, 1400]);
  screen.resize(400, 1200);
  const [x, y, width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  expect(width).toBe(4200);
  expect(height).toBe(12600);
  expect([x + width / 2, y + height / 2]).toEqual([field.x, field.y]);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const corner = screen.client(field.x + sx * domain.halfWidth, field.y + sy * domain.halfHeight);
      expect(corner.clientX).toBeGreaterThanOrEqual(20);
      expect(corner.clientX).toBeLessThanOrEqual(420);
      expect(corner.clientY).toBeGreaterThanOrEqual(30);
      expect(corner.clientY).toBeLessThanOrEqual(1230);
    }
  }
});

it('keeps a fixed fitted view without cancelling browser wheel, pinch or keyboard zoom gestures', () => {
  radar(makePlane());
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(860, 482);
  const original = svg.getAttribute('viewBox');
  expect(container.querySelector('[aria-label="Zoom radar in"], [aria-label="Zoom radar out"], [aria-label="Reset radar view"]')).toBeNull();
  for (const ctrlKey of [false, true]) {
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -40, ctrlKey, ...coords.client(700, 700) });
    act(() => svg.dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(false);
    expect(svg.getAttribute('viewBox')).toBe(original);
  }
  for (const key of ['+', '-', '0', 'ArrowLeft', 'ArrowRight']) {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
    act(() => svg.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(svg.getAttribute('viewBox')).toBe(original);
  }
  const touch = new Event('touchmove', { bubbles: true, cancelable: true });
  act(() => svg.dispatchEvent(touch));
  expect(touch.defaultPrevented).toBe(false);
});

it('suppresses heading, track, fix and ILS activation after dragging without moving the fitted view', () => {
  const plane = makePlane();
  radar(plane);
  const svg = container.querySelector('svg')!;
  radarCoordinates(svg).resize(860, 482);
  const original = svg.getAttribute('viewBox');
  const targets = [svg, svg.querySelector('[data-aircraft-hit]')!, svg.querySelector('[data-aircraft] text')!,
    svg.querySelector('[aria-label="Transmit direct to EAST"]')!, svg.querySelector('[data-radar-action="ils-fix"]')!];
  for (const target of targets) {
    expect(target).toBeTruthy();
    act(() => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 150 })));
    act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240, clientY: 170 })));
    act(() => {
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240, clientY: 170 }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 240, clientY: 170 }));
    });
    expect(svg.getAttribute('viewBox')).toBe(original);
    expect(svg.style.cursor).not.toBe('grabbing');
    expect(onCommand).not.toHaveBeenCalled();
    expect(onDeselect).not.toHaveBeenCalled();
  }
  const aircraft = svg.querySelector('[data-aircraft]')!;
  act(() => aircraft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onDeselect).toHaveBeenCalledExactlyOnceWith(plane.id);
  act(() => svg.querySelector('[aria-label="Transmit direct to EAST"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(plane.id, { targetWaypoint: 'east' });
});

it('defaults to no canvas range arcs but retains explicit optional guides and real geographic halos', () => {
  radar(makePlane({ x: 500, y: 500 }));
  const svg = container.querySelector('svg')!;
  radarCoordinates(svg);
  const ctx = new Proxy({ arc: vi.fn(), fillText: vi.fn() }, {
    get(target, key) { return key in target ? target[key as keyof typeof target] : vi.fn(); },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const draw = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  act(() => draw(100));
  expect(ctx.arc).not.toHaveBeenCalled();
  expect(svg.querySelector('circle[r="44.8"]')).not.toBeNull();
  act(() => root.render(createElement(RadarDisplay, { airport: field, runwayConfig: fieldRunways,
    planes: [], selectedId: null, onSelect: onDeselect,
    layers: { showRangeRings: true, showFixes: true, showVectors: true, showTrails: true, showHalos: true, showExtendedCenterlines: true } })));
  act(() => draw(200));
  expect(ctx.arc).toHaveBeenCalledTimes(5);
  for (const nm of [5, 10, 15, 20, 25]) expect(ctx.fillText).toHaveBeenCalledWith(`${nm}NM`, expect.any(Number), expect.any(Number));
});

it('previews a short prospective arrow, then retains the transmitted heading after deselection without replacing forecast or history', () => {
  const plane = makePlane({ x: 500, y: 500, heading: 90, targetHeading: 270, headingAssigned: true, trail: [{ x: 480, y: 500 }] });
  radar(plane);
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  coords.resize(860, 482);
  const forecast = svg.querySelector('[aria-label="30-second forecast using active clearance, not other traffic"] polyline')!.getAttribute('points');
  const client = coords.client(500, 100);
  act(() => svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...client })));
  const arrow = svg.querySelector('[data-heading-arrow]')!;
  expect(arrow).toBeTruthy();
  expect(arrow.getAttribute('transform')).toContain('rotate(0)');
  expect(arrow.getAttribute('pointer-events')).toBe('none');
  expect(arrow.querySelector('path')?.getAttribute('stroke-width')).toBe('0.85');
  expect(arrow.querySelector('path')?.getAttribute('d')).toBe('M0 -6V-20 M-2.5 -16L0 -20L2.5 -16');
  expect(svg.querySelector('line[stroke-dasharray="4,4"]')).toBeNull();
  expect([...svg.querySelectorAll('text')].some(text => /^(HDG|DIST) /.test(text.textContent ?? ''))).toBe(false);
  expect(svg.querySelector('[aria-label="30-second forecast using active clearance, not other traffic"] polyline')?.getAttribute('points')).toBe(forecast);
  expect(svg.querySelector('[data-aircraft] rect[x="479"]')).toBeTruthy();
  act(() => {
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, ...client }));
    svg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, ...client }));
  });
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(plane.id, { targetHeading: 0, targetWaypoint: null });
  expect(onDeselect).toHaveBeenLastCalledWith(null);
  const renderCommitted = (targetHeading: number) => act(() => root.render(createElement(RadarDisplay, {
    planes: [{ ...plane, targetHeading }], selectedId: null, onSelect: onDeselect, airport: field, runwayConfig: fieldRunways,
  })));
  renderCommitted(0);
  expect(svg.querySelector('[data-heading-arrow]')?.getAttribute('transform')).toContain('rotate(0)');
  renderCommitted(180);
  expect(svg.querySelector('[data-heading-arrow]')?.getAttribute('transform')).toContain('rotate(180)');
  // The actual-heading velocity cue remains eastbound while the clearance is southbound.
  expect(Number(svg.querySelector('[data-aircraft] > line')?.getAttribute('x2'))).toBeGreaterThan(500);
});

it.each([{ headingAssigned: false }, { headingAssigned: true, targetWaypoint: 'east' }, { headingAssigned: true, isEstablished: true }])('does not invent a committed arrow outside manual-heading mode (%j)', mode => {
  act(() => root.render(createElement(RadarDisplay, { planes: [makePlane(mode)], selectedId: null, onSelect: onDeselect, airport: field, runwayConfig: fieldRunways })));
  expect(container.querySelector('[data-heading-arrow]')).toBeNull();
});

it.each([0, 90, 180, 297])('keeps the thin arrow inside every panel edge without changing bearing %s or world centers', heading => {
  const renderTrack = (x: number, y: number) => act(() => root.render(createElement(RadarDisplay, {
    planes: [makePlane({ x, y, headingAssigned: true, targetHeading: heading })], selectedId: null, onSelect: onDeselect, airport: field, runwayConfig: fieldRunways,
  })));
  renderTrack(500, 500);
  const svg = container.querySelector('svg')!;
  const coords = radarCoordinates(svg);
  for (const [width, height] of [[390, 600], [1180, 650]]) {
    coords.resize(width, height);
    const [left, top, w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const scale = svg.getScreenCTM()!.a;
    for (const [x, y] of [[left, top], [left + w, top], [left, top + h], [left + w, top + h]]) {
      renderTrack(x, y);
      const arrow = svg.querySelector('[data-heading-arrow]')!;
      const [dx, dy, rotation] = arrow.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number);
      expect(rotation).toBe(heading);
      expect(arrow.closest('[data-track-annotation]')?.getAttribute('transform')).toContain(`translate(${x}, ${y})`);
      const angle = heading * Math.PI / 180;
      for (const [px, py] of [[0, -6], [0, -20], [-2.5, -16], [2.5, -16]]) {
        const screenX = (x - left) * scale + dx + px * Math.cos(angle) - py * Math.sin(angle);
        const screenY = (y - top) * scale + dy + px * Math.sin(angle) + py * Math.cos(angle);
        expect(screenX).toBeGreaterThanOrEqual(0.5 - 1e-8);
        expect(screenX).toBeLessThanOrEqual(width - 0.5 + 1e-8);
        expect(screenY).toBeGreaterThanOrEqual(0.5 - 1e-8);
        expect(screenY).toBeLessThanOrEqual(height - 0.5 + 1e-8);
      }
    }
  }
});
