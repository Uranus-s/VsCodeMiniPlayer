import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const playerStyle = readFileSync('media/player.css', 'utf8');

describe('player responsive layout styles', () => {
  it('uses a grid that fills the panel with log and video regions above the toolbar', () => {
    assert.match(playerStyle, /\.player-shell\s*{[^}]*display:\s*grid/s);
    assert.match(playerStyle, /grid-template-rows:\s*minmax\(0,\s*1fr\)\s*36px/);
    assert.match(playerStyle, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(240px,\s*42vw\)/);
    assert.match(playerStyle, /\.corner-left \.player-shell\s*{[^}]*grid-template-columns:\s*minmax\(240px,\s*42vw\)\s*minmax\(0,\s*1fr\)/s);
    assert.match(playerStyle, /\.activity-log\s*{[^}]*grid-row:\s*1/s);
    assert.match(playerStyle, /\.video-frame\s*{[^}]*grid-row:\s*1/s);
    assert.match(playerStyle, /\.toolbar\s*{[^}]*grid-row:\s*2/s);
    assert.match(playerStyle, /\.corner-right \.activity-log\s*{[^}]*grid-column:\s*1/s);
    assert.match(playerStyle, /\.corner-right \.video-frame\s*{[^}]*grid-column:\s*2/s);
    assert.match(playerStyle, /\.corner-left \.video-frame\s*{[^}]*grid-column:\s*1/s);
    assert.match(playerStyle, /\.corner-left \.activity-log\s*{[^}]*grid-column:\s*2/s);
    assert.doesNotMatch(playerStyle, /\.video-frame\s*{[^}]*position:\s*absolute/s);
    assert.match(playerStyle, /\.video-frame\s*{[^}]*position:\s*relative/s);
    assert.match(playerStyle, /video\s*{[^}]*position:\s*absolute/s);
    assert.match(playerStyle, /video\s*{[^}]*inset:\s*0/s);
  });

  it('allows the activity log lines to scroll vertically', () => {
    assert.match(playerStyle, /\.activity-log-lines\s*{[^}]*overflow-y:\s*auto/s);
    assert.match(playerStyle, /\.activity-log-lines\s*{[^}]*overflow-x:\s*hidden/s);
    assert.doesNotMatch(playerStyle, /\.activity-log-lines\s*{[^}]*overflow:\s*hidden/s);
  });
});
