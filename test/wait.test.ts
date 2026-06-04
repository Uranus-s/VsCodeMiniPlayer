import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { waitForValue } from '../src/wait';

describe('waitForValue', () => {
  it('waits until an asynchronously created value exists', async () => {
    let value: string | undefined;

    const result = await waitForValue(
      () => value,
      async () => {
        setTimeout(() => {
          value = 'ready';
        }, 10);
      },
      250,
      5,
      'value did not appear',
    );

    assert.equal(result, 'ready');
  });

  it('throws the supplied message when the value never appears', async () => {
    await assert.rejects(
      () => waitForValue(() => undefined, async () => undefined, 20, 5, 'value did not appear'),
      /value did not appear/,
    );
  });
});
