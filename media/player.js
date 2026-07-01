const vscode = acquireVsCodeApi();
const video = document.getElementById('video');
const title = document.getElementById('title');
const subtitleButton = document.getElementById('subtitle-button');
const recentButton = document.getElementById('recent-button');
const openCacheButton = document.getElementById('open-cache-button');
const clearCacheButton = document.getElementById('clear-cache-button');
const muteButton = document.getElementById('mute-button');
const volumeSlider = document.getElementById('volume-slider');
const cornerButton = document.getElementById('corner-button');
const assLayer = document.getElementById('ass-layer');
const activityLogLines = document.getElementById('activity-log-lines');
const MAX_ACTIVITY_LOG_LINES = 100;

let activeBlobUrl = undefined;
let activeSubtitleTrack = undefined;
let assCues = [];
let lastVolumeLogAt = 0;
let progressLogTimer = undefined;
let mediaAudioContext = undefined;
let mediaAudioSource = undefined;
let mediaAudioOutputConnected = false;

appendActivity('Player panel ready.');

subtitleButton.addEventListener('click', () => vscode.postMessage({ type: 'requestSubtitle' }));
recentButton.addEventListener('click', () => vscode.postMessage({ type: 'requestRecent' }));
openCacheButton.addEventListener('click', () => vscode.postMessage({ type: 'requestOpenCache' }));
clearCacheButton.addEventListener('click', () => vscode.postMessage({ type: 'requestClearCache' }));
cornerButton.addEventListener('click', () => vscode.postMessage({ type: 'requestToggleCorner' }));
muteButton.addEventListener('click', () => {
  video.muted = !video.muted;
  updateVolumeControls();
  appendActivity(video.muted ? 'Audio muted.' : 'Audio unmuted.');
  sendPlaybackState();
});
volumeSlider.addEventListener('input', () => {
  video.volume = Number(volumeSlider.value);
  video.muted = video.volume === 0;
  updateVolumeControls();
  logVolumeChange();
});

video.addEventListener('error', () => {
  appendActivity('Video playback error reported.');
  vscode.postMessage({
    type: 'mediaError',
    message: 'This video cannot be played in VS Code. Use a file encoded with codecs supported by VS Code.',
  });
});

video.addEventListener('timeupdate', () => {
  sendPlaybackState();
  renderAssCue();
});
video.addEventListener('volumechange', () => {
  updateVolumeControls();
  logAudioState('Volume changed');
  sendPlaybackState();
});
video.addEventListener('loadedmetadata', () => {
  logAudioState('Media metadata loaded');
});
video.addEventListener('play', () => {
  appendActivity('Playback started.');
  ensureMediaAudioOutput();
  logAudioState('Playback started');
  startProgressLogging();
  sendPlaybackState();
});
video.addEventListener('pause', () => {
  stopProgressLogging();
  appendActivity('Playback paused.');
  sendPlaybackState();
});
video.addEventListener('ended', () => {
  stopProgressLogging();
  appendProgressActivity();
});

window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'loadVideo') {
    loadVideo(message.payload);
  }
  if (message.type === 'loadSubtitle') {
    loadSubtitle(message.payload);
  }
  if (message.type === 'appendActivity') {
    appendActivity(message.message);
  }
  if (message.type === 'pause') {
    video.pause();
    appendActivity('Quick hide pause applied.');
  }
  if (message.type === 'setCornerPosition') {
    setCornerPosition(message.position);
  }
  if (message.type === 'restoreState') {
    video.muted = message.muted;
    video.volume = message.volume;
    video.currentTime = message.position;
  }
});

function loadVideo(payload) {
  stopProgressLogging();
  title.textContent = payload.name;
  video.src = payload.uri;
  video.muted = false;
  video.volume = payload.volume;
  updateVolumeControls();

  if (typeof payload.position === 'number') {
    video.currentTime = payload.position;
  }
  appendActivity(`Loaded video: ${payload.name}`);
  if (payload.subtitle) {
    loadSubtitle(payload.subtitle);
  }
}

