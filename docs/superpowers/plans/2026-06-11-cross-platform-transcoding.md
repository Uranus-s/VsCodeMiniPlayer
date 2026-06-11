# Cross-Platform Bundled Transcoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play common local video containers and codecs in desktop VS Code by shipping platform-specific FFmpeg runtimes and streaming CPU-transcoded HLS/fMP4 output to the Webview.

**Architecture:** The extension host resolves a bundled runtime, probes source media, owns one cancellable transcode generation, and serves its bounded HLS directory through an authenticated loopback server. The Webview uses a bundled `hls.js` client, reports absolute playback time, and requests restart-based seeking and audio-track changes.

**Tech Stack:** TypeScript, VS Code Extension API, Node child processes and HTTP server, FFmpeg/ffprobe, HLS with fragmented MP4, `hls.js`, esbuild, Node test runner, platform-targeted VSIX packages.

---

## File Structure

- Create `src/media/model.ts`: normalized probe, audio-track, stream-session, and runtime types.
- Create `src/media/runtime.ts`: platform/architecture runtime selection and executable validation.
- Create `src/media/probe.ts`: ffprobe execution and JSON normalization.
- Create `src/media/ffmpegArgs.ts`: pure HLS transcode argument generation.
- Create `src/media/process.ts`: child-process execution, stderr capture, and bounded termination.
- Create `src/media/sessionFiles.ts`: safe session directories, stale cleanup, and cache accounting.
- Create `src/media/transcodeSession.ts`: one FFmpeg generation and playlist readiness.
- Create `src/media/server.ts`: token-authenticated loopback HLS server.
- Create `src/media/playbackManager.ts`: active source, generation cancellation, seeking, and audio switching.
- Create `src/media/errors.ts`: concise media error mapping.
- Modify `src/types.ts`: stream metadata and Webview messages.
- Modify `src/playerPanel.ts`: Webview origin handshake and stream-session messages.
- Modify `src/extension.ts`: playback manager lifecycle and broad video picker.
- Modify `src/webview/html.ts`: `hls.js` resource and loopback CSP.
- Modify `media/player.js`: HLS lifecycle, seeking, absolute-time state, and audio selector.
- Modify `media/player.css`: audio selector styling.
- Modify `package.json`: `hls.js`, scripts, packaging metadata, and broad video filters.
- Modify `.vscodeignore`: include runtime, browser bundle, and license files while excluding development sources.
- Create `scripts/copy-hls.mjs`: copy pinned browser bundle into `media/vendor`.
- Create `scripts/fetch-runtime.mjs`: checksum-verified target runtime acquisition.
- Create `scripts/package-platform.mjs`: target-specific VSIX packaging.
- Create `runtime/manifest.json`: pinned runtime version, targets, archive URLs, and SHA-256 values.
- Create `runtime/LICENSES/FFmpeg-LGPL.txt`: distributed license notice.
- Create `.github/workflows/platform-packages.yml`: build and package all six targets.
- Create focused tests under `test/media/` plus updates to Webview and manifest tests.

## Execution Preconditions

- [ ] **Step 1: Preserve current work before isolation**

Run:

```powershell
git status --short
git diff -- README.md media/player.js package.json src/extension.ts test/extensionManifest.test.ts src/videoFormats.ts test/videoFormats.test.ts
```

Expected: the existing MP4-only work is visible and is not discarded. During implementation, replace that temporary restriction with the broader probed-media behavior in Task 8.

- [ ] **Step 2: Create an isolated execution workspace**

Use `superpowers:using-git-worktrees`. If the current relevant uncommitted changes cannot be transferred safely, execute in the current workspace and explicitly preserve unrelated changes.

## Task 1: Shared Media Model And Runtime Resolution

**Files:**
- Create: `src/media/model.ts`
- Create: `src/media/runtime.ts`
- Create: `test/media/runtime.test.ts`
- Modify: `package.json`
- Modify: `test/extensionManifest.test.ts`

- [ ] **Step 1: Add the failing runtime tests**

Create `test/media/runtime.test.ts`:

```ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { resolveRuntime } from '../../src/media/runtime';

describe('resolveRuntime', () => {
  it('maps supported Node targets to bundled executables', () => {
    const runtime = resolveRuntime('C:\\extension', 'win32', 'x64');
    assert.equal(runtime.target, 'win32-x64');
    assert.equal(runtime.ffmpegPath, path.join('C:\\extension', 'runtime', 'win32-x64', 'ffmpeg.exe'));
    assert.equal(runtime.ffprobePath, path.join('C:\\extension', 'runtime', 'win32-x64', 'ffprobe.exe'));
  });

  it('uses extensionless executable names on Unix', () => {
    const runtime = resolveRuntime('/extension', 'darwin', 'arm64');
    assert.equal(runtime.ffmpegPath, '/extension/runtime/darwin-arm64/ffmpeg');
  });

  it('rejects unsupported targets', () => {
    assert.throws(() => resolveRuntime('/extension', 'freebsd', 'x64'), /not supported/);
  });
});
```

Append `test/media/runtime.test.ts` to the explicit `npm test` command.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx tsx --test test/media/runtime.test.ts
```

Expected: FAIL because `src/media/runtime.ts` does not exist.

- [ ] **Step 3: Add the media model and minimal resolver**

Create `src/media/model.ts`:

```ts
export type SupportedTarget =
  | 'win32-x64'
  | 'win32-arm64'
  | 'darwin-x64'
  | 'darwin-arm64'
  | 'linux-x64'
  | 'linux-arm64';

export interface MediaRuntime {
  target: SupportedTarget;
  ffmpegPath: string;
  ffprobePath: string;
}

export interface AudioTrack {
  streamIndex: number;
  label: string;
  language?: string;
  codec: string;
  channels?: number;
  isDefault: boolean;
}

export interface MediaInfo {
  duration: number;
  formatName: string;
  videoStreamIndex: number;
  videoCodec: string;
  audioTracks: AudioTrack[];
}

export interface StreamDescriptor {
  sessionId: string;
  playlistUrl: string;
  sourceDuration: number;
  startOffset: number;
  audioTracks: AudioTrack[];
  selectedAudioStreamIndex: number;
}
```

Create `src/media/runtime.ts`:

```ts
import path from 'node:path';
import type { MediaRuntime, SupportedTarget } from './model';

const TARGETS = new Set<SupportedTarget>([
  'win32-x64', 'win32-arm64',
  'darwin-x64', 'darwin-arm64',
  'linux-x64', 'linux-arm64',
]);

