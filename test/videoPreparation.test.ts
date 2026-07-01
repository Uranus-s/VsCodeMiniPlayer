import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildRemuxMkvToMp4Args,
  buildRemuxedVideoPath,
  parseFfmpegDurationMs,
  parseFfmpegProgressPercent,
  preparePlayableVideo,
} from '../src/videoPreparation';

describe('preparePlayableVideo', () => {
  it('returns MP4 files unchanged', async () => {
    const result = await preparePlayableVideo({
      filePath: 'D:\\media\\movie.mp4',
      cacheDir: 'C:\\cache',
      fileExists: () => false,
      makeDirectory: async () => {},
      remuxMkvToMp4: async () => {
        throw new Error('remux should not run for MP4 files');
      },
    });

    assert.equal(result.playablePath, 'D:\\media\\movie.mp4');
    assert.equal(result.isRemuxed, false);
  });

  it('remuxes MKV files to a cached MP4 source', async () => {
    const calls: Array<{ inputPath: string; outputPath: string }> = [];
    const renames: Array<{ fromPath: string; toPath: string }> = [];
    const progressValues: number[] = [];

    const result = await preparePlayableVideo({
      filePath: 'D:\\media\\Episode 01.mkv',
      cacheDir: 'C:\\cache',
      fileExists: () => false,
      makeDirectory: async () => {},
      readDurationMs: async () => 100_000,
      remuxMkvToMp4: async (inputPath, outputPath, progress) => {
        calls.push({ inputPath, outputPath });
        progress?.onProgress?.(42);
      },
      renameFile: async (fromPath, toPath) => {
        renames.push({ fromPath, toPath });
      },
      onProgress: (percent) => {
        progressValues.push(percent);
      },
    });

    assert.equal(result.isRemuxed, true);
    assert.equal(path.extname(result.playablePath), '.mp4');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].inputPath, 'D:\\media\\Episode 01.mkv');
    assert.equal(calls[0].outputPath, `${result.playablePath}.tmp`);
    assert.deepEqual(renames, [{ fromPath: `${result.playablePath}.tmp`, toPath: result.playablePath }]);
    assert.deepEqual(progressValues, [42]);
  });

  it('reuses an existing remuxed MP4 cache file', async () => {
    let remuxed = false;

    const result = await preparePlayableVideo({
      filePath: 'D:\\media\\Episode 01.mkv',
      cacheDir: 'C:\\cache',
      fileExists: () => true,
      makeDirectory: async () => {},
      remuxMkvToMp4: async () => {
        remuxed = true;
      },
      onProgress: () => {
        throw new Error('progress should not run when cached MP4 exists');
      },
    });

    assert.equal(result.isRemuxed, true);
    assert.equal(remuxed, false);
  });
});

describe('buildRemuxedVideoPath', () => {
  it('creates stable cache paths with an MP4 extension', () => {
    const first = buildRemuxedVideoPath('D:\\media\\Episode 01.mkv', 'C:\\cache');
    const second = buildRemuxedVideoPath('D:\\media\\Episode 01.mkv', 'C:\\cache');

    assert.equal(first, second);
    assert.equal(path.dirname(first), 'C:\\cache');
    assert.match(path.basename(first), /^Episode 01-[a-f0-9]{12}\.mp4$/);
  });
});

describe('buildRemuxMkvToMp4Args', () => {
  it('copies video and transcodes the first audio stream into VS Code-compatible PCM in a MOV container', () => {
    const args = buildRemuxMkvToMp4Args('D:\\media\\Episode 01.mkv', 'C:\\cache\\Episode 01.mp4');

    assert.deepEqual(args, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-progress',
      'pipe:2',
      '-i',
      'D:\\media\\Episode 01.mkv',
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
      'C:\\cache\\Episode 01.mp4',
    ]);
  });
});

describe('parseFfmpegDurationMs', () => {
  it('parses ffmpeg duration lines', () => {
    assert.equal(parseFfmpegDurationMs('Duration: 00:44:42.18, start: 0.000000, bitrate: 3887 kb/s'), 2_682_180);
  });
});

describe('parseFfmpegProgressPercent', () => {
  it('parses out_time_ms progress against a known duration', () => {
    assert.equal(parseFfmpegProgressPercent('out_time_ms=1341090000', 2_682_180), 50);
  });

  it('ignores unrelated progress lines', () => {
    assert.equal(parseFfmpegProgressPercent('progress=continue', 2_682_180), undefined);
  });
});
