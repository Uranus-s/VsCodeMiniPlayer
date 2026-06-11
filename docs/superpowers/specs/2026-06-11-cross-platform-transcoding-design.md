# Cross-Platform Bundled Transcoding Design

## Summary

Mini Player will play common local video containers and codecs in desktop VS Code without requiring users to install external software. Each platform-specific VSIX will bundle an LGPL-compatible FFmpeg and ffprobe build. The extension will probe the selected file, transcode it with CPU software encoding, expose temporary HLS/fMP4 output through a loopback-only HTTP server, and play that stream in the existing Webview through a bundled HLS client.

The first release will support external subtitles and selectable embedded audio tracks. Embedded subtitle selection is outside this release.

## Supported Environments

The extension targets desktop VS Code only:

- Windows x64 and ARM64
- macOS x64 and Apple Silicon
- Linux x64 and ARM64

VS Code for Web, GitHub Codespaces, and remote extension-host playback are not supported. The video file, FFmpeg process, temporary media, HTTP server, and Webview must all run on the same local machine.

## Playback Scope

The file picker will accept common local video containers, including:

- MP4 and M4V
- MKV
- AVI
- MOV
- WebM

ffprobe, rather than the filename extension, determines whether a selected file contains readable media streams. Common codecs such as H.264, H.265/HEVC, VP8, VP9, AV1, AAC, AC3, DTS, MP3, Vorbis, and Opus are accepted when the bundled FFmpeg build can decode them.

All playback output uses:

- H.264 video
- AAC audio
- fragmented MP4 segments delivered through HLS

The initial implementation always uses CPU software transcoding for predictable behavior across platforms. Hardware acceleration is not part of this release.

## Architecture

### Platform Runtime

Each platform-specific VSIX contains matching `ffmpeg` and `ffprobe` executables under a runtime directory owned by the extension. Runtime selection is based on `process.platform` and `process.arch`. The extension rejects unsupported platform and architecture combinations before opening a playback session.

Executables are invoked directly with argument arrays through Node child-process APIs. File names and user-controlled values are never interpolated into shell commands.

### Media Probe

A `MediaProbe` component runs ffprobe and returns a typed model containing:

- Duration
- Container
- Video streams and codecs
- Audio streams, codecs, language, title, channel count, and default disposition
- A stable stream index for each selectable audio track

The default audio track is the stream marked as default, otherwise the first audio stream. Probe failures are converted into concise user-facing errors while detailed stderr remains available in a Mini Player output channel.

### Transcoding Session

A `TranscodeSession` owns one FFmpeg process and one temporary output directory. It receives:

- Input file path
- Selected audio stream index
- Start position
- Output directory

FFmpeg maps the primary video stream and selected audio stream, encodes them as H.264 and AAC, and writes a bounded HLS playlist using fMP4 segments. Segment duration should initially be two seconds to balance startup delay, seeking granularity, and filesystem activity.

The HLS playlist uses a sliding window and deletes consumed segments. The extension also applies a maximum session-cache limit. If FFmpeg or the filesystem cannot maintain the limit, playback stops with a clear error instead of allowing unbounded disk growth.

### Loopback Media Server

A `MediaServer` starts lazily when the first transcoded video is opened. It:

- Binds only to `127.0.0.1` on an operating-system-assigned port
- Generates a cryptographically random token for each playback session
- Serves only the active session playlist and segment files
- Rejects missing or invalid tokens
- Rejects traversal and paths outside the active session directory
- Uses appropriate HLS, MP4, and cache-control headers
- Allows cross-origin requests only for the active VS Code Webview origin

The Webview CSP permits media connections only to the generated loopback origin. The server does not expose a directory listing or arbitrary local files.

### Webview HLS Client

The VSIX bundles a pinned `hls.js` browser build. The Webview uses `hls.js` and Media Source Extensions to load the authenticated HLS playlist and append fMP4 segments to the existing `<video>` element. It does not depend on Chromium providing native HLS playlist support.

The HLS client is loaded from the extension's own Webview resource URI under the existing nonce-based CSP. It makes requests only to the active loopback origin. No script or media dependency is loaded from a CDN.

### Player Panel Integration

`PlayerPanel.loadVideo` becomes a playback-session request instead of directly converting a local file path with `asWebviewUri`.

The extension performs this sequence:

1. Probe the selected file.
2. Select the default audio track.
3. Create a temporary session directory under `globalStorageUri`.
4. Start FFmpeg.
5. Wait until the HLS playlist and initial playable segments exist.
6. Send the authenticated loopback playlist URL, permitted server origin, and audio-track metadata to the Webview.
7. Attach a fresh `hls.js` instance to the `<video>` element and load the playlist.
8. Begin normal browser playback after the manifest is parsed and media is attached.

The existing playback state, recent-file storage, corner positioning, quick hide, activity log, and external subtitle behavior remain in place.

## Seeking

Seeking restarts transcoding rather than retaining a complete converted copy.

When the user seeks:

1. The Webview sends the requested absolute media time.
2. The extension records the target and stops the current FFmpeg process.
3. The extension creates a new session generation from the target time.
4. FFmpeg starts with input seeking and writes a fresh HLS playlist.
5. Once initial segments are ready, the Webview loads the new playlist.
6. Player state continues to report absolute source time by adding the session start offset.

