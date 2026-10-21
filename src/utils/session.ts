import { Difficulty } from '../types';

export type SessionStatus = 'active' | 'completed' | 'failed';

export interface SessionState {
  status: SessionStatus;
  goal: number;
  operations: number;
  points: number;
  streak: number;
  bestStreak: number;
  warningEpisodes: number;
  missedExits: number;
  accidents: number;
  /** Internal receipt IDs make replaying a simulation result harmless. */
  resolvedIds: string[];
  warningActive: boolean;
}

export interface SessionEvents {
  /** Stable aircraft IDs, emitted when an arrival lands or a departure hands off. */
  successIds?: readonly string[];
  /** Stable aircraft IDs, emitted when a departure leaves without a handoff. */
  missedExitIds?: readonly string[];
  /** Stable incident IDs. Any accident ends the shift. */
  accidentIds?: readonly string[];
  /** Current separation state, not a new warning on every simulation tick. */
  warning?: boolean;
}

export const SESSION_POINTS = {
  operation: 100,
  streakStep: 10,
  maxStreakBonus: 50,
  warning: 25,
  missedExit: 50,
} as const;

export function createSession(goal = 10): SessionState {
  return {
    status: 'active',
    goal: Number.isFinite(goal) && goal >= 1 ? Math.floor(goal) : 10,
    operations: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    warningEpisodes: 0,
    missedExits: 0,
    accidents: 0,
    resolvedIds: [],
    warningActive: false,
  };
}

/**
 * Pure tick reducer. Resolve safety events before successes: a collision and the
 * final landing on the same tick must not turn a failed shift into a win.
 * Keep the receipt IDs for the life of a shift, then discard them on restart.
 */
export function recordSessionEvents(state: SessionState, events: SessionEvents, completeOnQuota = true): SessionState {
  if (state.status !== 'active') return state;

  const next = { ...state, resolvedIds: [...state.resolvedIds] };
  const resolved = new Set(next.resolvedIds);
  const accept = (kind: string, id: string) => {
    if (!id) return false;
    const key = `${kind}:${id}`;
    if (resolved.has(key)) return false;
    resolved.add(key);
    next.resolvedIds.push(key);
    return true;
  };

  if (events.warning !== undefined) {
    if (events.warning && !state.warningActive) {
      next.warningEpisodes += 1;
      next.points = Math.max(0, next.points - SESSION_POINTS.warning);
      next.streak = 0;
    }
    next.warningActive = events.warning;
  }

  for (const id of events.accidentIds ?? []) {
    if (accept('incident', id)) next.accidents += 1;
  }
  if (next.accidents > state.accidents) {
    next.status = 'failed';
    next.streak = 0;
    return next;
  }

  for (const id of events.missedExitIds ?? []) {
    if (!accept('aircraft', id)) continue;
    next.missedExits += 1;
    next.points = Math.max(0, next.points - SESSION_POINTS.missedExit);
    next.streak = 0;
  }

  for (const id of events.successIds ?? []) {
    if (!accept('aircraft', id)) continue;
    next.operations += 1;
    // An operation during an unresolved warning is not part of a clean streak.
    if (!next.warningActive) {
      next.streak += 1;
      next.bestStreak = Math.max(next.bestStreak, next.streak);
    }
    const bonus = next.warningActive ? 0 : Math.min(
      SESSION_POINTS.maxStreakBonus,
      Math.max(0, next.streak - 1) * SESSION_POINTS.streakStep,
    );
    next.points += SESSION_POINTS.operation + bonus;
    if (completeOnQuota && next.operations >= next.goal) {
      next.status = 'completed';
      break;
    }
  }

  return next;
}

/** Ramp traffic without silently raising the difficulty chosen by the player. */
export function getSessionDifficulty(state: Pick<SessionState, 'operations'>, selectedCap: Difficulty): Difficulty {
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];
  const progressLevel = state.operations >= 6 ? 2 : state.operations >= 3 ? 1 : 0;
  return levels[Math.min(progressLevel, levels.indexOf(selectedCap))];
}
