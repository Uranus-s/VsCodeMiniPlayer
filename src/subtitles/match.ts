import path from 'node:path';
import type { SubtitleFormat } from '../types';

const SUBTITLE_EXTENSIONS: readonly SubtitleFormat[] = ['srt', 'vtt', 'ass', 'ssa'];

export function matchingSubtitleCandidates(videoPath: string): string[] {
  const parsed = path.parse(videoPath);

  return SUBTITLE_EXTENSIONS.map((extension) => path.join(parsed.dir, `${parsed.name}.${extension}`));
}

export function detectSubtitleFormat(filePath: string): SubtitleFormat | undefined {
  const extension = path.extname(filePath).slice(1).toLowerCase();

  return SUBTITLE_EXTENSIONS.find((format) => format === extension);
}
