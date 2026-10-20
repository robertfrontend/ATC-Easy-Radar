// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningPage } from './LearningPage';
import { PROGRESS_KEY, readProgress } from './progress';
import { scenarios } from './scenarios';

let root: Root;
let container: HTMLDivElement;
function HistoryControls() {
  const navigate = useNavigate();
  return createElement('div', {},
    createElement('button', { onClick: () => navigate(-1) }, 'Back'),
    createElement('button', { onClick: () => navigate(1) }, 'Forward'));
}
function mount(path = '/learning') {
  act(() => root.render(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(HistoryControls), createElement(Routes, {},
      createElement(Route, { path: '/learning/*', element: createElement(LearningPage) })))));
}
function click(text: string) {
  const element = Array.from(container.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a'))
    .find(item => item.textContent?.trim() === text);
  expect(element, text).toBeDefined();
  act(() => element!.click());
}
function reload(path: string) {
  act(() => root.unmount());
  root = createRoot(container);
  mount(path);
}
function complete(id: 'position' | 'identify' | 'readback') {
  for (const step of scenarios[id]!) {
    if (step.select) {
      const button = container.querySelector<HTMLButtonElement>('button[aria-label^="Seleccionar N731KB"]');
      act(() => button!.click());
    } else click(step.answer);
    click(step === scenarios[id]!.at(-1) ? 'Completar y comprobar resultado' : 'Continuar práctica');
  }
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe('Learning route and evidence integration', () => {
  it('completes all three practices, persists evidence and supports repeated/interrupted review', () => {
    mount();
    expect(container.querySelectorAll('nav[aria-label="Secciones de Learning"] a')).toHaveLength(7);
    click('Comenzar módulo 1');
    expect(readProgress(localStorage.getItem(PROGRESS_KEY)).modules.position).toEqual(['consulted']);
    click('Practicar en el radar');
    click(scenarios.position![0].answer);
    reload('/learning/module/position?practice=1');
    expect(container.textContent).toContain('1/3 · Observar');
    expect(container.textContent).toContain('Iniciado');
    complete('position');
    click('Siguiente: módulo 2');
    click('Practicar en el radar');
    const wrongTarget = container.querySelector<HTMLButtonElement>('button[aria-label^="Seleccionar N713KB"]');
    act(() => wrongTarget!.click());
    expect(container.textContent).toContain('Ese es N713KB');
    expect(container.textContent).not.toContain('Continuar práctica');
    complete('identify');
    click('Siguiente: módulo 3');
    click('Practicar en el radar');
    const selectedTarget = container.querySelector<HTMLButtonElement>('button[aria-label^="Seleccionar N731KB"]');
    act(() => selectedTarget!.click());
    click('Continuar práctica');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label^="Seleccionar N713KB"]')!.click());
    click(scenarios.readback![1].answer);
    expect(container.textContent).toContain('Comprueba la selección');
    expect(container.textContent).not.toContain('Continuar práctica');
    click('Reiniciar escenario');
    complete('readback');
    expect(container.textContent).toContain('Tiempo por pasos: 30 s');
    expect(container.textContent).toContain('Rumbo actual 090 / asignado 090');
    reload('/learning');
    expect(container.textContent).toContain('3/3 ejercicios demostrados');
    click('Práctica');
    click('1. Comprender el puesto radar y sus prioridades');
    click('Practicar en el radar');
    click('Reiniciar escenario');
    expect(container.textContent).toContain('1/3 · Observar');
    expect(container.textContent).toContain('3/3 ejercicios demostrados');
  });

  it('allows free consultation while guarding direct practice URLs and browser history', () => {
    localStorage.setItem(PROGRESS_KEY, 'corrupt');
    mount('/learning/module/readback?practice=1');
    expect(container.textContent).toContain('demuestra primero');
    expect(container.querySelector('.learning-radar')).toBeNull();
    click('Siguiente: módulo 4');
    expect(container.textContent).toContain('Práctica avanzada pendiente');
    click('Back');
    expect(container.querySelector('h1')?.textContent).toBe('Comunicar y comprobar readback');
    click('Forward');
    expect(container.querySelector('h1')?.textContent).toBe('Separar y anticipar conflictos');
    expect(document.activeElement).toBe(container.querySelector('h1'));
    click('Referencia');
    expect(container.textContent).toContain('20 de octubre de 2026');
    expect(readProgress(localStorage.getItem(PROGRESS_KEY)).modules.readback).toEqual(['consulted']);
  });

  it('reports storage failure and keeps the current session usable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    mount('/learning/module/position?practice=1');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar');
    complete('position');
    expect(container.textContent).toContain('1/3 ejercicios demostrados');
  });
});
