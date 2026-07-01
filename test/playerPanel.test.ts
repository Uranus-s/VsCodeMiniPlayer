import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const playerPanelSource = readFileSync('src/playerPanel.ts', 'utf8');

describe('player panel state restore', () => {
  it('uses the newly loaded video volume, position, and unmuted state for future restores', () => {
    assert.match(
      playerPanelSource,
      /this\.latestVideo = payload;\s*this\.latestState = \{ position, volume, muted: false \};/,
    );
  });

  it('preserves muted changes reported by the webview for future restores', () => {
    assert.match(
      playerPanelSource,
      /this\.latestState = \{ position: message\.position, volume: message\.volume, muted: message\.muted === true \};/,
    );
  });

  it('forwards cache management requests from the webview to extension callbacks', () => {
    assert.match(playerPanelSource, /private readonly onRequestOpenCache: \(\) => void/);
    assert.match(playerPanelSource, /private readonly onRequestClearCache: \(\) => void/);
    assert.match(playerPanelSource, /message\.type === 'requestOpenCache'/);
    assert.match(playerPanelSource, /this\.onRequestOpenCache\(\)/);
    assert.match(playerPanelSource, /message\.type === 'requestClearCache'/);
    assert.match(playerPanelSource, /this\.onRequestClearCache\(\)/);
  });
});
