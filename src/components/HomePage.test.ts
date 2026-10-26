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

it('frames the landing around the Boston backdrop and a clear Spanish primary action', () => {
  const hero = container.querySelector('section.landing-hero');
  expect(hero).not.toBeNull();
  expect(hero?.querySelector('h1')?.textContent).toBe('Toma el control del radar');
  expect(hero?.querySelector('[data-decorative-airport="KBOS"]')).not.toBeNull();
  expect(hero?.querySelector('.landing-radar-frame, svg[role="img"]')).toBeNull();
  expect(hero?.textContent).not.toContain('VISTA DEL SECTOR');
  expect(container.querySelector('a[aria-label="Jugar libre"]')?.textContent).toContain('Iniciar práctica');
  expect(container.querySelector('[aria-label="Choose an experience"]')).not.toBeNull();
});

it('keeps the Boston backdrop decorative while airport metadata follows the selected sector', () => {
  const backdrop = container.querySelector('[data-decorative-airport="KBOS"]');
  expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
  expect(backdrop?.querySelector('[data-geographic-terrain="true"]')).not.toBeNull();
  expect(backdrop?.querySelector('svg > g[transform="translate(0 1000) scale(1 -1)"]')).not.toBeNull();
  expect(backdrop?.querySelectorAll('[data-physical-runway]')).toHaveLength(6);
  expect(backdrop?.querySelector('svg[role], [role="button"], [tabindex], a, button, input')).toBeNull();
  expect(container.querySelector('.landing-eyebrow')?.textContent).toContain(AIRPORTS[0].icao);
  expect(container.querySelector('.landing-sector-meta')?.textContent).toContain(AIRPORTS[0].name);
  expect(container.querySelector('.landing-sector-meta')?.textContent).toContain('4 pistas');
  expect(container.querySelector('.landing-radar-frame')).toBeNull();

  click('Jugar libre');
  act(() => button('KBOS').click());
  click('Cancel');
  expect(container.querySelector('[data-decorative-airport="KBOS"]')).not.toBeNull();
  expect(container.querySelector('.landing-eyebrow')?.textContent).toContain('KBOS');
  expect(container.querySelector('.landing-sector-meta')?.textContent).toContain('Logan Intl Airport');
  expect(container.querySelector('.landing-sector-meta')?.textContent).toContain('4 pistas');
  expect(container.querySelector('.landing-radar-frame')).toBeNull();
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


it('keeps the landing free of a foreground airport panel without launching a game', () => {
  expect(container.querySelector('.landing-radar-frame')).toBeNull();
  expect(container.querySelector('.landing-radar-label')).toBeNull();
  expect(container.querySelector('section.landing-hero svg[role="img"]')).toBeNull();
  expect(container.querySelector('[data-decorative-airport="KBOS"]')?.getAttribute('aria-hidden')).toBe('true');
  const tutorial = [...container.querySelectorAll('button')].find(el => el.textContent?.includes('¿Primera vez?'))!;
  expect(tutorial).toBeDefined();
  expect(container.textContent).not.toContain('VISTA DEL SECTOR');
  expect(container.textContent).not.toContain('Static sector preview');
  expect(container.textContent).not.toContain('Exit free');
  expect(container.querySelector('input')).toBeNull();
});

it('uses the selected airport preview in setup but returns to the backdrop-only landing', () => {
  click('Jugar libre');
  act(() => button('KBOS').click());
  const title = () => container.querySelector('svg[role="img"] title')?.textContent;
  expect(title()).toBe('KBOS radar sector preview');
  expect(container.querySelectorAll('svg[role="img"]').length).toBe(1);
  click('Cancel');
  expect(title()).toBeUndefined();
  expect(container.querySelectorAll('svg[role="img"]').length).toBe(0);
  expect(container.querySelector('[data-decorative-airport="KBOS"]')).not.toBeNull();
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
