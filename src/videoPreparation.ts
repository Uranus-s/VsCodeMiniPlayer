import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const REMUX_CACHE_VERSION = 'v5';

export interface PreparePlayableVideoOptions {
  filePath: string;
  cacheDir: string;
  fileExists?: (filePath: string) => boolean;
  makeDirectory?: (dirPath: string) => Promise<void>;
  readDurationMs?: (inputPath: string) => Promise<number | undefined>;
  remuxMkvToMp4?: (inputPath: string, outputPath: string, progress?: RemuxProgress) => Promise<void>;
  renameFile?: (fromPath: string, toPath: string) => Promise<void>;
  onProgress?: (percent: number) => void;
}

export interface PreparedVideo {
  playablePath: string;
  isRemuxed: boolean;
}

export interface RemuxProgress {
  durationMs?: number;
  onProgress?: (percent: number) => void;
}

export async function preparePlayableVideo(options: PreparePlayableVideoOptions): Promise<PreparedVideo> {
  if (path.extname(options.filePath).toLowerCase() !== '.mkv') {
    return { playablePath: options.filePath, isRemuxed: false };
  }

  const fileExists = options.fileExists ?? existsSync;
  const makeDirectory = options.makeDirectory ?? ((dirPath) => mkdir(dirPath, { recursive: true }).then(() => undefined));
  const readDurationMs = options.readDurationMs ?? readMediaDurationMsWithFfmpeg;
  const remuxMkvToMp4 = options.remuxMkvToMp4 ?? remuxMkvToMp4WithFfmpeg;
  const renameFile = options.renameFile ?? rename;
  const outputPath = buildRemuxedVideoPath(options.filePath, options.cacheDir);
  const tempOutputPath = `${outputPath}.tmp`;

  await makeDirectory(options.cacheDir);
  if (!fileExists(outputPath)) {
    const durationMs = options.onProgress ? await readDurationMs(options.filePath) : undefined;
    await remuxMkvToMp4(options.filePath, tempOutputPath, {
      durationMs,
      onProgress: options.onProgress,
    });
    await renameFile(tempOutputPath, outputPath);
  }

  return { playablePath: outputPath, isRemuxed: true };
}

export function buildRemuxedVideoPath(filePath: string, cacheDir: string): string {
  const parsed = path.parse(filePath);
  const hash = createHash('sha256')
    .update(`${REMUX_CACHE_VERSION}:${path.resolve(filePath).toLowerCase()}`)
    .digest('hex')
    .slice(0, 12);
  return path.join(cacheDir, `${parsed.name}-${hash}.mp4`);
}

export function buildRemuxMkvToMp4Args(inputPath: string, outputPath: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-progress',
    'pipe:2',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    'copy',
    '-c:a',
    'pcm_s16be',
    '-movflags',
    '+faststart',
    '-f',
    'mov',
    outputPath,
  ];
}

export function parseFfmpegDurationMs(value: string): number | undefined {
  const match = value.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) {
    return undefined;
  }

  return (
    Number(match[1]) * 60 * 60 * 1000
    + Number(match[2]) * 60 * 1000
    + Number(match[3]) * 1000
    + Number(match[4]) * 10
  );
}

export function parseFfmpegProgressPercent(value: string, durationMs?: number): number | undefined {
  if (!durationMs || durationMs <= 0) {
    return undefined;
  }

  const match = value.trim().match(/^out_time_ms=(\d+)$/);
  if (!match) {
    return undefined;
  }

  const elapsedMs = Number(match[1]) / 1000;
  if (!Number.isFinite(elapsedMs)) {
    return undefined;
  }

  return Math.max(0, Math.min(99, Math.floor((elapsedMs / durationMs) * 100)));
}

async function readMediaDurationMsWithFfmpeg(inputPath: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const executable = ffmpegPath ?? 'ffmpeg';
    const process = spawn(executable, ['-hide_banner', '-i', inputPath]);
    let stderr = '';

    process.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    process.on('error', (error) => {
      reject(new Error(`Unable to inspect MKV duration because ffmpeg could not be started: ${error.message}`));
    });
    process.on('close', () => {
      resolve(parseFfmpegDurationMs(stderr));
    });
  });
}

async function remuxMkvToMp4WithFfmpeg(
  inputPath: string,
  outputPath: string,
  progress?: RemuxProgress,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const executable = ffmpegPath ?? 'ffmpeg';
    const process = spawn(executable, buildRemuxMkvToMp4Args(inputPath, outputPath));
    let stderr = '';
    let pendingLine = '';

    process.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      pendingLine += text;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? '';

      for (const line of lines) {
        const percent = parseFfmpegProgressPercent(line, progress?.durationMs);
        if (percent !== undefined) {
          progress?.onProgress?.(percent);
        }
      }
    });
    process.on('error', (error) => {
      reject(new Error(`Unable to remux MKV because ffmpeg could not be started: ${error.message}`));
    });
    process.on('close', (code) => {
      if (code === 0) {
        progress?.onProgress?.(100);
        resolve();
        return;
      }

      const detail = stderr.trim();
      reject(new Error(
        detail
          ? `Unable to remux MKV with ffmpeg: ${detail}`
          : `Unable to remux MKV with ffmpeg. Exit code: ${code ?? 'unknown'}.`,
      ));
    });
  });
}
