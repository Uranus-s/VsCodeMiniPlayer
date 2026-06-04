import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const playerScript = readFileSync('media/player.js', 'utf8');

describe('player script activity log', () => {
  it('logs playback progress with elapsed time, remaining time, and clock time', () => {
    assert.match(playerScript, /startProgressLogging/);
    assert.match(playerScript, /stopProgressLogging/);
    assert.match(playerScript, /appendProgressActivity/);
    assert.match(playerScript, /Current: \$\{formatDuration\(video\.currentTime\)\}/);
    assert.match(playerScript, /Remaining: \$\{formatDuration\(remaining\)\}/);
    assert.match(playerScript, /Clock: \$\{formatClockTime\(\)\}/);
  });
});
