import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createAssPayload } from '../src/subtitles/ass';
import { detectSubtitleFormat, matchingSubtitleCandidates } from '../src/subtitles/match';
import { convertSrtToVtt } from '../src/subtitles/srt';
import { normalizeVtt } from '../src/subtitles/vtt';

describe('matchingSubtitleCandidates', () => {
  it('returns same-name subtitle candidates in priority order', () => {
    assert.deepEqual(matchingSubtitleCandidates('C:/media/movie.mp4'), [
      path.join('C:/media', 'movie.srt'),
      path.join('C:/media', 'movie.vtt'),
      path.join('C:/media', 'movie.ass'),
      path.join('C:/media', 'movie.ssa'),
    ]);
  });
});

describe('detectSubtitleFormat', () => {
  it('detects supported subtitle formats case-insensitively', () => {
    assert.equal(detectSubtitleFormat('a.srt'), 'srt');
    assert.equal(detectSubtitleFormat('a.VTT'), 'vtt');
    assert.equal(detectSubtitleFormat('a.Ass'), 'ass');
    assert.equal(detectSubtitleFormat('a.SSA'), 'ssa');
    assert.equal(detectSubtitleFormat('a.txt'), undefined);
  });
});

describe('convertSrtToVtt', () => {
  it('converts SRT cue indexes and time separators to WebVTT', () => {
    const result = convertSrtToVtt(
      '1\r\n00:00:01,250 --> 00:00:03,000\r\nHello\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,500\r\nWorld\r\n',
    );

    assert.equal(
      result,
      'WEBVTT\n\n00:00:01.250 --> 00:00:03.000\nHello\n\n00:00:04.000 --> 00:00:05.500\nWorld\n',
    );
  });

  it('keeps multiline cue text', () => {
    const result = convertSrtToVtt('1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two\n');

    assert.equal(result, 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLine one\nLine two\n');
  });
});

describe('normalizeVtt', () => {
  it('adds WEBVTT header when absent', () => {
    assert.equal(
      normalizeVtt('00:00:01.000 --> 00:00:02.000\nHi'),
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n',
    );
  });

  it('preserves existing WEBVTT header', () => {
    assert.equal(normalizeVtt('WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nHi'), 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n');
  });
});

describe('createAssPayload', () => {
  it('normalizes line endings when an events section exists', () => {
    assert.deepEqual(createAssPayload('[Script Info]\r\nTitle: demo\r\n[Events]\r\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi\r\n'), {
      script: '[Script Info]\nTitle: demo\n[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi\n',
    });
  });

  it('rejects ASS/SSA files without events', () => {
    assert.throws(() => createAssPayload('[Script Info]\nTitle: demo\n'), /missing an \[Events\] section/);
  });
});
