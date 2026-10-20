import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { CHALLENGES } from '../config/challenges';
import { createSession, getSessionDifficulty, recordSessionEvents, SESSION_POINTS } from './session';

describe('short sessions', () => {
  it('starts a ten-operation shift and accepts only sensible goals', () => {
    expect(createSession()).toMatchObject({ goal: 10, status: 'active', points: 0, operations: 0 });
    expect(createSession(6).goal).toBe(6);
    expect(createSession(6.9).goal).toBe(6);
    for (const goal of [0, -1, NaN, Infinity]) expect(createSession(goal).goal).toBe(10);
  });

  it('scores safe operations once, adds a bounded streak bonus, and completes at the goal', () => {
    let session = createSession(8);
    session = recordSessionEvents(session, { successIds: ['a', 'a'] });
    expect(session).toMatchObject({ points: 100, operations: 1, streak: 1, bestStreak: 1 });
    session = recordSessionEvents(session, { successIds: ['a', 'b'] });
    expect(session).toMatchObject({ points: 210, operations: 2, streak: 2 });
    session = recordSessionEvents(session, { successIds: ['c', 'd', 'e', 'f', 'g', 'h', 'beyond-goal'] });
    expect(session).toMatchObject({ status: 'completed', operations: 8, streak: 8, points: 1050 });
    expect(session.resolvedIds).not.toContain('aircraft:beyond-goal');
    expect(recordSessionEvents(session, { successIds: ['later'], warning: true })).toBe(session);
    expect(session.points).toBeLessThanOrEqual(8 * (SESSION_POINTS.operation + SESSION_POINTS.maxStreakBonus));
  });

  it('penalizes a warning episode once rather than once per simulation tick', () => {
    let session = recordSessionEvents(createSession(), { successIds: ['a', 'b'] });
    session = recordSessionEvents(session, { warning: true });
    expect(session).toMatchObject({ points: 185, streak: 0, bestStreak: 2, warningEpisodes: 1 });
    for (let tick = 0; tick < 500; tick++) session = recordSessionEvents(session, { warning: true });
    expect(session).toMatchObject({ points: 185, warningEpisodes: 1 });
    session = recordSessionEvents(session, { warning: false });
    session = recordSessionEvents(session, { warning: true });
    expect(session).toMatchObject({ points: 160, warningEpisodes: 2 });
  });

  it('does not award a clean streak during an unresolved conflict', () => {
    let session = recordSessionEvents(createSession(), { warning: true, successIds: ['a', 'b'] });
    expect(session).toMatchObject({ points: 200, operations: 2, streak: 0, bestStreak: 0 });
    session = recordSessionEvents(session, { warning: false, successIds: ['c'] });
    expect(session).toMatchObject({ points: 300, streak: 1, bestStreak: 1 });
  });

  it('deduplicates missed exits and never allows negative points or a later success for that track', () => {
    let session = recordSessionEvents(createSession(), { successIds: ['a'] });
    session = recordSessionEvents(session, { missedExitIds: ['b', 'b', 'c', 'd'], warning: true });
    expect(session).toMatchObject({ points: 0, streak: 0, missedExits: 3, operations: 1 });
    session = recordSessionEvents(session, { missedExitIds: ['b'], successIds: ['b', 'a'] });
    expect(session).toMatchObject({ points: 0, missedExits: 3, operations: 1 });
  });

  it('gives an accident priority over the final success and freezes a failed shift', () => {
    const session = recordSessionEvents(createSession(1), {
      accidentIds: ['collision-a-b', 'collision-a-b'],
      successIds: ['c'],
    });
    expect(session).toMatchObject({ status: 'failed', operations: 0, accidents: 1, points: 0, streak: 0 });
    expect(recordSessionEvents(session, { accidentIds: ['collision-a-b'], successIds: ['c'] })).toBe(session);
  });

  it('does not mutate previous state or event arrays', () => {
    const state = createSession();
    const ids = ['a', 'a'];
    const next = recordSessionEvents(state, { successIds: ids });
    expect(state).toEqual(createSession());
    expect(ids).toEqual(['a', 'a']);
    expect(next.resolvedIds).toEqual(['aircraft:a']);
  });

  it('ramps difficulty at three and six operations, capped by the selected setting', () => {
    expect(getSessionDifficulty({ operations: 0 }, 'hard')).toBe('easy');
    expect(getSessionDifficulty({ operations: 2 }, 'hard')).toBe('easy');
    expect(getSessionDifficulty({ operations: 3 }, 'hard')).toBe('medium');
    expect(getSessionDifficulty({ operations: 6 }, 'hard')).toBe('hard');
    expect(getSessionDifficulty({ operations: 9 }, 'medium')).toBe('medium');
    expect(getSessionDifficulty({ operations: 9 }, 'easy')).toBe('easy');
  });
});

describe('challenge catalogue', () => {
  it('uses all six existing airports without duplicating airport geometry', () => {
    expect(CHALLENGES).toHaveLength(6);
    expect(new Set(CHALLENGES.map(c => c.id)).size).toBe(CHALLENGES.length);
    expect(new Set(CHALLENGES.map(c => c.airportId))).toEqual(new Set(AIRPORTS.map(a => a.id)));
    for (const challenge of CHALLENGES) {
      expect(challenge.goal).toBeGreaterThan(0);
      expect(challenge).not.toHaveProperty('runways');
      expect(challenge.description).toBeTruthy();
    }
  });
});
