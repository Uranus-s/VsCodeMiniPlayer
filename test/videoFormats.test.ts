import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUPPORTED_VIDEO_EXTENSIONS,
  assertSupportedVideoPath,
  isSupportedVideoPath,
} from '../src/videoFormats';

describe('video formats', () => {
  it('exposes supported local video containers in the video picker', () => {
    assert.deepEqual(SUPPORTED_VIDEO_EXTENSIONS, ['mp4', 'mkv']);
  });

  it('accepts supported video paths case-insensitively', () => {
    assert.equal(isSupportedVideoPath('D:\\video.mp4'), true);
    assert.equal(isSupportedVideoPath('D:\\video.MP4'), true);
    assert.equal(isSupportedVideoPath('D:\\video.mkv'), true);
    assert.equal(isSupportedVideoPath('D:\\video.MKV'), true);
  });

  it('rejects containers that the VS Code webview cannot reliably play', () => {
    assert.equal(isSupportedVideoPath('D:\\video.webm'), false);
    assert.equal(isSupportedVideoPath('D:\\video.mov'), false);
  });

  it('provides an actionable error for unsupported files', () => {
    assert.throws(
      () => assertSupportedVideoPath('D:\\video.mov'),
      /Mini Player only supports MP4 and MKV videos/,
    );
  });
});
