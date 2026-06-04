import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCommandError } from '../src/commandErrors';

describe('formatCommandError', () => {
  it('keeps Error messages visible to the user', () => {
    assert.equal(formatCommandError(new Error('Could not parse subtitle')), 'Could not parse subtitle');
  });

  it('stringifies non-Error command failures', () => {
    assert.equal(formatCommandError('Panel did not open'), 'Panel did not open');
    assert.equal(formatCommandError(undefined), 'Unknown Mini Player error.');
  });
});