function loadSubtitle(payload) {
  clearSubtitle();

  if (payload.format === 'srt' || payload.format === 'vtt') {
    loadTextTrack(payload);
    appendActivity(`Loaded ${payload.format.toUpperCase()} subtitle: ${payload.name}`);
    return;
  }
  if (payload.format === 'ass' || payload.format === 'ssa') {
    assCues = parseAssDialogueLines(payload.content ?? '');
    if (assCues.length === 0) {
      appendActivity(`Loaded ${payload.format.toUpperCase()} subtitle with no readable dialogue.`);
      vscode.postMessage({ type: 'subtitleError', message: 'ASS/SSA subtitle has no readable dialogue lines.' });
    }
    appendActivity(`Loaded ${payload.format.toUpperCase()} subtitle: ${payload.name}`);
    renderAssCue();
    return;
  }

  appendActivity(`Unsupported subtitle format: ${payload.format}`);
  vscode.postMessage({ type: 'subtitleError', message: `Unsupported subtitle format: ${payload.format}` });
}

function loadTextTrack(payload) {
  const content = payload.content ?? '';
  const blob = new Blob([content], { type: 'text/vtt' });
  activeBlobUrl = URL.createObjectURL(blob);
  activeSubtitleTrack = document.createElement('track');
  activeSubtitleTrack.kind = 'subtitles';
  activeSubtitleTrack.label = payload.name;
  activeSubtitleTrack.default = true;
  activeSubtitleTrack.src = activeBlobUrl;
  video.append(activeSubtitleTrack);
}

function clearSubtitle() {
  assCues = [];
  assLayer.textContent = '';
  assLayer.style.fontFamily = '';
  assLayer.style.fontSize = '';
  assLayer.style.color = '';
  assLayer.style.textShadow = '';
  if (activeSubtitleTrack) {
    activeSubtitleTrack.remove();
    activeSubtitleTrack = undefined;
  }
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = undefined;
  }
}

function renderAssCue() {
  if (assCues.length === 0) {
    return;
  }

  const current = video.currentTime;
  const active = assCues.filter((cue) => cue.start <= current && cue.end >= current);
  const firstStyle = active[0]?.style;
  assLayer.textContent = active.map((cue) => cue.text).join('\n');
  assLayer.style.fontFamily = firstStyle?.fontFamily ?? '';
  assLayer.style.fontSize = firstStyle?.fontSize
    ? `${Math.max(14, Math.min(42, firstStyle.fontSize))}px`
    : '';
  assLayer.style.color = firstStyle?.color ?? '';
  assLayer.style.textShadow = `0 1px ${firstStyle?.outline ?? 2}px #000, 0 0 4px #000`;
}

function parseAssDialogueLines(script) {
  const lines = script.split('\n');
  const styles = parseAssStyles(lines);
  const eventsIndex = lines.findIndex((line) => line.trim() === '[Events]');
  if (eventsIndex < 0) {
    return [];
  }

  const formatLine = lines.slice(eventsIndex + 1).find((line) => line.startsWith('Format:'));
  const fields = formatLine
    ? formatLine.slice('Format:'.length).split(',').map((field) => field.trim().toLowerCase())
    : [];
  const startIndex = fields.indexOf('start');
  const endIndex = fields.indexOf('end');
  const styleIndex = fields.indexOf('style');
  const textIndex = fields.indexOf('text');
  if (startIndex < 0 || endIndex < 0 || textIndex < 0) {
    return [];
  }

  return lines
    .filter((line) => line.startsWith('Dialogue:'))
    .map((line) => splitAssCsv(line.slice('Dialogue:'.length), fields.length))
    .map((parts) => ({
      start: parseAssTime(parts[startIndex]),
      end: parseAssTime(parts[endIndex]),
      style: styles.get((parts[styleIndex] ?? '').trim()),
      text: parts
        .slice(textIndex)
        .join(',')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\\N/g, '\n')
        .trim(),
    }))
    .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text.length > 0);
}

function parseAssStyles(lines) {
  const stylesIndex = lines.findIndex(
    (line) => line.trim() === '[V4+ Styles]' || line.trim() === '[V4 Styles]',
  );
  if (stylesIndex < 0) {
    return new Map();
  }

  const formatLine = lines.slice(stylesIndex + 1).find((line) => line.startsWith('Format:'));
  const fields = formatLine
    ? formatLine.slice('Format:'.length).split(',').map((field) => field.trim().toLowerCase())
    : [];
  const nameIndex = fields.indexOf('name');
  const fontIndex = fields.indexOf('fontname');
  const sizeIndex = fields.indexOf('fontsize');
  const colorIndex = fields.indexOf('primarycolour');
  const outlineIndex = fields.indexOf('outline');
  if (nameIndex < 0) {
    return new Map();
  }

  const result = new Map();
  for (const line of lines.slice(stylesIndex + 1).filter((entry) => entry.startsWith('Style:'))) {
    const parts = splitAssCsv(line.slice('Style:'.length), fields.length);
    const name = (parts[nameIndex] ?? '').trim();
    if (name.length === 0) {
      continue;
    }
    result.set(name, {
      fontFamily: (parts[fontIndex] ?? '').trim() || undefined,
      fontSize: Number(parts[sizeIndex]) || undefined,
      color: parseAssColor(parts[colorIndex]),
      outline: Number(parts[outlineIndex]) || 2,
    });
  }

  return result;
}

