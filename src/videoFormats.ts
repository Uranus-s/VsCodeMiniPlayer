import path from 'node:path';

export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mkv'] as const;

export function isSupportedVideoPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase().slice(1);
  return SUPPORTED_VIDEO_EXTENSIONS.includes(extension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number]);
}

export function assertSupportedVideoPath(filePath: string): void {
  if (!isSupportedVideoPath(filePath)) {
    throw new Error(
      'Mini Player only supports MP4 and MKV videos. If playback fails, use a video encoded with codecs supported by VS Code.',
    );
  }
}
