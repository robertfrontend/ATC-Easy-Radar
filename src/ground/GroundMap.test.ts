// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GroundMap } from './GroundMap';
import { createGroundState } from './simulation';
import { NODES } from './airport';

let root: Root | undefined;
let container: HTMLDivElement;
let scale: number;
let resize: () => void;
let originalMatrix: PropertyDescriptor | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  scale = .4;
  observe.mockClear(); disconnect.mockClear();
  originalMatrix = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'getScreenCTM');
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true, value: () => ({ a: scale, inverse: () => ({ a: 1 / scale }) }),
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  vi.stubGlobal('DOMPoint', class {
    constructor(public x: number, public y: number) {}
    matrixTransform(matrix: { a: number }) { return { x: this.x * matrix.a, y: this.y * matrix.a }; }
  });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  container.remove();
  if (originalMatrix) Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', originalMatrix);
  else delete (SVGSVGElement.prototype as unknown as Record<string, unknown>).getScreenCTM;
  vi.unstubAllGlobals();
});

it('measures the real letterboxed SVG projection, responds to resize and disconnects on unmount', () => {
  act(() => root!.render(createElement(GroundMap, { state: createGroundState(), selectedId: null, onSelect() {} })));
  expect(container.querySelector('[data-track-annotation]')?.getAttribute('data-inverse-scale')).toBe('2.5');
  expect(container.querySelector('[data-ground-track-hit]')?.getAttribute('r')).toBe('55');
  expect(observe).toHaveBeenCalledWith(container.querySelector('svg'));
  scale = .5;
  act(() => resize());
  expect(container.querySelector('[data-track-annotation]')?.getAttribute('data-inverse-scale')).toBe('2');
  act(() => root!.unmount()); root = undefined;
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it('chooses the nearest aircraft in overlapping screen-sized hit regions rather than the last painted track', () => {
  const state = createGroundState();
  state.aircraft.push({ ...structuredClone(state.aircraft[0]), id: 'GC303', position: { ...NODES['stand-2'] } });
  const onSelect = vi.fn();
  act(() => root!.render(createElement(GroundMap, { state, selectedId: null, onSelect })));
  const laterHit = container.querySelector('[data-aircraft-id="GC303"] [data-ground-track-hit]')!;
  // World x295 is35 units from GC101 and45 from GC303: inside both 55-unit hit regions.
  act(() => laterHit.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 118, clientY: 288 })));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith('GC101');
});
