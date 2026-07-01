import type { MiniPlayerLanguage } from './types';

export interface HostText {
  videoFilter: string;
  subtitleFilter: string;
  noRecentVideos: string;
  recentPlaceholder: string;
  unsupportedSubtitleFile: (filePath: string) => string;
  openedMkvCacheFolder: (cacheDir: string) => string;
  clearCacheWarning: string;
  clearCacheButton: string;
  clearedMkvCache: (deletedEntries: number) => string;
  cacheClearedInfo: (deletedEntries: number) => string;
  preparingMkv: (percent: number) => string;
  usingRemuxedCache: (fileName: string) => string;
}

export function getHostText(language: MiniPlayerLanguage): HostText {
  return language === 'zh-CN' ? zhCnHostText : enHostText;
}

const enHostText: HostText = {
  videoFilter: 'Videos',
  subtitleFilter: 'Subtitles',
  noRecentVideos: 'Mini Player has no recent videos yet.',
  recentPlaceholder: 'Open recent Mini Player video',
  unsupportedSubtitleFile: (filePath) => `Unsupported subtitle file: ${filePath}`,
  openedMkvCacheFolder: (cacheDir) => `Opened MKV cache folder: ${cacheDir}`,
  clearCacheWarning: 'Delete all cached MKV playback files? Original videos and recent playback entries will not be changed.',
  clearCacheButton: 'Clear Cache',
  clearedMkvCache: (deletedEntries) => {
    const entryLabel = deletedEntries === 1 ? 'entry' : 'entries';
    return `Cleared MKV cache: ${deletedEntries} ${entryLabel} removed.`;
  },
  cacheClearedInfo: (deletedEntries) => {
    const entryLabel = deletedEntries === 1 ? 'entry' : 'entries';
    return `Mini Player cache cleared (${deletedEntries} ${entryLabel} removed).`;
  },
  preparingMkv: (percent) => `Preparing MKV for VS Code playback... ${percent}%`,
  usingRemuxedCache: (fileName) => `Using remuxed MP4 cache: ${fileName}`,
};

const zhCnHostText: HostText = {
  videoFilter: '视频',
  subtitleFilter: '字幕',
  noRecentVideos: '迷你播放器还没有最近播放的视频。',
  recentPlaceholder: '打开最近播放的迷你播放器视频',
  unsupportedSubtitleFile: (filePath) => `不支持的字幕文件：${filePath}`,
  openedMkvCacheFolder: (cacheDir) => `已打开 MKV 缓存文件夹：${cacheDir}`,
  clearCacheWarning: '删除所有缓存的 MKV 播放文件？原始视频和最近播放记录不会被更改。',
  clearCacheButton: '清理缓存',
  clearedMkvCache: (deletedEntries) => `已清理 MKV 缓存：移除 ${deletedEntries} 个条目。`,
  cacheClearedInfo: (deletedEntries) => `迷你播放器缓存已清理（移除 ${deletedEntries} 个条目）。`,
  preparingMkv: (percent) => `正在为 VS Code 播放准备 MKV... ${percent}%`,
  usingRemuxedCache: (fileName) => `正在使用重封装的 MP4 缓存：${fileName}`,
};
