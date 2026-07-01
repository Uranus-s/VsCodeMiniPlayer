import type { MiniPlayerLanguage } from '../types';

export interface PlayerHtmlOptions {
  cspSource: string;
  scriptUri: string;
  styleUri: string;
  nonce?: string;
  language?: MiniPlayerLanguage;
}

export function createPlayerHtml(options: PlayerHtmlOptions): string {
  const nonce = options.nonce ?? createNonce();
  const text = getPlayerHtmlText(options.language);

  return `<!DOCTYPE html>
<html lang="${text.language}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${options.cspSource} blob:; style-src ${options.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${options.styleUri}" rel="stylesheet">
  <title>Mini Player</title>
</head>
<body>
  <main class="player-shell">
    <section id="activity-log" class="activity-log" aria-label="${text.activityLogAria}">
      <div class="activity-log-title">${text.activityLogTitle}</div>
      <div id="activity-log-lines" class="activity-log-lines"></div>
    </section>
    <section class="video-frame">
      <video id="video" controls playsinline></video>
      <div id="ass-layer" class="ass-layer" aria-hidden="true"></div>
    </section>
    <footer class="toolbar">
      <span id="title" class="title">${text.noVideoSelected}</span>
      <button id="mute-button" type="button" aria-label="${text.muteAria}">${text.sound}</button>
      <input id="volume-slider" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="${text.volumeAria}">
      <button id="corner-button" type="button" aria-label="${text.cornerAria}">${text.right}</button>
      <button id="subtitle-button" type="button">${text.subtitle}</button>
      <button id="recent-button" type="button">${text.recent}</button>
      <button id="open-cache-button" type="button">${text.openCache}</button>
      <button id="clear-cache-button" type="button">${text.clearCache}</button>
    </footer>
  </main>
  <script nonce="${nonce}" src="${options.scriptUri}"></script>
</body>
</html>`;
}

function getPlayerHtmlText(language: MiniPlayerLanguage | undefined) {
  if (language === 'zh-CN') {
    return {
      language: 'zh-CN',
      activityLogAria: '迷你播放器活动日志',
      activityLogTitle: '迷你播放器活动',
      noVideoSelected: '未选择视频',
      muteAria: '静音或取消静音视频',
      sound: '声音',
      volumeAria: '视频音量',
      cornerAria: '切换迷你播放器侧边',
      right: '右侧',
      subtitle: '字幕',
      recent: '最近播放',
      openCache: '打开缓存',
      clearCache: '清理缓存',
    };
  }

  return {
    language: 'en',
    activityLogAria: 'Mini Player activity log',
    activityLogTitle: 'Mini Player Activity',
    noVideoSelected: 'No video selected',
    muteAria: 'Mute or unmute video',
    sound: 'Sound',
    volumeAria: 'Video volume',
    cornerAria: 'Switch mini player side',
    right: 'Right',
    subtitle: 'Subtitle',
    recent: 'Recent',
    openCache: 'Open Cache',
    clearCache: 'Clear Cache',
  };
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';

  for (let index = 0; index < 32; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
