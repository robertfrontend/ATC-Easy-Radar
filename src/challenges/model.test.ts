import { describe, expect, it } from 'vitest';
import { AIRPORTS } from '../config/airports';
import { challengeResult, challengeRunways, completeLevel, getIntensity, isLevelUnlocked, nextLevel, readChallengeProgress } from './model';

describe('120 airport intensity configurations', () => {
  for (const airport of AIRPORTS) {
    for (let level = 1; level <= 20; level++) {
      it(`${airport.id} level ${level} has bounded monotonic intensity and five-minute results`, () => {
        const profile = getIntensity(airport.id, level)!;
        expect(profile.minimumOperations).toBe(Math.ceil(level / 5));
        expect(profile.spawnIntervalMs).toBeGreaterThanOrEqual(8000);
        expect(profile.maxPlanes).toBeLessThanOrEqual(13);
        expect(profile.departureProbability).toBeGreaterThan(0);
        if (level > 1) {
          const previous = getIntensity(airport.id, level - 1)!;
          expect(profile.spawnIntervalMs).toBeLessThan(previous.spawnIntervalMs);
          expect(profile.maxPlanes).toBeGreaterThanOrEqual(previous.maxPlanes);
          expect(profile.departureProbability).toBeLessThan(previous.departureProbability);
        }
        expect(challengeResult(299999, 0, 999, profile.minimumOperations)).toBe('active');
        expect(challengeResult(300000, 0, profile.minimumOperations, profile.minimumOperations)).toBe('completed');
        expect(challengeResult(300000, 0, profile.minimumOperations - 1, profile.minimumOperations)).toBe('failed');
        expect(challengeResult(300000, 1, 999, profile.minimumOperations)).toBe('failed');
        const config = challengeRunways(airport);
        expect(Object.values(config).filter(value => value.landing && value.departure)).toHaveLength(1);
      });
    }
  }
});

describe('independent versioned challenge progress', () => {
  it('rejects malformed, unknown, fractional and out-of-range progress', () => {
    for (const raw of [null, '{', 'null', '{"version":2,"completed":{"las-americas":20}}']) {
      expect(readChallengeProgress(raw)).toEqual({ version: 1, completed: {} });
    }
    expect(readChallengeProgress(JSON.stringify({ version: 1, completed: {
      'las-americas': 21, 'panama-pty': -1, 'london-lhr': 1.5, 'logan-int': '20', 'dubai-int': 2, unknown: 20,
    } })).completed).toEqual({ 'dubai-int': 2 });
  });

  it('unlocks sequentially per airport, permits replay, and stops at 20', () => {
    let progress = readChallengeProgress(null);
    for (const airport of AIRPORTS) {
      expect(isLevelUnlocked(progress, airport.id, 1)).toBe(true);
      expect(isLevelUnlocked(progress, airport.id, 2)).toBe(false);
      for (let level = 1; level <= 20; level++) {
        expect(completeLevel(progress, airport.id, level + 1)).toBe(progress);
        progress = completeLevel(progress, airport.id, level);
        progress = readChallengeProgress(JSON.stringify(progress));
        expect(isLevelUnlocked(progress, airport.id, level)).toBe(true);
        expect(completeLevel(progress, airport.id, level)).toBe(progress);
      }
    }
    expect(nextLevel(20)).toBeNull();
    expect(nextLevel(0)).toBeNull();
    expect(nextLevel(19)).toBe(20);
    expect(getIntensity('unknown', 1)).toBeNull();
    expect(getIntensity('constructor', 1)).toBeNull();
    expect(getIntensity(AIRPORTS[0].id, 21)).toBeNull();
  });
});
