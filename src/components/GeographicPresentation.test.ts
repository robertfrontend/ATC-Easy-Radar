// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { getGeographicAirport } from '../geography/kbos';
import { createRadarDomain } from '../utils/radarBounds';
import { RadarDisplay } from './RadarDisplay';
import { GeographicSector, localizerCaptionOffsets } from './GeographicSector';
import { SectorPreview } from './SectorPreview';

vi.mock('../utils/audio', () => ({ audioManager: { playRadio: vi.fn(), playSelect: vi.fn() } }));

const boston = getGeographicAirport(AIRPORTS.find(airport => airport.icao === 'KBOS')!);
const operations = Object.fromEntries(boston.runways.map(runway => [runway.id, { landing: true, departure: true }]));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function radar() {
  act(() => root.render(createElement(RadarDisplay, { airport: boston, runwayConfig: operations, planes: [], selectedId: null, onSelect: vi.fn() })));
}
it('renders the approved scoped geographic terrain, six physical surfaces and only available operative LOC axes', () => {
  radar();
  expect(container.querySelector('[data-airport-theme="kbos"]')).not.toBeNull();
  expect(container.querySelector('[data-geographic-terrain]')).not.toBeNull();
  expect(container.querySelectorAll('[data-physical-runway]')).toHaveLength(6);
  for (const runway of boston.geographic!.physicalRunways) {
    const line = container.querySelector(`[data-physical-runway="${runway.id}"]`)!;
    expect(['x1', 'y1', 'x2', 'y2'].map(key => Number(line.getAttribute(key))))
      .toEqual([runway.ends[0].position.x, runway.ends[0].position.y, runway.ends[1].position.x, runway.ends[1].position.y]);
  }
  expect([...container.querySelectorAll('[data-localizer]')].map(element => element.getAttribute('data-localizer')))
    .toEqual(['04R', '15R', '27', '33L']);
  expect(container.querySelector('[data-localizer="22L"] [role="button"]')).toBeNull();
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('108 108 784 784');
  expect(container.querySelector('rect[rx="24"], pattern')).toBeNull();
  expect(container.textContent).not.toContain('DEMO');
  expect(container.textContent).toContain('33L');
  expect(container.textContent).toContain('restricted');
  expect(container.textContent).toContain('15R');
  expect(container.textContent).toContain('not for navigation');
});
it('keeps operational fixes interactive but context fixes and hold existence markers non-operative', () => {
  radar();
  expect(container.querySelectorAll('[data-radar-action="direct-fix"]')).toHaveLength(9);
  const context = [...container.querySelectorAll('[data-context-fix]')];
  expect(context.map(element => element.getAttribute('data-context-fix'))).toEqual(['SOSYO', 'WHYBE']);
  for (const element of context) {
    expect(element.getAttribute('role')).toBeNull();
    expect(element.querySelector('[role="button"]')).toBeNull();
  }
  expect(container.querySelectorAll('[data-hold-reference]')).toHaveLength(2);
  expect(container.querySelector('[role="button"][aria-label*="ILS 22L"]')).toBeNull();
  expect(container.querySelector('[data-geographic-terrain] clipPath')).not.toBeNull();
  expect(container.querySelector('[data-geographic-terrain] > polygon')?.getAttribute('points'))
    .toBe(boston.geographic!.coverage.water.worldRing.map(point => `${point.x},${point.y}`).join(' '));
  expect(container.textContent).toContain('Black outside sourced map coverage');
  expect(container.textContent).toContain('source references only');
});
it('reuses projected KBOS geography and the common 35 NM core in the accessible Home preview', () => {
  const canonical = AIRPORTS.find(airport => airport.icao === 'KBOS')!;
  act(() => root.render(createElement(SectorPreview, { airport: canonical, runwayConfig: operations, compact: true })));
  const svg = container.querySelector('svg[role="img"]')!;
  expect(svg.getAttribute('viewBox')).toBe('108 108 784 784');
  expect(svg.querySelectorAll('[data-physical-runway]')).toHaveLength(6);
  expect(svg.querySelectorAll('[data-localizer]')).toHaveLength(4);
  expect(svg.querySelector('[data-geographic-terrain]')).not.toBeNull();
  for (const waypoint of boston.waypoints) {
    expect(svg.querySelector(`[data-preview-fix="${waypoint.id}"]`)?.getAttribute('transform')).toContain(`translate(${waypoint.x}, ${waypoint.y})`);
  }
  expect(container.querySelector('[data-airport-theme="kbos"]')).not.toBeNull();
  expect(container.textContent).toContain('MassGIS');
});
it('leaves non-KBOS previews on their existing geometry and theme', () => {
  const airport = AIRPORTS.find(item => item.icao !== 'KBOS')!;
  act(() => root.render(createElement(SectorPreview, { airport, runwayConfig: {} })));
  expect(container.querySelector('[data-geographic-terrain], [data-airport-theme="kbos"]')).toBeNull();
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1000 1000');
});