function splitAssCsv(value, expectedFields) {
  const parts = value.split(',');
  if (expectedFields > 0 && parts.length > expectedFields) {
    return [...parts.slice(0, expectedFields - 1), parts.slice(expectedFields - 1).join(',')];
  }

  return parts;
}

function parseAssColor(value) {
  const match = (value ?? '').trim().match(/^&H([0-9A-Fa-f]{8})$/);
  if (!match) {
    return undefined;
  }

  const raw = match[1];
  const blue = raw.slice(2, 4);
  const green = raw.slice(4, 6);
  const red = raw.slice(6, 8);
  return `#${red}${green}${blue}`;
}

function parseAssTime(value) {
  const match = value.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 100;
}

function sendPlaybackState() {
  vscode.postMessage({
    type: 'playbackState',
    position: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    paused: video.paused,
    volume: video.volume,
    muted: video.muted,
  });
}

function updateVolumeControls() {
  volumeSlider.value = String(video.volume);
  muteButton.textContent = video.muted || video.volume === 0 ? 'Muted' : 'Sound';
  muteButton.setAttribute('aria-pressed', String(video.muted || video.volume === 0));
}

function setCornerPosition(position) {
  const next = position === 'left' ? 'left' : 'right';
  document.body.classList.toggle('corner-left', next === 'left');
  document.body.classList.toggle('corner-right', next === 'right');
  cornerButton.textContent = next === 'left' ? 'Left' : 'Right';
  appendActivity(`Preview pinned ${next}.`);
}

function logVolumeChange() {
  const now = Date.now();
  if (now - lastVolumeLogAt < 750) {
    return;
  }
  lastVolumeLogAt = now;
  appendActivity(`Volume set to ${Math.round(video.volume * 100)}%.`);
}

function logAudioState(context) {
  appendActivity(
    `${context}. Volume: ${Math.round(video.volume * 100)}% | Muted: ${video.muted ? 'yes' : 'no'} | Ready: ${video.readyState} | Network: ${video.networkState}`,
  );
}

function ensureMediaAudioOutput() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    appendActivity('Web Audio output is not available.');
    return;
  }

  try {
    mediaAudioContext ??= new AudioContextConstructor();
    mediaAudioSource ??= mediaAudioContext.createMediaElementSource(video);
    if (!mediaAudioOutputConnected) {
      mediaAudioSource.connect(mediaAudioContext.destination);
      mediaAudioOutputConnected = true;
      appendActivity('Audio output connected.');
    }
    if (mediaAudioContext.state === 'suspended') {
      void mediaAudioContext.resume();
    }
  } catch (error) {
    appendActivity(`Audio output setup failed: ${error?.message ?? String(error)}`);
  }
}

function startProgressLogging() {
  stopProgressLogging();
  appendProgressActivity();
  progressLogTimer = window.setInterval(appendProgressActivity, 1000);
}

function stopProgressLogging() {
  if (!progressLogTimer) {
    return;
  }

  window.clearInterval(progressLogTimer);
  progressLogTimer = undefined;
}

function appendProgressActivity() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const remaining = Math.max(0, duration - video.currentTime);
  appendActivity(
    `Current: ${formatDuration(video.currentTime)} | Remaining: ${formatDuration(remaining)} | Clock: ${formatClockTime()}`,
  );
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatClockTime() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function isActivityLogPinnedToBottom() {
  return activityLogLines.scrollHeight - activityLogLines.scrollTop - activityLogLines.clientHeight <= 2;
}

function appendActivity(message) {
  const shouldStickToBottom = isActivityLogPinnedToBottom();
  const entry = document.createElement('div');
  entry.className = 'activity-log-line';
  entry.textContent = `[${new Date().toLocaleTimeString([], { hour12: false })}] ${message}`;
  activityLogLines.append(entry);

  while (activityLogLines.children.length > MAX_ACTIVITY_LOG_LINES) {
    activityLogLines.firstElementChild?.remove();
  }

  if (shouldStickToBottom) {
    activityLogLines.scrollTop = activityLogLines.scrollHeight;
  }
}

vscode.postMessage({ type: 'ready' });
