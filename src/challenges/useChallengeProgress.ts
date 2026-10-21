import { useCallback, useEffect, useRef, useState } from 'react';
import { CHALLENGE_PROGRESS_KEY, completeLevel, readChallengeProgress } from './model';

export function useChallengeProgress() {
  const [progress, setProgress] = useState(() => {
    try { return readChallengeProgress(localStorage.getItem(CHALLENGE_PROGRESS_KEY)); }
    catch { return readChallengeProgress(null); }
  });
  const [storageError, setStorageError] = useState(false);
  const current = useRef(progress);
  current.current = progress;
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CHALLENGE_PROGRESS_KEY) setProgress(readChallengeProgress(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const recordCompletion = useCallback((airportId: string, level: number) => {
    if (level <= (current.current.completed[airportId] ?? 0)) return;
    let merged = current.current;
    try {
      const disk = readChallengeProgress(localStorage.getItem(CHALLENGE_PROGRESS_KEY));
      merged = { version: 1, completed: { ...disk.completed } };
      for (const [id, frontier] of Object.entries(current.current.completed)) {
        merged.completed[id] = Math.max(frontier, merged.completed[id] ?? 0);
      }
    } catch { /* Keep the in-memory result when storage is unavailable. */ }
    const next = completeLevel(merged, airportId, level);
    current.current = next;
    setProgress(next);
    try {
      localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, []);
  return { progress, storageError, recordCompletion };
}
