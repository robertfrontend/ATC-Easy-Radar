// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { CHALLENGE_PROGRESS_KEY, readChallengeProgress } from './model';
import { useChallengeProgress } from './useChallengeProgress';

let root: Root, container: HTMLDivElement, progress: ReturnType<typeof useChallengeProgress>;
function Harness() { progress = useChallengeProgress(); return null; }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it('recovers corrupt data, merges newer airport progress from another tab and leaves other keys untouched', () => {
  localStorage.setItem(CHALLENGE_PROGRESS_KEY, '{');
  localStorage.setItem('atc_learning_progress', 'keep-learning');
  act(() => root.render(createElement(Harness)));
  expect(progress.progress.completed).toEqual({});
  const first = AIRPORTS[0].id, second = AIRPORTS[1].id;
  localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify({ version: 1, completed: { [second]: 3 } }));
  act(() => progress.recordCompletion(first, 1));
  expect(readChallengeProgress(localStorage.getItem(CHALLENGE_PROGRESS_KEY)).completed).toEqual({ [first]: 1, [second]: 3 });
  expect(localStorage.getItem('atc_learning_progress')).toBe('keep-learning');
  act(() => progress.recordCompletion(first, 3));
  expect(progress.progress.completed[first]).toBe(1);
});

it('retains in-session unlock and reports a failed local save without claiming it persisted', () => {
  act(() => root.render(createElement(Harness)));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  act(() => progress.recordCompletion(AIRPORTS[0].id, 1));
  expect(progress.storageError).toBe(true);
  expect(progress.progress.completed[AIRPORTS[0].id]).toBe(1);
  expect(localStorage.getItem(CHALLENGE_PROGRESS_KEY)).toBeNull();
});
