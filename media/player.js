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
const activityLogTitle = document.querySelector('.activity-log-title');
const activityLog = document.getElementById('activity-log');
const activityLogLines = document.getElementById('activity-log-lines');
const MAX_ACTIVITY_LOG_LINES = 100;
const TEXT = {
  en: {
    activityLogTitle: 'Mini Player Activity',
    activityLogAria: 'Mini Player activity log',
    noVideoSelected: 'No video selected',
    muteAria: 'Mute or unmute video',
    volumeAria: 'Video volume',
    cornerAria: 'Switch mini player side',
    sound: 'Sound',
    muted: 'Muted',
    left: 'Left',
    right: 'Right',
    subtitle: 'Subtitle',
    recent: 'Recent',
    openCache: 'Open Cache',
    clearCache: 'Clear Cache',
    panelReady: 'Player panel ready.',
    audioMuted: 'Audio muted.',
    audioUnmuted: 'Audio unmuted.',
    videoPlaybackError: 'Video playback error reported.',
    mediaError: 'This video cannot be played in VS Code. Use a file encoded with codecs supported by VS Code.',
    playbackStarted: 'Playback started.',
    playbackPaused: 'Playback paused.',
    quickHidePauseApplied: 'Quick hide pause applied.',
    loadedVideo: (name) => `Loaded video: ${name}`,
    loadedSubtitle: (format, name) => `Loaded ${format} subtitle: ${name}`,
    loadedSubtitleNoDialogue: (format) => `Loaded ${format} subtitle with no readable dialogue.`,
    subtitleNoDialogueError: 'ASS/SSA subtitle has no readable dialogue lines.',
    unsupportedSubtitleFormat: (format) => `Unsupported subtitle format: ${format}`,
    volumeSet: (volume) => `Volume set to ${volume}%.`,
    audioState: (context, volume, muted, readyState, networkState) =>
      `${context}. Volume: ${volume}% | Muted: ${muted ? 'yes' : 'no'} | Ready: ${readyState} | Network: ${networkState}`,
    webAudioUnavailable: 'Web Audio output is not available.',
    audioOutputConnected: 'Audio output connected.',
    audioOutputSetupFailed: (message) => `Audio output setup failed: ${message}`,
    previewPinned: (position) => `Preview pinned ${position}.`,
  },
  'zh-CN': {
    activityLogTitle: '迷你播放器活动',
    activityLogAria: '迷你播放器活动日志',
    noVideoSelected: '未选择视频',
    muteAria: '静音或取消静音视频',
    volumeAria: '视频音量',
    cornerAria: '切换迷你播放器侧边',
    sound: '声音',
    muted: '已静音',
    left: '左侧',
    right: '右侧',
    subtitle: '字幕',
    recent: '最近播放',
    openCache: '打开缓存',
    clearCache: '清理缓存',
    panelReady: '播放器面板已就绪。',
    audioMuted: '音频已静音。',
    audioUnmuted: '音频已取消静音。',
    videoPlaybackError: '已报告视频播放错误。',
    mediaError: '此视频无法在 VS Code 中播放。请使用 VS Code 支持的编解码格式。',
    playbackStarted: '播放已开始。',
    playbackPaused: '播放已暂停。',
    quickHidePauseApplied: '快速隐藏已暂停播放。',
    loadedVideo: (name) => `已加载视频：${name}`,
    loadedSubtitle: (format, name) => `已加载 ${format} 字幕：${name}`,
    loadedSubtitleNoDialogue: (format) => `已加载 ${format} 字幕，但没有可读对白。`,
    subtitleNoDialogueError: 'ASS/SSA 字幕没有可读对白行。',
    unsupportedSubtitleFormat: (format) => `不支持的字幕格式：${format}`,
    volumeSet: (volume) => `音量已设为 ${volume}%。`,
    audioState: (context, volume, muted, readyState, networkState) =>
      `${context}。音量：${volume}% | 静音：${muted ? '是' : '否'} | 就绪状态：${readyState} | 网络状态：${networkState}`,
    webAudioUnavailable: 'Web Audio 输出不可用。',
    audioOutputConnected: '音频输出已连接。',
    audioOutputSetupFailed: (message) => `音频输出设置失败：${message}`,
    previewPinned: (position) => `预览已固定在${position}。`,
  },
};

let activeBlobUrl = undefined;
let activeSubtitleTrack = undefined;
let assCues = [];
let lastVolumeLogAt = 0;
let progressLogTimer = undefined;
let mediaAudioContext = undefined;
let mediaAudioSource = undefined;
let mediaAudioOutputConnected = false;
let language = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en';
let currentCornerPosition = 'right';
let hasLoadedVideo = false;

appendActivity(t().panelReady);

subtitleButton.addEventListener('click', () => vscode.postMessage({ type: 'requestSubtitle' }));
recentButton.addEventListener('click', () => vscode.postMessage({ type: 'requestRecent' }));
openCacheButton.addEventListener('click', () => vscode.postMessage({ type: 'requestOpenCache' }));
clearCacheButton.addEventListener('click', () => vscode.postMessage({ type: 'requestClearCache' }));
cornerButton.addEventListener('click', () => vscode.postMessage({ type: 'requestToggleCorner' }));
muteButton.addEventListener('click', () => {
  video.muted = !video.muted;
  updateVolumeControls();
  appendActivity(video.muted ? t().audioMuted : t().audioUnmuted);
  sendPlaybackState();
});
volumeSlider.addEventListener('input', () => {
  video.volume = Number(volumeSlider.value);
  video.muted = video.volume === 0;
  updateVolumeControls();
  logVolumeChange();
});