it('keeps the four existing operative LOC actions and transmits their shared axis point, never 22L', () => {
  const onCommand = vi.fn();
  const plane = { id: 'fixture', callsign: 'REALTEST', type: 'arrival', x: 450, y: 450, heading: 90,
    targetHeading: 90, altitude: 5000, targetAltitude: 5000, speed: 200, targetSpeed: 200,
    trail: [], status: 'normal', isEstablished: false, hasInstructions: true, model: 'A320', squawk: '1200', originFlag: '' } as const;
  act(() => root.render(createElement(RadarDisplay, { airport: boston, runwayConfig: operations,
    planes: [{ ...plane, trail: [] }], selectedId: plane.id, onSelect: vi.fn(), onCommand })));
  const actions = [...container.querySelectorAll<SVGGElement>('[data-radar-action="ils-fix"]')];
  expect(actions).toHaveLength(4);
  expect(actions.some(element => element.getAttribute('aria-label')?.includes('22L'))).toBe(false);
  const action = actions.find(element => element.getAttribute('aria-label')?.includes('15R'))!;
  act(() => action.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(plane.id, expect.objectContaining({ assignedRunwayId: 'bos-15r', targetWaypoint: null }));
});

it('resolves canvas colors from the scoped canvas rather than leaking the root green theme', () => {
  radar();
  const svg = container.querySelector('svg')!;
  const canvas = container.querySelector('canvas')!;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 784, height: 784, left: 0, top: 0 } as DOMRect);
  Object.defineProperty(svg, 'getScreenCTM', { value: () => ({}) });
  Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }) });
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key as keyof typeof target] : vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as CanvasRenderingContext2D);
  const colors = vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(element => ({
    getPropertyValue: () => element === canvas ? '#78b8ff' : '#00ff00',
  }) as unknown as CSSStyleDeclaration);
  const draw = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  act(() => draw(100));
  expect(colors).toHaveBeenCalledWith(canvas);
  expect(colors).not.toHaveBeenCalledWith(document.documentElement);
  expect(canvas.className).toContain('z-20');
});


function assertReferenceSeparation(svg: SVGSVGElement, width: number, preview = false) {
  const [viewX, viewY, viewWidth] = svg.getAttribute('viewBox')!.split(' ').map(Number);
  const screenScale = width / viewWidth;
  const box = (annotation: Element, label: SVGTextElement) => {
    const transform = annotation.getAttribute('transform')!;
    const point = /translate\(([-.\d]+), ([-.\d]+)\)/.exec(transform)!;
    const scale = /scale\(([-.\d]+)\)/.exec(transform) ?? /scale\(([-.\d]+)\)/.exec(label.parentElement?.getAttribute('transform') ?? '');
    const labelScale = Number(scale?.[1] ?? 1) * screenScale;
    const labelWidth = label.textContent!.trim().replace(/\s+/g, ' ').length * 6.03 * labelScale;
    const x = (Number(point[1]) - viewX) * screenScale + Number(label.getAttribute('x')) * labelScale;
    const y = (Number(point[2]) - viewY) * screenScale + Number(label.getAttribute('y')) * labelScale;
    return { left: label.getAttribute('text-anchor') === 'end' ? x - labelWidth : x,
      right: x + (label.getAttribute('text-anchor') === 'end' ? 0 : labelWidth), top: y - 10 * labelScale, bottom: y + 2 * labelScale };
  };
  for (const [runway, fix] of [['27', 'KLANE'], ['15R', 'WOBUR'], ['33L', 'MYNOT']]) {
    const localizer = svg.querySelector(`[data-localizer="${runway}"] > g`)!;
    const waypoint = svg.querySelector(preview ? `[data-preview-fix="KBOS-${fix}"]` : `[aria-label="Transmit direct to ${fix}"]`)!;
    const first = box(localizer, localizer.querySelector('text')!);
    const second = box(waypoint, waypoint.querySelector('text')!);
    expect(first.right < second.left || first.left > second.right || first.bottom < second.top || first.top > second.bottom,
      `${preview ? 'Home' : 'game'} ${runway}/${fix}: ${JSON.stringify({ first, second })}`).toBe(true);
  }
}

