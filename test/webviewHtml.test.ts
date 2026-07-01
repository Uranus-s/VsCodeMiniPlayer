import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPlayerHtml } from '../src/webview/html';

describe('createPlayerHtml', () => {
  it('creates a player document with CSP, media, controls, and script nonce', () => {
    const html = createPlayerHtml({
      cspSource: 'vscode-resource:',
      scriptUri: 'vscode-resource:/media/player.js',
      styleUri: 'vscode-resource:/media/player.css',
      nonce: 'fixed-nonce',
    });

    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /media-src vscode-resource: blob:/);
    assert.match(html, /script-src 'nonce-fixed-nonce'/);
    assert.match(html, /<link href="vscode-resource:\/media\/player\.css" rel="stylesheet">/);
    assert.match(html, /<video id="video" controls playsinline><\/video>/);
    assert.match(html, /<div id="ass-layer" class="ass-layer"/);
    assert.match(html, /id="subtitle-button"/);
    assert.match(html, /id="recent-button"/);
    assert.match(html, /id="mute-button"/);
    assert.match(html, /id="volume-slider"/);
    assert.match(html, /id="corner-button"/);
    assert.match(html, /id="open-cache-button"/);
    assert.match(html, /id="clear-cache-button"/);
    assert.match(html, /id="activity-log"/);
    assert.match(html, /<script nonce="fixed-nonce" src="vscode-resource:\/media\/player\.js"><\/script>/);
  });
});
