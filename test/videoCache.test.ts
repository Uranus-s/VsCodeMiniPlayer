import assert from 'node:assert/strict';
import { mkdtemp, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { clearVideoCacheDirectory } from '../src/videoCache';

describe('video cache management', () => {
  it('removes all remuxed cache entries while keeping the cache directory available', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'mini-player-cache-'));
    await writeFile(path.join(cacheDir, 'episode-a.mp4'), 'cache-a');
    await writeFile(path.join(cacheDir, 'episode-b.mp4.tmp'), 'cache-b');

    const result = await clearVideoCacheDirectory(cacheDir);

    assert.equal(result.deletedEntries, 2);
    assert.deepEqual(await readdir(cacheDir), []);
    assert.equal((await stat(cacheDir)).isDirectory(), true);
  });

  it('creates an empty cache directory when clearing before any MKV has been prepared', async () => {
    const parentDir = await mkdtemp(path.join(os.tmpdir(), 'mini-player-cache-parent-'));
    const cacheDir = path.join(parentDir, 'remuxed-videos');

    const result = await clearVideoCacheDirectory(cacheDir);

    assert.equal(result.deletedEntries, 0);
    assert.deepEqual(await readdir(cacheDir), []);
  });
});