export function resolveRuntime(
  extensionPath: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): MediaRuntime {
  const target = `${platform}-${arch}` as SupportedTarget;
  if (!TARGETS.has(target)) {
    throw new Error(`Mini Player is not supported on ${platform}-${arch}.`);
  }
  const suffix = platform === 'win32' ? '.exe' : '';
  const root = path.join(extensionPath, 'runtime', target);
  return {
    target,
    ffmpegPath: path.join(root, `ffmpeg${suffix}`),
    ffprobePath: path.join(root, `ffprobe${suffix}`),
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npx tsx --test test/media/runtime.test.ts
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/media/model.ts src/media/runtime.ts test/media/runtime.test.ts package.json test/extensionManifest.test.ts
git commit -m "feat: resolve bundled media runtime"
```

## Task 2: Probe And Normalize Media Metadata

**Files:**
- Create: `src/media/probe.ts`
- Create: `src/media/process.ts`
- Create: `src/media/errors.ts`
- Create: `test/media/probe.test.ts`
- Create: `test/fixtures/ffprobe-dual-audio.json`

- [ ] **Step 1: Add failing normalization tests**

Create a small ffprobe fixture with one H.264 video stream and two AAC audio streams. Create `test/media/probe.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { normalizeProbeResult } from '../../src/media/probe';

const fixture = JSON.parse(readFileSync('test/fixtures/ffprobe-dual-audio.json', 'utf8'));

describe('normalizeProbeResult', () => {
  it('normalizes duration, video, and labeled audio tracks', () => {
    const info = normalizeProbeResult(fixture);
    assert.equal(info.duration, 2700.5);
    assert.equal(info.videoStreamIndex, 0);
    assert.equal(info.audioTracks.length, 2);
    assert.equal(info.audioTracks[0].label, 'Cantonese');
    assert.equal(info.audioTracks[1].label, 'Mandarin');
  });

  it('rejects input without video', () => {
    assert.throws(
      () => normalizeProbeResult({ format: { duration: '1' }, streams: [] }),
      /readable video stream/,
    );
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/media/probe.test.ts`.

Expected: FAIL because `normalizeProbeResult` is missing.

- [ ] **Step 3: Implement probe normalization and process runner**

Implement `normalizeProbeResult(raw: unknown): MediaInfo` using explicit runtime guards. Audio labels use `tags.title`, then `tags.language`, then `Audio N`. Select the first video stream and require at least one audio stream.

Implement:

```ts
export async function probeMedia(
  ffprobePath: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<MediaInfo> {
  const result = await runProcess(ffprobePath, [
    '-v', 'error',
    '-show_format',
    '-show_streams',
    '-of', 'json',
    '--',
    filePath,
  ], { signal, timeoutMs: 15_000 });
  return normalizeProbeResult(JSON.parse(result.stdout));
}
```

`runProcess` must call `spawn(executable, args, { shell: false, windowsHide: true })`, capture bounded stdout/stderr, honor timeout and abort, and reject non-zero exit codes.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npx tsx --test test/media/probe.test.ts
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```powershell
git add src/media/probe.ts src/media/process.ts src/media/errors.ts test/media/probe.test.ts test/fixtures/ffprobe-dual-audio.json
git commit -m "feat: probe local media streams"
```

## Task 3: FFmpeg HLS Arguments

**Files:**
- Create: `src/media/ffmpegArgs.ts`
- Create: `test/media/ffmpegArgs.test.ts`

- [ ] **Step 1: Add failing argument tests**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHlsArgs } from '../../src/media/ffmpegArgs';

describe('buildHlsArgs', () => {
  it('uses CPU H.264/AAC encoding and selected streams', () => {
    const args = buildHlsArgs({
      inputPath: 'D:\\show.mkv',
      videoStreamIndex: 0,
      audioStreamIndex: 2,
      startPosition: 125.5,
      playlistPath: 'C:\\cache\\index.m3u8',
      segmentPattern: 'C:\\cache\\segment-%06d.m4s',
    });
    assert.deepEqual(args.slice(0, 4), ['-hide_banner', '-nostdin', '-ss', '125.5']);
    assert.ok(args.includes('0:0'));
    assert.ok(args.includes('0:2'));
    assert.ok(args.includes('libx264'));
    assert.ok(args.includes('aac'));
    assert.ok(args.includes('delete_segments+append_list+independent_segments'));
  });
});
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/media/ffmpegArgs.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure argument builder**

Use:

```ts
return [
  '-hide_banner', '-nostdin',
  '-ss', String(input.startPosition),
  '-i', input.inputPath,
  '-map', `0:${input.videoStreamIndex}`,
  '-map', `0:${input.audioStreamIndex}`,
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-tune', 'zerolatency',
  '-pix_fmt', 'yuv420p',
  '-force_key_frames', 'expr:gte(t,n_forced*2)',
  '-c:a', 'aac',
  '-b:a', '160k',
  '-ac', '2',
  '-f', 'hls',
  '-hls_time', '2',
  '-hls_list_size', '12',
  '-hls_delete_threshold', '4',
  '-hls_segment_type', 'fmp4',
  '-hls_flags', 'delete_segments+append_list+independent_segments',
  '-hls_fmp4_init_filename', 'init.mp4',
  '-hls_segment_filename', input.segmentPattern,
  input.playlistPath,
];
```

- [ ] **Step 4: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/media/ffmpegArgs.ts test/media/ffmpegArgs.test.ts
git commit -m "feat: generate hls transcode arguments"
```

## Task 4: Safe Session Files And Transcode Generation

**Files:**
- Create: `src/media/sessionFiles.ts`
- Create: `src/media/transcodeSession.ts`
- Create: `test/media/sessionFiles.test.ts`
- Create: `test/media/transcodeSession.test.ts`

- [ ] **Step 1: Test safe path ownership**

Test that `resolveSessionPath(root, sessionId, 'index.m3u8')` remains beneath `root`, rejects `..`, and that stale cleanup never accepts `root` itself or an outside path.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx tsx --test test/media/sessionFiles.test.ts test/media/transcodeSession.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement file ownership helpers**

Use `resolve`, `relative`, and `isAbsolute`:

```ts
export function assertOwnedPath(root: string, candidate: string): string {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  const relativePath = relative(resolvedRoot, resolvedCandidate);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Refusing to access a path outside the Mini Player cache.');
  }
  return resolvedCandidate;
}
```

Add `createSessionDirectory`, `removeSessionDirectory`, `removeStaleSessions`, and `calculateDirectoryBytes`.

- [ ] **Step 4: Implement a cancellable generation**

`TranscodeSession.start()` must:

1. Create the directory.
2. Spawn FFmpeg with `shell: false`.
3. Wait for `index.m3u8`, `init.mp4`, and at least one `.m4s` segment using condition polling.
4. Reject on early process exit, abort, or a 20-second startup timeout.

`stop()` must send a graceful termination request, wait up to two seconds, force termination if still running, and remove the owned directory.

Inject `spawnProcess`, clock, and filesystem polling dependencies so tests use fake processes and temporary directories rather than a real FFmpeg binary.

- [ ] **Step 5: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/media/sessionFiles.ts src/media/transcodeSession.ts test/media/sessionFiles.test.ts test/media/transcodeSession.test.ts
git commit -m "feat: manage transcode generations"
```

## Task 5: Authenticated Loopback Media Server

**Files:**
- Create: `src/media/server.ts`
- Create: `test/media/server.test.ts`

- [ ] **Step 1: Add server security tests**

Start the server against a temporary session directory and verify:

- It listens on `127.0.0.1`.
- Missing or wrong token returns `401`.
- `../` traversal returns `404`.
- Unknown files return `404`.
- `.m3u8`, `.m4s`, and `.mp4` receive correct content types.
- The configured Webview origin receives `Access-Control-Allow-Origin`.
- A different origin does not receive that header.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/media/server.test.ts`.

Expected: FAIL because `MediaServer` is missing.

- [ ] **Step 3: Implement the server**

Expose:

```ts
export class MediaServer {
  async start(): Promise<void>;
  setAllowedOrigin(origin: string): void;
  registerSession(sessionId: string, token: string, directory: string): string;
  unregisterSession(sessionId: string): void;
  async dispose(): Promise<void>;
}
```

`registerSession` returns:

```ts
`http://127.0.0.1:${port}/session/${encodeURIComponent(sessionId)}/index.m3u8?token=${encodeURIComponent(token)}`
```

Every request canonicalizes the path and serves only files below the registered directory. Use `createReadStream`; do not read media segments fully into memory.

- [ ] **Step 4: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/media/server.ts test/media/server.test.ts
git commit -m "feat: serve authenticated local media"
```

## Task 6: Playback Manager, Seeking, And Audio Switching

**Files:**
- Create: `src/media/playbackManager.ts`
- Create: `test/media/playbackManager.test.ts`
- Modify: `src/media/model.ts`

- [ ] **Step 1: Add generation-cancellation tests**

Use injected fake probe/session/server dependencies. Verify:

- Opening a source probes it and starts generation 1 with the default audio stream.
- A seek stops generation 1 and starts generation 2 at the requested absolute position.
- Two rapid seeks allow only the newest generation descriptor to be emitted.
- Audio switching preserves current position and paused/playing intent.
- Opening a second file disposes the first session.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/media/playbackManager.test.ts`.

Expected: FAIL because `PlaybackManager` is missing.

- [ ] **Step 3: Implement manager state**

Expose:

```ts
export interface PlaybackRequest {
  filePath: string;
  startPosition: number;
  preferredAudioStreamIndex?: number;
}

export class PlaybackManager {
  async open(request: PlaybackRequest): Promise<StreamDescriptor>;
  async seek(position: number): Promise<StreamDescriptor>;
  async selectAudio(streamIndex: number, position: number): Promise<StreamDescriptor>;
  async dispose(): Promise<void>;
}
```

Maintain a monotonically increasing generation number. After every asynchronous boundary, compare the local generation with the current generation; stale work must stop and must not publish a descriptor.

- [ ] **Step 4: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/media/playbackManager.ts src/media/model.ts test/media/playbackManager.test.ts
git commit -m "feat: coordinate media playback sessions"
```

## Task 7: Bundle And Initialize hls.js

**Files:**
- Modify: `package.json`
- Create: `scripts/copy-hls.mjs`
- Create: `media/vendor/.gitkeep`
- Modify: `.vscodeignore`
- Modify: `src/webview/html.ts`
- Modify: `test/webviewHtml.test.ts`

- [ ] **Step 1: Add failing HTML and manifest tests**

Require:

- `hls.js` is pinned in `dependencies`.
- `npm run build` runs `copy-hls` before esbuild.
- HTML receives `hlsScriptUri` and emits the local script under the same nonce.
- CSP contains `connect-src http://127.0.0.1:*`.
- No CDN URL appears.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx tsx --test test/webviewHtml.test.ts test/extensionManifest.test.ts
```

Expected: FAIL on the missing dependency, script, and CSP.

- [ ] **Step 3: Add pinned client and copy script**

Install a pinned `hls.js` version and create:

```js
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('media/vendor', { recursive: true });
await copyFile('node_modules/hls.js/dist/hls.min.js', 'media/vendor/hls.min.js');
```

Update `createPlayerHtml` to render the local HLS script before `player.js`, both with the generated nonce. Add:

```html
connect-src http://127.0.0.1:*;
media-src blob:;
```

Keep scripts restricted to nonce-bearing extension resources.

- [ ] **Step 4: Verify and commit**

Run `npm install`, `npm test`, and `npm run build`, then:

```powershell
git add package.json package-lock.json scripts/copy-hls.mjs media/vendor/.gitkeep .vscodeignore src/webview/html.ts test/webviewHtml.test.ts test/extensionManifest.test.ts
git commit -m "feat: bundle webview hls client"
```

## Task 8: Extension And Player Panel Integration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/playerPanel.ts`
- Modify: `src/extension.ts`
- Modify: `src/videoFormats.ts`
- Modify: `test/videoFormats.test.ts`
- Create: `test/playerPanelMessages.test.ts`

- [ ] **Step 1: Replace MP4-only tests with broad picker tests**

Require `SUPPORTED_VIDEO_EXTENSIONS` to equal:

```ts
['mp4', 'm4v', 'mkv', 'avi', 'mov', 'webm']
```

Do not reject a source solely from its extension. ffprobe is the authoritative validator.

- [ ] **Step 2: Add message contract tests**

Extend messages with:

```ts
type ExtensionToWebviewMessage =
  | { type: 'loadStream'; payload: StreamDescriptor; subtitle?: SubtitlePayload; volume: number; shouldPlay: boolean }
  | { type: 'streamError'; message: string }
  | /* existing messages */;

type WebviewToExtensionMessage =
  | { type: 'ready'; origin: string }
  | { type: 'requestSeek'; position: number; shouldPlay: boolean }
  | { type: 'requestAudioTrack'; streamIndex: number; position: number; shouldPlay: boolean }
  | /* existing messages */;
```

Test that PlayerPanel routes origin, seek, and audio requests to injected callbacks.

- [ ] **Step 3: Verify RED**

Run:

```powershell
npx tsx --test test/videoFormats.test.ts test/playerPanelMessages.test.ts
```

Expected: FAIL because current behavior is MP4-only and message types are absent.

- [ ] **Step 4: Wire playback lifecycle**

During activation:

1. Resolve and validate the bundled runtime.
2. Create a dedicated output channel.
3. Create the extension-owned cache root under `context.globalStorageUri`.
4. Remove stale sessions.
5. Start `MediaServer` lazily.
6. Create `PlaybackManager`.
7. Pass manager callbacks into `PlayerPanel`.
8. Dispose manager, server, and output channel during deactivation.

`openVideo` and `openRecent` call `playbackManager.open`, then `panel.loadStream`. Seeking and audio selection request a new descriptor and send another `loadStream`.

Show the panel before starting playback so `ready.origin` can configure CORS. Do not restore the direct `asWebviewUri` local-video path.

- [ ] **Step 5: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/types.ts src/playerPanel.ts src/extension.ts src/videoFormats.ts test/videoFormats.test.ts test/playerPanelMessages.test.ts
git commit -m "feat: route videos through transcoding playback"
```

## Task 9: Webview HLS Playback And Absolute Timeline

**Files:**
- Modify: `media/player.js`
- Modify: `media/player.css`
- Modify: `src/webview/html.ts`
- Modify: `test/playerScript.test.ts`
- Modify: `test/playerStyle.test.ts`

- [ ] **Step 1: Add failing script tests**

Assert the script:

- Creates and destroys `Hls` instances.
- Calls `loadSource(payload.playlistUrl)` and `attachMedia(video)`.
- Reports fatal HLS errors through `mediaError`.
- Converts `video.currentTime` to absolute time using `startOffset`.
- Intercepts user seeking and posts `requestSeek`.
- Renders an audio `<select>` and posts `requestAudioTrack`.
- Sends `location.origin` in the ready message.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/playerScript.test.ts test/playerStyle.test.ts`.

Expected: FAIL because the HLS and audio behavior is missing.

- [ ] **Step 3: Implement HLS lifecycle**

Maintain:

```js
let hls = undefined;
let sourceDuration = 0;
let startOffset = 0;
let suppressSeekEvent = false;
```

On `loadStream`:

1. Destroy the prior HLS instance.
2. Set `sourceDuration` and `startOffset`.
3. Populate audio tracks.
4. Create `new Hls({ enableWorker: true, lowLatencyMode: false })`.
5. Attach media, load playlist, and restore volume/play state.

On fatal HLS error, destroy the instance and post a concise `mediaError`.

Playback state sends:

```js
position: Math.min(sourceDuration, startOffset + video.currentTime)
```

External ASS cue rendering also uses this absolute position.

- [ ] **Step 4: Implement restart-based seeking**

On a trusted user seek request, prevent the browser from treating the finite HLS window as the full source timeline and post:

```js
{
  type: 'requestSeek',
  position: requestedAbsolutePosition,
  shouldPlay: !video.paused,
}
```

Use a dedicated source-position range input if native `<video>` seeking cannot represent the full duration reliably. The range input has `min=0`, `max=sourceDuration`, and is synchronized from absolute playback state.

- [ ] **Step 5: Implement audio selector**

Add `<select id="audio-track-select">` to the toolbar. Hide it for one track. On change, post stream index, current absolute position, and desired play state.

- [ ] **Step 6: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add media/player.js media/player.css src/webview/html.ts test/playerScript.test.ts test/playerStyle.test.ts
git commit -m "feat: play transcoded hls streams"
```

## Task 10: Runtime Validation, Cache Limits, And Diagnostics

**Files:**
- Modify: `src/media/runtime.ts`
- Modify: `src/media/sessionFiles.ts`
- Modify: `src/media/transcodeSession.ts`
- Modify: `src/media/errors.ts`
- Create: `test/media/errors.test.ts`
- Modify: related media tests

- [ ] **Step 1: Add failing resilience tests**

Cover:

- Missing executable.
- Non-executable Unix runtime.
- Probe timeout.
- FFmpeg exits before playlist readiness.
- Session cache exceeds configured bytes.
- Cleanup refuses cache root and outside paths.
- User errors are concise while detailed stderr is retained separately.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/media/*.test.ts`.

Expected: new tests fail on missing validation and error mapping.

- [ ] **Step 3: Implement bounded behavior**

Validate both binaries with `stat` and an executable smoke test (`-version`). Limit captured stderr to the most recent 256 KiB. Poll cache size while active and stop the session if it exceeds the configured maximum. Default the cache maximum to 512 MiB and keep it internal for the first release.

- [ ] **Step 4: Verify and commit**

Run `npm test` and `npm run build`, then:

```powershell
git add src/media/runtime.ts src/media/sessionFiles.ts src/media/transcodeSession.ts src/media/errors.ts test/media
git commit -m "feat: harden bundled media runtime"
```

## Task 11: Runtime Manifest, Licensing, And Platform Packaging

**Files:**
- Create: `runtime/manifest.json`
- Create: `runtime/LICENSES/FFmpeg-LGPL.txt`
- Create: `runtime/SOURCE-OFFER.md`
- Create: `scripts/fetch-runtime.mjs`
- Create: `scripts/package-platform.mjs`
- Modify: `package.json`
- Modify: `.vscodeignore`
- Modify: `README.md`
- Create: `test/runtimeManifest.test.ts`

- [ ] **Step 1: Add failing manifest validation tests**

Validate that all six targets exist and each has:

- Pinned FFmpeg version.
- HTTPS archive URL.
- 64-character SHA-256.
- Archive layout entries for ffmpeg and ffprobe.
- Build configuration excluding GPL and nonfree.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test test/runtimeManifest.test.ts`.

Expected: FAIL because the manifest is missing.

- [ ] **Step 3: Implement checksum-verified acquisition**

`fetch-runtime.mjs --target win32-x64` must:

1. Read the target entry.
2. Download to a temporary file.
3. Calculate SHA-256 and reject mismatch.
4. Extract only ffmpeg, ffprobe, licenses, and build metadata.
5. Write to `runtime/<target>/`.
6. Set executable mode on Unix.

Do not invent artifact URLs or checksums. Select a reproducible LGPL-compatible provider or build pipeline, verify its license configuration, and record exact immutable release URLs and hashes.

- [ ] **Step 4: Implement target packaging**

`package-platform.mjs --target <target>` runs the runtime fetch, build, tests, and:

```powershell
npx @vscode/vsce package --target <target> --out artifacts/mini-player-<target>.vsix
```

Update `.vscodeignore` so a target package includes only its selected runtime. If `vsce` cannot express that exclusion directly, stage a clean package directory before invoking it.

- [ ] **Step 5: Document distribution**

README must state:

- Desktop-only support.
- Six supported targets.
- No external installation requirement.
- CPU usage and startup-delay expectations.
- FFmpeg license/source/build information location.
- Embedded subtitles are not yet selectable.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test
npm run build
node scripts/fetch-runtime.mjs --target win32-x64 --verify-only
```

Expected: tests/build pass and manifest checksum metadata validates without downloading when `--verify-only` is used.

Commit:

```powershell
git add runtime scripts package.json package-lock.json .vscodeignore README.md test/runtimeManifest.test.ts
git commit -m "build: package platform media runtimes"
```

## Task 12: Cross-Platform CI

**Files:**
- Create: `.github/workflows/platform-packages.yml`
- Modify: `README.md`

- [ ] **Step 1: Add the workflow**

Use a matrix containing:

```yaml
target:
  - win32-x64
  - win32-arm64
  - darwin-x64
  - darwin-arm64
  - linux-x64
  - linux-arm64
```

Each job checks out the source, installs the pinned Node version, runs `npm ci`, validates runtime metadata, builds, tests, packages the selected VSIX, and uploads it as an artifact. Native runtime smoke tests run only where the runner architecture matches; cross-target jobs still verify checksums and package contents.

- [ ] **Step 2: Validate workflow and package contents**

Run the repository's available YAML validator, then package the host target and inspect:

```powershell
npx @vscode/vsce ls --target win32-x64
```

Expected: extension bundle, `media/vendor/hls.min.js`, one platform runtime, and FFmpeg notices are present; source tests, docs, other platform runtimes, and temporary files are absent.

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/platform-packages.yml README.md
git commit -m "ci: build platform-specific extensions"
```

## Task 13: Integration Fixtures And End-To-End Verification

**Files:**
- Create: `test/integration/transcoding.test.ts`
- Create: `test/fixtures/media/README.md`
- Create: short license-safe generated media fixtures or a fixture-generation script
- Modify: `package.json`

- [ ] **Step 1: Add integration tests**

When the host runtime is available, test:

- MP4/H.264/AAC starts and produces HLS.
- MKV/H.264/AAC starts and produces HLS.
- A non-native video codec transcodes to H.264.
- A non-native audio codec transcodes to AAC.
- Dual audio selection changes the mapped stream.
- Seek starts a new generation at the requested offset.
- Corrupt input fails and leaves no session directory.
- Cancellation terminates FFmpeg and removes temporary output.

Skip with an explicit reason only when the target runtime has not been fetched.

- [ ] **Step 2: Run automated verification**

Run:

```powershell
npm test
npm run build
npm run test:integration
git diff --check
```

Expected: all applicable checks pass with no leaked FFmpeg process or temporary session directory.

- [ ] **Step 3: Perform manual Extension Host verification**

Verify the checklist from the design, including:

- `D:\The.Greed.of.Man.1992.E01.TVB.WEB-DL.1080p.H264.AAC.2Audio-Xiaomi.mkv`
- Playback start, sound, pause, resume, and quick hide.
- Repeated and rapid seeks.
- Both embedded audio tracks.
- External subtitle timing after seek and audio switch.
- Opening a second source.
- Closing the panel and shutting down VS Code during transcoding.
- Restart cleanup after forced termination.

- [ ] **Step 4: Commit**

```powershell
git add test/integration test/fixtures/media package.json package-lock.json
git commit -m "test: cover bundled transcoding playback"
```

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:integration` with the host runtime installed.
- [ ] Run `git diff --check`.
- [ ] Run `git status --short` and confirm no generated runtime archives, HLS segments, or unrelated user changes are staged.
- [ ] Package the host VSIX and inspect its contents.
- [ ] Install the host VSIX into a clean VS Code profile and repeat the manual playback checklist.
- [ ] Confirm FFmpeg notices, source offer, build configuration, version, and checksums match the packaged binary.
