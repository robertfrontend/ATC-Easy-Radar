import { describe, expect, it } from 'vitest';
import { trackRole } from './trackRole';

const arrival = {
  type: 'arrival' as const,
  status: 'normal' as const,
  conflict: false,
  hasInstructions: true,
  isEstablished: false,
};

describe('track role', () => {
  it('paints a controlled arrival in the arrival hue, including one on the localizer', () => {
    expect(trackRole(arrival, false)).toBe('arrival');
    expect(trackRole({ ...arrival, isEstablished: true }, false)).toBe('arrival');
  });

  it('paints an arrival with no clearance as uncontrolled', () => {
    expect(trackRole({ ...arrival, hasInstructions: false }, false)).toBe('uncontrolled');
  });

  it('paints a departure in its own hue', () => {
    expect(trackRole({ ...arrival, type: 'departure', hasInstructions: true }, false)).toBe('departure');
  });

  it('lets selection win over the arrival hue', () => {
    expect(trackRole(arrival, true)).toBe('selected');
  });

  it('lets a conflict win over selection', () => {
    expect(trackRole({ ...arrival, conflict: true }, true)).toBe('conflict');
    expect(trackRole({ ...arrival, status: 'warning' }, false)).toBe('conflict');
  });

  it('flags a bad approach and leaves a climbing departure alone', () => {
    expect(trackRole({ ...arrival, status: 'bad_approach' }, false)).toBe('alert');
    expect(trackRole(
      { ...arrival, type: 'departure', hasInstructions: true, status: 'bad_approach' },
      false,
    )).toBe('departure');
  });

  it('treats an established track as landing even without a clearance', () => {
    expect(trackRole({ ...arrival, hasInstructions: false, isEstablished: true }, false)).toBe('arrival');
  });
});
