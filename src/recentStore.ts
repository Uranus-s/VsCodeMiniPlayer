import type { RecentPlaybackItem } from './types';

export const RECENT_STORAGE_KEY = 'miniPlayer.recentPlayback';

export interface MementoLike {
  get<T>(key: string, fallback: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

export function buildRecentList(
  current: RecentPlaybackItem[],
  next: RecentPlaybackItem,
  limit: number,
): RecentPlaybackItem[] {
  const safeLimit = Math.max(1, Math.floor(limit));

  return [next, ...current.filter((entry) => entry.videoUri !== next.videoUri)]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, safeLimit);
}

export class RecentStore {
  constructor(private readonly state: MementoLike) {}

  list(): RecentPlaybackItem[] {
    return this.state.get<RecentPlaybackItem[]>(RECENT_STORAGE_KEY, []);
  }

  async upsert(item: RecentPlaybackItem, limit: number): Promise<void> {
    await this.state.update(RECENT_STORAGE_KEY, buildRecentList(this.list(), item, limit));
  }
}
