import assert from 'node:assert/strict';
import { trackRole } from './trackRole';

const arrival = {
  type: 'arrival' as const,
  status: 'normal' as const,
  conflict: false,
  hasInstructions: true,
  isEstablished: false,
};

assert.equal(trackRole(arrival, false), 'arrival');
assert.equal(trackRole({ ...arrival, isEstablished: true }, false), 'arrival', 'landing stays in the arrival hue');
assert.equal(trackRole({ ...arrival, hasInstructions: false }, false), 'uncontrolled');
assert.equal(
  trackRole({ ...arrival, type: 'departure', hasInstructions: true }, false),
  'departure',
);
assert.equal(trackRole(arrival, true), 'selected');
assert.equal(trackRole({ ...arrival, conflict: true }, true), 'conflict');
assert.equal(trackRole({ ...arrival, status: 'warning' }, false), 'conflict');
assert.equal(trackRole({ ...arrival, status: 'bad_approach' }, false), 'alert');
assert.equal(
  trackRole({ ...arrival, type: 'departure', hasInstructions: true, status: 'bad_approach' }, false),
  'departure',
  'a climbing departure is not an alert',
);
assert.equal(
  trackRole({ ...arrival, hasInstructions: false, isEstablished: true }, false),
  'arrival',
  'an established track is landing, not uncontrolled',
);

console.log('track role checks passed');
