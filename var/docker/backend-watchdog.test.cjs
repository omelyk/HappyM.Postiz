const test = require('node:test');
const assert = require('node:assert/strict');
const { decideRecoveryAction } = require('./backend-watchdog.cjs');

test('waits until the consecutive failure threshold', () => {
  assert.equal(decideRecoveryAction(5), 'wait');
});

test('terminates the container at the consecutive failure threshold', () => {
  assert.equal(decideRecoveryAction(6), 'terminate');
});
