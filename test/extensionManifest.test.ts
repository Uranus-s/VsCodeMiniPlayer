import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import manifest from '../package.json';

describe('extension manifest', () => {
  it('contributes mini player commands', () => {
    const commandIds = manifest.contributes.commands.map((command) => command.command);

    assert.deepEqual(commandIds, [
      'miniPlayer.openVideo',
      'miniPlayer.togglePanel',
      'miniPlayer.quickHide',
      'miniPlayer.openSubtitle',
      'miniPlayer.openRecent',
      'miniPlayer.toggleCornerPosition',
    ]);
  });

  it('relies on command contributions for activation', () => {
    assert.equal('activationEvents' in manifest, false);
  });

  it('declares required project scripts', () => {
    assert.equal(manifest.main, './dist/extension.js');
    assert.match(manifest.scripts.build, /esbuild src\/extension\.ts/);
    assert.match(manifest.scripts.build, /--external:ffmpeg-static/);
    assert.match(manifest.scripts.build, /--outfile=dist\/extension\.js/);
    assert.equal(
      manifest.scripts.test,
      'tsx --test test/extensionManifest.test.ts test/config.test.ts test/recentStore.test.ts test/subtitles.test.ts test/webviewHtml.test.ts test/commandErrors.test.ts test/wait.test.ts test/playerScript.test.ts test/playerStyle.test.ts test/playerPanel.test.ts test/videoFormats.test.ts test/videoPreparation.test.ts',
    );
    assert.equal(manifest.scripts.compile, 'tsc --noEmit');
  });

  it('pins vscode types to the minimum supported engine', () => {
    assert.equal(manifest.engines.vscode, '^1.90.0');
    assert.equal(manifest.devDependencies['@types/vscode'], '1.90.0');
  });

  it('contributes the quick hide keybinding', () => {
    const keybinding = manifest.contributes.keybindings.find(
      (entry) => entry.command === 'miniPlayer.quickHide',
    );

    assert.ok(keybinding);
    assert.equal(keybinding.key, 'ctrl+alt+h');
    assert.equal(keybinding.mac, 'cmd+alt+h');
  });

  it('contributes a bottom panel webview view', () => {
    assert.deepEqual(manifest.contributes.viewsContainers.panel, [
      {
        id: 'miniPlayerPanel',
        title: 'Mini Player',
        icon: 'media/icon.svg',
      },
    ]);
    assert.deepEqual(manifest.contributes.views.miniPlayerPanel, [
      {
        id: 'miniPlayer.playerView',
        name: 'Mini Player',
        type: 'webview',
      },
    ]);
  });

  it('contributes expected configuration defaults', () => {
    const properties = manifest.contributes.configuration.properties;

    assert.equal(properties['miniPlayer.hideBehavior'].default, 'pauseAndHide');
    assert.equal(properties['miniPlayer.cornerPosition'].default, 'right');
    assert.deepEqual(properties['miniPlayer.cornerPosition'].enum, ['left', 'right']);
    assert.equal(properties['miniPlayer.defaultVolume'].default, 0.7);
    assert.equal(properties['miniPlayer.autoLoadMatchingSubtitle'].default, true);
    assert.equal(properties['miniPlayer.recentLimit'].default, 10);
  });
});
