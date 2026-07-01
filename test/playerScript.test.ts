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

  it('uses a format-neutral media playback error message', () => {
    assert.match(playerScript, /This video cannot be played in VS Code/);
    assert.doesNotMatch(playerScript, /This MP4 cannot be played/);
  });

  it('can append activity messages sent by the extension host', () => {
    assert.match(playerScript, /message\.type === 'appendActivity'/);
    assert.match(playerScript, /appendActivity\(message\.message\)/);
  });

  it('logs runtime audio state for playback diagnostics', () => {
    assert.match(playerScript, /logAudioState\('Media metadata loaded'\)/);
    assert.match(playerScript, /logAudioState\('Playback started'\)/);
    assert.match(playerScript, /Volume: \$\{Math\.round\(video\.volume \* 100\)\}%/);
    assert.match(playerScript, /Muted: \$\{video\.muted \? 'yes' : 'no'\}/);
  });

  it('restores muted state explicitly from the extension host', () => {
    assert.match(playerScript, /video\.muted = message\.muted;/);
  });

  it('connects media playback to the Web Audio output graph', () => {
    assert.match(playerScript, /ensureMediaAudioOutput/);
    assert.match(playerScript, /createMediaElementSource\(video\)/);
    assert.match(playerScript, /mediaAudioSource\.connect\(mediaAudioContext\.destination\)/);
    assert.match(playerScript, /Audio output connected\./);
  });
});
