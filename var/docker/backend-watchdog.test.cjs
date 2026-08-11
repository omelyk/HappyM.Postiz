const test = require('node:test');
const assert = require('node:assert/strict');
const { decideRecoveryAction } = require('./backend-watchdog.cjs');

test('waits until the consecutive failure threshold', () => {
  assert.equal(decideRecoveryAction(5, 0), 'wait');
});

test('restarts Nest before recovery attempts are exhausted', () => {
  assert.equal(decideRecoveryAction(6, 0), 'restart');
});

test('terminates the container after repeated unsuccessful recoveries', () => {
  assert.equal(decideRecoveryAction(6, 2), 'terminate');
});