video.addEventListener('error', () => {
  appendActivity(t().videoPlaybackError);
  vscode.postMessage({
    type: 'mediaError',
    message: t().mediaError,
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
  appendActivity(t().playbackStarted);
  ensureMediaAudioOutput();
  logAudioState('Playback started');
  startProgressLogging();
  sendPlaybackState();
});
video.addEventListener('pause', () => {
  stopProgressLogging();
  appendActivity(t().playbackPaused);
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
  if (message.type === 'setLanguage') {
    setLanguage(message.language);
  }
  if (message.type === 'pause') {
    video.pause();
    appendActivity(t().quickHidePauseApplied);
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
  hasLoadedVideo = true;
  title.textContent = payload.name;
  video.src = payload.uri;
  video.muted = false;
  video.volume = payload.volume;
  updateVolumeControls();

  if (typeof payload.position === 'number') {
    video.currentTime = payload.position;
  }
  appendActivity(t().loadedVideo(payload.name));
  if (payload.subtitle) {
    loadSubtitle(payload.subtitle);
  }
}

function loadSubtitle(payload) {
  clearSubtitle();

  if (payload.format === 'srt' || payload.format === 'vtt') {
    loadTextTrack(payload);
    appendActivity(t().loadedSubtitle(payload.format.toUpperCase(), payload.name));
    return;
  }
  if (payload.format === 'ass' || payload.format === 'ssa') {
    assCues = parseAssDialogueLines(payload.content ?? '');
    if (assCues.length === 0) {
      appendActivity(t().loadedSubtitleNoDialogue(payload.format.toUpperCase()));
      vscode.postMessage({ type: 'subtitleError', message: t().subtitleNoDialogueError });
    }
    appendActivity(t().loadedSubtitle(payload.format.toUpperCase(), payload.name));
    renderAssCue();
    return;
  }

  appendActivity(t().unsupportedSubtitleFormat(payload.format));
  vscode.postMessage({ type: 'subtitleError', message: t().unsupportedSubtitleFormat(payload.format) });
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
  muteButton.textContent = video.muted || video.volume === 0 ? t().muted : t().sound;
  muteButton.setAttribute('aria-pressed', String(video.muted || video.volume === 0));
}

function setCornerPosition(position) {
  const next = position === 'left' ? 'left' : 'right';
  currentCornerPosition = next;
  document.body.classList.toggle('corner-left', next === 'left');
  document.body.classList.toggle('corner-right', next === 'right');
  cornerButton.textContent = next === 'left' ? t().left : t().right;
  appendActivity(t().previewPinned(next === 'left' ? t().left : t().right));
}

function logVolumeChange() {
  const now = Date.now();
  if (now - lastVolumeLogAt < 750) {
    return;
  }
  lastVolumeLogAt = now;
  appendActivity(t().volumeSet(Math.round(video.volume * 100)));
}

function logAudioState(context) {
  const localizedContext = translateAudioContext(context);
  if (language === 'en') {
    appendActivity(
      `${context}. Volume: ${Math.round(video.volume * 100)}% | Muted: ${video.muted ? 'yes' : 'no'} | Ready: ${video.readyState} | Network: ${video.networkState}`,
    );
    return;
  }

  appendActivity(
    t().audioState(localizedContext, Math.round(video.volume * 100), video.muted, video.readyState, video.networkState),
  );
}

function ensureMediaAudioOutput() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    appendActivity(t().webAudioUnavailable);
    return;
  }

  try {
    mediaAudioContext ??= new AudioContextConstructor();
    mediaAudioSource ??= mediaAudioContext.createMediaElementSource(video);
    if (!mediaAudioOutputConnected) {
      mediaAudioSource.connect(mediaAudioContext.destination);
      mediaAudioOutputConnected = true;
      appendActivity(t().audioOutputConnected);
    }
    if (mediaAudioContext.state === 'suspended') {
      void mediaAudioContext.resume();
    }
  } catch (error) {
    appendActivity(t().audioOutputSetupFailed(error?.message ?? String(error)));
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
  appendActivity(language === 'zh-CN'
    ? `当前：${formatDuration(video.currentTime)} | 剩余：${formatDuration(remaining)} | 时钟：${formatClockTime()}`
    : `Current: ${formatDuration(video.currentTime)} | Remaining: ${formatDuration(remaining)} | Clock: ${formatClockTime()}`);
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

function setLanguage(nextLanguage) {
  language = nextLanguage === 'zh-CN' ? 'zh-CN' : 'en';
  document.documentElement.lang = language;
  applyLanguageToControls();
}

function applyLanguageToControls() {
  const text = t();
  activityLog.setAttribute('aria-label', text.activityLogAria);
  activityLogTitle.textContent = text.activityLogTitle;
  muteButton.setAttribute('aria-label', text.muteAria);
  volumeSlider.setAttribute('aria-label', text.volumeAria);
  cornerButton.setAttribute('aria-label', text.cornerAria);
  subtitleButton.textContent = text.subtitle;
  recentButton.textContent = text.recent;
  openCacheButton.textContent = text.openCache;
  clearCacheButton.textContent = text.clearCache;
  if (!hasLoadedVideo) {
    title.textContent = text.noVideoSelected;
  }
  updateVolumeControls();
  cornerButton.textContent = currentCornerPosition === 'left' ? text.left : text.right;
}

function translateAudioContext(context) {
  if (language !== 'zh-CN') {
    return context;
  }

  if (context === 'Volume changed') {
    return '音量已更改';
  }
  if (context === 'Media metadata loaded') {
    return '媒体元数据已加载';
  }
  if (context === 'Playback started') {
    return '播放已开始';
  }

  return context;
}

function t() {
  return TEXT[language] ?? TEXT.en;
}

vscode.postMessage({ type: 'ready' });
