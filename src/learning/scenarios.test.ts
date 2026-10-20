import { describe, expect, it } from 'vitest';
import { answerStep, continueAttempt, newAttempt, other, scenarios } from './scenarios';

describe('deterministic Learning practice', () => {
  for (const [id, steps] of Object.entries(scenarios)) {
    it(`${id} requires correct evidence at every step and restarts independently`, () => {
      let attempt = newAttempt();
      expect(continueAttempt(attempt, steps)).toBe(attempt);
      for (const step of steps) {
        const rejected = answerStep(attempt, steps, 'wrong');
        expect(rejected.step).toBe(attempt.step);
        expect(rejected.accepted).toBe(false);
        expect(continueAttempt(rejected, steps)).toBe(rejected);
        const accepted = answerStep(rejected, steps, step.answer);
        expect(accepted.accepted).toBe(true);
        expect(answerStep(accepted, steps, step.answer)).toBe(accepted);
        attempt = continueAttempt(accepted, steps);
      }
      expect(attempt.step).toBe(steps.length);
      expect(attempt.mistakes).toBe(steps.length);
      expect(answerStep(attempt, steps, 'anything')).toBe(attempt);
      expect(newAttempt()).toEqual({ step: 0, accepted: false, mistakes: 0, feedback: '' });
    });
  }

  it('rejects the similar callsign and makes the IDENT observation a separate step', () => {
    const steps = scenarios.identify!;
    expect(answerStep(newAttempt(), steps, other).accepted).toBe(false);
    expect(steps.findIndex(step => step.ident)).toBeGreaterThan(steps.findIndex(step => step.answer.includes('IDENT')));
    expect(steps.filter(step => step.select)).toHaveLength(2);
  });

  it('separates preparation, transmission, correction, confirmation and delayed execution', () => {
    const steps = scenarios.readback!;
    expect(steps[2].command).toContain('Preparada');
    expect(steps[3].command).toContain('sin confirmar');
    expect(answerStep({ ...newAttempt(), step: 3 }, steps, 'Aceptar 190').accepted).toBe(false);
    expect(steps[6].command).toContain('Confirmada');
    expect(steps[7]).toMatchObject({ heading: 75, assigned: 90, seconds: 15 });
  });
});
