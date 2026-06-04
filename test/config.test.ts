import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeConfig, readMiniPlayerConfig } from '../src/config';

describe('normalizeConfig', () => {
  it('returns defaults for missing values', () => {
    assert.deepEqual(normalizeConfig({}), {
      hideBehavior: 'pauseAndHide',
      cornerPosition: 'right',
      defaultVolume: 0.7,
      autoLoadMatchingSubtitle: true,
      recentLimit: 10,
    });
  });

  it('keeps valid user settings', () => {
    assert.deepEqual(
      normalizeConfig({
        hideBehavior: 'keepPlayingAndHide',
        cornerPosition: 'left',
        defaultVolume: 0.25,
        autoLoadMatchingSubtitle: false,
        recentLimit: 12,
      }),
      {
        hideBehavior: 'keepPlayingAndHide',
        cornerPosition: 'left',
        defaultVolume: 0.25,
        autoLoadMatchingSubtitle: false,
        recentLimit: 12,
      },
    );
  });

  it('clamps numeric settings', () => {
    assert.equal(normalizeConfig({ defaultVolume: 4 }).defaultVolume, 1);
    assert.equal(normalizeConfig({ defaultVolume: -1 }).defaultVolume, 0);
    assert.equal(normalizeConfig({ recentLimit: 100 }).recentLimit, 50);
    assert.equal(normalizeConfig({ recentLimit: 0 }).recentLimit, 1);
  });

  it('falls back for invalid setting shapes', () => {
    assert.deepEqual(
      normalizeConfig({
        hideBehavior: 'hideInstantly',
        cornerPosition: 'center',
        defaultVolume: Number.NaN,
        autoLoadMatchingSubtitle: 'yes',
        recentLimit: '10',
      }),
      {
        hideBehavior: 'pauseAndHide',
        cornerPosition: 'right',
        defaultVolume: 0.7,
        autoLoadMatchingSubtitle: true,
        recentLimit: 10,
      },
    );
  });
});

describe('readMiniPlayerConfig', () => {
  it('reads the expected VS Code configuration keys', () => {
    const requested: string[] = [];
    const values = new Map<string, unknown>([
      ['hideBehavior', 'keepPlayingAndHide'],
      ['cornerPosition', 'left'],
      ['defaultVolume', 0.4],
      ['autoLoadMatchingSubtitle', false],
      ['recentLimit', 7],
    ]);

    const result = readMiniPlayerConfig(<T>(key: string): T | undefined => {
      requested.push(key);
      return values.get(key) as T | undefined;
    });

    assert.deepEqual(requested, [
      'hideBehavior',
      'cornerPosition',
      'defaultVolume',
      'autoLoadMatchingSubtitle',
      'recentLimit',
    ]);
    assert.deepEqual(result, {
      hideBehavior: 'keepPlayingAndHide',
      cornerPosition: 'left',
      defaultVolume: 0.4,
      autoLoadMatchingSubtitle: false,
      recentLimit: 7,
    });
  });
});
