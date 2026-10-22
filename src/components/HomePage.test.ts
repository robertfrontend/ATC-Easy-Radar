// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { AIRPORTS } from '../config/airports';

vi.mock('./GamePage', () => ({ GamePage: ({ mode, onExit }) => createElement('button', { onClick: onExit }, `Exit ${mode}`) }));
let root: Root;
let container: HTMLDivElement;
function click(label: string) {
  const target = [...container.querySelectorAll<HTMLElement>('button,a')].find(el => el.getAttribute('aria-label') === label || el.textContent?.trim() === label);
  expect(target, label).toBeDefined();
  act(() => target!.click());
}
function button(label: string) {
  return [...container.querySelectorAll('button')].find(el => el.textContent?.startsWith(label))!;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(App)));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it('offers three destinations without exposing setup or competing launch actions', () => {
  expect([...container.querySelectorAll('[aria-label="Choose an experience"] a')].map(el => el.getAttribute('aria-label')))
    .toEqual(['Jugar libre', 'Retos', 'Learning']);
  expect(container.textContent).not.toContain('Select Control Sector');
  expect(container.textContent).not.toContain('START FIVE-MINUTE SHIFT');
  click('¿Primera vez? Aprende los controles');
  expect(container.textContent).toContain('Exit tutorial');
});

it('preserves airport, difficulty, runway toggles and shift goal across cancellation and route remount', () => {
  localStorage.setItem('atc_learning_progress', 'untouched');
  click('Jugar libre');
  expect(document.activeElement?.textContent).toBe('Prepare free play');
  act(() => button('KBOS').click());
  act(() => button('HARD').click());
  click('FULL OPS');
  click('Five-minute shift');
  const goal = container.querySelector('input[type="number"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(goal, '12');
    goal.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const pressedRunways = () => [...container.querySelectorAll('[title="Toggle ILS Approach Landing"]')].map(el => el.getAttribute('aria-pressed'));
  const expectedRunways = pressedRunways();
  expect(expectedRunways.length).toBeGreaterThan(1);
  expect(expectedRunways.every(value => value === 'true')).toBe(true);
  act(() => button('KBOS').click());
  expect(pressedRunways()).toEqual(expectedRunways);
  click('Cancel');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Jugar libre');
  click('Jugar libre');
  expect(button('KBOS').getAttribute('aria-pressed')).toBe('true');
  expect(button('HARD').getAttribute('aria-pressed')).toBe('true');
  expect(pressedRunways()).toEqual(expectedRunways);
  expect((container.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('12');
  click('START FIVE-MINUTE SHIFT');
  expect(window.location.search).toContain('goal=12');
  click('Exit shift');
  click('Jugar libre');
  expect(button('KBOS').getAttribute('aria-pressed')).toBe('true');
  expect(pressedRunways()).toEqual(expectedRunways);
  expect(localStorage.getItem('atc_learning_progress')).toBe('untouched');
});

it('defaults to free play and supports preparation through browser history', () => {
  click('Jugar libre');
  expect(container.textContent).toContain('START FREE PLAY');
  act(() => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(container.textContent).not.toContain('Select Control Sector');
  act(() => { window.history.replaceState(null, '', '/?setup=free'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(container.textContent).toContain('START FREE PLAY');
  click('START FREE PLAY');
  expect(container.textContent).toContain('Exit free');
});


it('shows an accessible static airport preview after the destinations and tutorial, without launching a game', () => {
  const preview = container.querySelector('svg[role="img"]');
  expect(preview).not.toBeNull();
  expect(preview?.querySelector('title')?.textContent).toBe(`${AIRPORTS[0].icao} radar sector preview`);
  expect(preview?.querySelector('desc')?.textContent).toContain('Static airport layout');
  expect(preview?.getAttribute('aria-labelledby')).toBe(preview?.querySelector('title')?.id);
  expect(preview?.getAttribute('aria-describedby')).toBe(preview?.querySelector('desc')?.id);
  expect(preview?.getAttribute('viewBox')).toBe('0 0 1000 1000');
  expect(preview?.querySelector('rect[x="0"][y="0"]')?.getAttribute('width')).toBe('1000');
  expect(preview?.querySelectorAll('animate, animateTransform').length).toBe(0);
  const rings = [...preview!.querySelectorAll('circle[cx="500"][cy="500"]')];
  expect(rings).toHaveLength(0);
  expect(preview?.querySelector('rect[x="0"][y="0"]')?.getAttribute('fill')).toBe('var(--color-scope)');
  expect(preview?.querySelector('pattern, [data-sector-grid], rect[fill^="url("]')).toBeNull();
  expect(preview?.querySelector('desc')?.textContent).not.toContain('grid');
  for (const waypoint of AIRPORTS[0].waypoints) {
    expect(preview?.textContent).toContain(waypoint.label);
    expect(preview?.querySelector(`g[transform="translate(${waypoint.x}, ${waypoint.y})"] circle[r="7"]`)).not.toBeNull();
  }
  const tutorial = [...container.querySelectorAll('button')].find(el => el.textContent?.includes('¿Primera vez?'))!;
  expect(tutorial.compareDocumentPosition(preview!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.textContent).toContain('Static sector preview');
  expect(container.textContent).not.toContain('Live Sector');
  expect(container.textContent).not.toContain('Exit free');
  expect(container.querySelector('input')).toBeNull();
});

it('reuses the selected airport preview in preparation and after cancelling without changing the setup', () => {
  click('Jugar libre');
  act(() => button('KBOS').click());
  const title = () => container.querySelector('svg[role="img"] title')?.textContent;
  expect(title()).toBe('KBOS radar sector preview');
  expect(container.querySelectorAll('svg[role="img"]').length).toBe(1);
  click('Cancel');
  expect(title()).toBe('KBOS radar sector preview');
  expect(container.querySelectorAll('svg[role="img"]').length).toBe(1);
  click('Jugar libre');
  expect(button('KBOS').getAttribute('aria-pressed')).toBe('true');
  expect(title()).toBe('KBOS radar sector preview');
});

it('uses the shared KBOS operational metadata and magnetic runway readouts without changing defaults', () => {
  click('Jugar libre');
  const legacy = AIRPORTS[0];
  expect(button(legacy.icao).textContent).toContain(`${legacy.waypoints.length} FIXES`);
  const canonical = JSON.stringify(AIRPORTS);
  act(() => button('KBOS').click());
  expect(button('KBOS').textContent).toContain('9 FIXES');
  expect(container.textContent).toContain('RWY 27 (272°)');
  expect(container.textContent).toContain('RWY 04R (035°)');
  const ils = [...container.querySelectorAll('[title="Toggle ILS Approach Landing"]')];
  expect(ils.map(el => el.getAttribute('aria-label'))).toEqual([
    'Runway 33L ILS', 'Runway 27 ILS', 'Runway 04R ILS', 'Runway 15R ILS',
  ]);
  expect(ils.map(el => el.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
  expect(JSON.stringify(AIRPORTS)).toBe(canonical);
});
