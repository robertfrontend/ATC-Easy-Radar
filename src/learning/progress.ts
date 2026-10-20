import { lessons, ModuleId } from './content';

export const PROGRESS_KEY = 'atc_learning_progress';
export type Evidence = 'consulted' | 'started' | 'demonstrated';
export type Progress = { version: 1; modules: Partial<Record<ModuleId, Evidence[]>> };
const empty = (): Progress => ({ version: 1, modules: {} });
const evidence: Evidence[] = ['consulted', 'started', 'demonstrated'];

/** Validate every known entry; corrupt or future data must never unlock practice. */
export function readProgress(raw: string | null): Progress {
  try {
    const parsed = JSON.parse(raw ?? 'null');
    if (parsed?.version !== 1 || !parsed.modules || typeof parsed.modules !== 'object') return empty();
    const result = empty();
    for (const lesson of lessons) {
      const entry = parsed.modules[lesson.id];
      if (!Array.isArray(entry)) continue;
      const valid = evidence.filter(value => entry.includes(value));
      // Demonstration requires the other two pieces of evidence as well.
      result.modules[lesson.id] = valid.includes('consulted') && valid.includes('started')
        ? valid : valid.filter(value => value !== 'demonstrated');
    }
    return result;
  } catch {
    return empty();
  }
}

export function recordEvidence(progress: Progress, id: ModuleId, value: Evidence): Progress {
  const current = progress.modules[id] ?? [];
  if (current.includes(value)) return progress;
  if (value === 'demonstrated' && (!current.includes('started') || !current.includes('consulted'))) return progress;
  return { version: 1, modules: { ...progress.modules, [id]: [...current, value] } };
}

export function canPractice(progress: Progress, id: ModuleId): boolean {
  const index = lessons.findIndex(lesson => lesson.id === id);
  return index >= 0 && lessons[index].practice
    && lessons.slice(0, index).every(lesson => progress.modules[lesson.id]?.includes('demonstrated'));
}

export function progressLabel(progress: Progress, id: ModuleId): string {
  const values = progress.modules[id] ?? [];
  if (values.includes('demonstrated')) return 'Demostrado en ejercicio guiado';
  if (values.includes('started')) return 'Iniciado';
  return values.includes('consulted') ? 'Consultado' : 'Sin consultar';
}
