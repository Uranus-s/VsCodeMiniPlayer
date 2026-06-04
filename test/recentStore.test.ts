import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRecentList, RecentStore, RECENT_STORAGE_KEY } from '../src/recentStore';
import type { RecentPlaybackItem } from '../src/types';

describe('buildRecentList', () => {
  it('adds newest item first', () => {
    const result = buildRecentList([], item('file:///a.mp4', 100), 10);

    assert.equal(result[0].videoUri, 'file:///a.mp4');
  });

  it('replaces duplicate video entries', () => {
    const result = buildRecentList(
      [item('file:///a.mp4', 100, 8), item('file:///b.mp4', 90)],
      item('file:///a.mp4', 200, 12),
      10,
    );

    assert.deepEqual(
      result.map((entry) => entry.videoUri),
      ['file:///a.mp4', 'file:///b.mp4'],
    );
    assert.equal(result[0].position, 12);
  });

  it('sorts by opened time and enforces recent limit', () => {
    const result = buildRecentList(
      [item('file:///a.mp4', 100), item('file:///b.mp4', 90)],
      item('file:///c.mp4', 95),
      2,
    );

    assert.deepEqual(
      result.map((entry) => entry.videoUri),
      ['file:///a.mp4', 'file:///c.mp4'],
    );
  });

  it('treats limits below one as one item', () => {
    const result = buildRecentList([item('file:///a.mp4', 100)], item('file:///b.mp4', 110), 0);

    assert.deepEqual(
      result.map((entry) => entry.videoUri),
      ['file:///b.mp4'],
    );
  });
});

describe('RecentStore', () => {
  it('reads and writes recent playback through a memento-like state object', async () => {
    const state = new MemoryMemento();
    const store = new RecentStore(state);

    assert.deepEqual(store.list(), []);

    await store.upsert(item('file:///a.mp4', 100), 10);

    assert.deepEqual(
      state.get<RecentPlaybackItem[]>(RECENT_STORAGE_KEY, []),
      [item('file:///a.mp4', 100)],
    );
  });
});

function item(videoUri: string, openedAt: number, position = 0): RecentPlaybackItem {
  return {
    videoUri,
    videoName: videoUri.split('/').at(-1) ?? videoUri,
    position,
    openedAt,
  };
}

class MemoryMemento {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, fallback: T): T {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}
