import { describe, expect, it } from 'vitest';
import { lessons } from './content';
import { canPractice, progressLabel, readProgress, recordEvidence } from './progress';

describe('Learning evidence and prerequisites', () => {
  it('recovers from missing, malformed and future storage without trusting evidence', () => {
    for (const raw of [null, '{', 'null', '[]', '{"version":2,"modules":{"position":["demonstrated"]}}']) {
      expect(readProgress(raw)).toEqual({ version: 1, modules: {} });
    }
    const result = readProgress(JSON.stringify({ version: 1, modules: {
      position: ['demonstrated'], identify: ['consulted', 'invented'], readback: 'demonstrated',
      unknown: ['consulted', 'started', 'demonstrated'],
    } }));
    expect(result.modules).toEqual({ position: [], identify: ['consulted'] });
  });

  it('never awards demonstration for a visit or a start, and round-trips progress', () => {
    let progress = readProgress(null);
    expect(canPractice(progress, 'position')).toBe(true);
    expect(canPractice(progress, 'identify')).toBe(false);
    expect(recordEvidence(progress, 'position', 'demonstrated')).toBe(progress);
    progress = recordEvidence(progress, 'position', 'consulted');
    expect(progressLabel(progress, 'position')).toBe('Consultado');
    expect(canPractice(progress, 'identify')).toBe(false);
    progress = recordEvidence(progress, 'position', 'started');
    expect(progressLabel(progress, 'position')).toBe('Iniciado');
    progress = recordEvidence(progress, 'position', 'demonstrated');
    expect(progressLabel(progress, 'position')).toContain('Demostrado');
    expect(canPractice(readProgress(JSON.stringify(progress)), 'identify')).toBe(true);
    expect(recordEvidence(progress, 'position', 'demonstrated')).toBe(progress);
    expect(canPractice(progress, 'readback')).toBe(false);
  });

  it('keeps the eight-module route unique and advanced practice unavailable', () => {
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(8);
    const progress = { version: 1 as const, modules: {} };
    for (const lesson of lessons.slice(3)) expect(canPractice(progress, lesson.id)).toBe(false);
  });
});