it('separates mobile LOC and real-fix labels across frozen desktop profiles and compact Home', () => {
  for (const aspect of [1.25, 1.6, 1.8, 2.2]) {
    for (const width of [390, 433]) {
      act(() => root.render(createElement(RadarDisplay, { airport: boston, domain: createRadarDomain(aspect, 392),
        runwayConfig: operations, planes: [], selectedId: null, onSelect: vi.fn() })));
      const svg = container.querySelector('svg')!;
      vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width, height: width } as DOMRect);
      act(() => window.dispatchEvent(new Event('resize')));
      assertReferenceSeparation(svg, width);
    }
  }
  act(() => root.render(createElement(SectorPreview, { airport: boston, runwayConfig: operations, compact: true })));
  assertReferenceSeparation(container.querySelector('svg')!, 286, true);
});


it('reactively removes complete inactive LOC groups, captions and source detail rows in game and Home', () => {
  const only = (id: string) => ({ [id]: { landing: true, departure: false } });
  const takeoffOnly = Object.fromEntries(boston.runways.map(runway => [runway.id, { landing: false, departure: true }]));
  for (const preview of [false, true]) {
    for (const [config, expected] of [[operations, ['04R', '15R', '27', '33L']], [{}, []],
      [takeoffOnly, []], [only('bos-33l'), ['33L']], [only('bos-15r'), ['15R']],
      [only('nonexistent'), []]] as const) {
      act(() => root.render(preview
        ? createElement(SectorPreview, { airport: boston, runwayConfig: config })
        : createElement(RadarDisplay, { airport: boston, runwayConfig: config, planes: [], selectedId: null, onSelect: vi.fn() })));
      expect([...container.querySelectorAll('[data-localizer]')].map(group => group.getAttribute('data-localizer'))).toEqual(expected);
      expect(container.querySelectorAll('[data-geographic-notice] li')).toHaveLength(expected.length);
      for (const inactive of ['04R', '15R', '22L', '27', '33L'].filter(end => !(expected as readonly string[]).includes(end))) {
        expect(container.querySelector('svg')!.textContent).not.toContain(`ILS ${inactive}`);
        expect(container.querySelector('[data-geographic-notice]')!.textContent).not.toContain(`ILS ${inactive}`);
      }
      const captions = localizerCaptionOffsets(boston, 1, { x: 108, y: 108, w: 784, h: 784 }, config);
      expect(Object.keys(captions).sort()).toEqual([...expected].sort());
    }
  }
  expect(boston.geographic!.localizers).toHaveLength(5);
  expect(boston.geographic!.localizers.find(loc => loc.runwayEnd === '33L')!.status).toContain('RESTRICTED');
});

it('rejects reference-only LOCs even when their operative id and landing config exist', () => {
  const airport = { ...boston, geographic: { ...boston.geographic!, localizers: [
    { ...boston.geographic!.localizers[0], referenceOnly: true },
    { ...boston.geographic!.localizers[0], operativeRunwayId: 'missing' },
  ] } };
  act(() => root.render(createElement('svg', {}, createElement(GeographicSector, {
    airport, annotationScale: 1, runwayConfig: { ...operations, missing: { landing: true, departure: true } },
  }))));
  expect(container.querySelectorAll('[data-localizer]')).toHaveLength(0);
});

it('keeps legacy operative ILS actions landing-gated rather than takeoff-gated', () => {
  const airport = AIRPORTS.find(item => item.icao !== 'KBOS')!;
  for (const landing of [false, true, false]) {
    const config = Object.fromEntries(airport.runways.map(runway => [runway.id, { landing, departure: true }]));
    act(() => root.render(createElement(RadarDisplay, { airport, runwayConfig: config, planes: [], selectedId: null, onSelect: vi.fn() })));
    expect(container.querySelectorAll('[data-radar-action="ils-fix"]')).toHaveLength(landing ? airport.runways.length : 0);
  }
});