Only the newest seek request may become active. Older generations are cancelled and ignored to prevent rapid scrubbing from restoring stale streams.

## Audio Track Selection

The toolbar will expose an audio-track selector when ffprobe reports multiple audio streams. Labels use language and title metadata when available, with a stable fallback such as `Audio 2`.

Changing the audio track:

1. Captures the current absolute playback position.
2. Stops the current transcode generation.
3. Starts a new generation at the same position with the selected stream index.
4. Restores playing or paused state after the new stream is ready.

The selected audio track is stored in the current playback state. Recent-history persistence of the selected track may be added if it can be done without breaking existing records; otherwise it remains session-only in the first release.

## Subtitles

Existing external subtitle support remains unchanged:

- SRT
- VTT
- ASS
- SSA

Subtitle timing uses absolute source time so it remains correct after a transcode restart. Embedded subtitle discovery and selection are explicitly excluded from the first release.

## Lifecycle And Cleanup

The session manager guarantees one active transcode session per player.

It stops the process and removes temporary output when:

- A different video is opened
- The active audio track changes
- A seek replaces the current generation
- The Webview is disposed
- The extension deactivates
- Playback setup fails

Process termination first requests graceful shutdown, then uses a bounded forced termination fallback. Cleanup validates that every removed path resolves beneath the extension-owned session root.

At activation, the extension removes stale session directories left by a previous crash. It must not touch files outside its own `globalStorageUri` media-cache directory.

## Error Handling

User-facing errors cover:

- Unsupported operating system or architecture
- Missing, damaged, or non-executable bundled runtime
- File not found or unreadable
- No readable video stream
- No readable audio stream
- Probe timeout or failure
- FFmpeg startup or transcoding failure
- Playlist startup timeout
- Media-server failure
- Cache-size or disk-space failure

Messages remain concise and actionable. Detailed FFmpeg and ffprobe diagnostics go to a dedicated output channel. The extension does not retry indefinitely and always cleans up a failed session.

## Packaging And Licensing

The project publishes six platform-specific VSIX artifacts:

- `win32-x64`
- `win32-arm64`
- `darwin-x64`
- `darwin-arm64`
- `linux-x64`
- `linux-arm64`

The packaging pipeline downloads or builds pinned FFmpeg artifacts, verifies checksums, copies only the target runtime into the VSIX, sets executable permissions where required, and packages with the corresponding VS Code target.

FFmpeg builds must:

- Exclude `--enable-gpl`
- Exclude `--enable-nonfree`
- Include only codecs and components whose distribution is compatible with the chosen license
- Be accompanied by required license notices
- Provide the exact corresponding FFmpeg source and build configuration as required by the LGPL

Runtime versions and checksums are recorded in source control. Unpinned third-party binary downloads are not allowed in release builds.

## Security

The implementation must preserve these boundaries:

- Loopback binding only
- Per-session random bearer token
- No shell execution
- No arbitrary file serving
- Canonical path validation before serving or deleting files
- Bounded process startup and shutdown timeouts
- Bounded disk cache
- Restrictive Webview CSP
- No network access to external media services

The feature remains a local, user-controlled media player and does not introduce hidden processes or deceptive activity.

## Testing

### Unit Tests

Tests cover:

- Platform runtime resolution
- Unsupported platform errors
- ffprobe JSON normalization
- Default and explicit audio-track selection
- FFmpeg argument generation
- Seek offset calculations
- Session-generation cancellation
- Token validation
- Path traversal rejection
- MIME and cache headers
- Loopback CORS restrictions
- Cache-limit enforcement
- Safe cleanup boundaries
- User-facing error normalization
- Webview messages for stream readiness, seeking, and audio selection
- HLS client creation, teardown, and fatal-error reporting

### Integration Tests

Fixtures should be short and license-safe. Integration coverage includes:

- MP4/H.264/AAC input
- MKV/H.264/AAC input
- A non-native video codec requiring video transcoding
- A non-native audio codec requiring audio transcoding
- Multiple audio tracks
- Seek restart
- Audio-track restart
- Failed and corrupt input
- Process cancellation and temporary-file cleanup

CI runs the applicable runtime tests on each supported operating system and architecture where runners are available.

### Manual Verification

Each release verifies:

- The user's large dual-audio MKV
- Long-duration playback
- Pause and resume
- Repeated seeks
- Rapid seek cancellation
- Audio-track switching
- External subtitles after seeking
- Quick hide behavior
- Opening a second file
- VS Code shutdown during transcoding
- Recovery and stale-cache cleanup after forced termination

## Delivery Sequence

Implementation is divided into these milestones:

1. Runtime manifest, platform resolution, licensing metadata, and packaging scripts.
2. ffprobe integration and normalized media metadata.
3. FFmpeg HLS session generation and cleanup.
4. Authenticated loopback media server.
5. Player integration and startup lifecycle.
6. Seeking with generation cancellation.
7. Multi-audio UI and restart behavior.
8. Cross-platform CI, platform-specific VSIX packaging, and manual compatibility validation.

The existing direct MP4 path may remain as a temporary development fallback, but the released behavior should use one session architecture for all supported input formats to avoid inconsistent playback paths.
