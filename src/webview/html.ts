export interface PlayerHtmlOptions {
  cspSource: string;
  scriptUri: string;
  styleUri: string;
  nonce?: string;
}

export function createPlayerHtml(options: PlayerHtmlOptions): string {
  const nonce = options.nonce ?? createNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${options.cspSource} blob:; style-src ${options.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${options.styleUri}" rel="stylesheet">
  <title>Mini Player</title>
</head>
<body>
  <main class="player-shell">
    <section id="activity-log" class="activity-log" aria-label="Mini Player activity log">
      <div class="activity-log-title">Mini Player Activity</div>
      <div id="activity-log-lines" class="activity-log-lines"></div>
    </section>
    <section class="video-frame">
      <video id="video" controls playsinline></video>
      <div id="ass-layer" class="ass-layer" aria-hidden="true"></div>
    </section>
    <footer class="toolbar">
      <span id="title" class="title">No video selected</span>
      <button id="mute-button" type="button" aria-label="Mute or unmute video">Sound</button>
      <input id="volume-slider" type="range" min="0" max="1" step="0.05" value="0.7" aria-label="Video volume">
      <button id="corner-button" type="button" aria-label="Switch mini player side">Right</button>
      <button id="subtitle-button" type="button">Subtitle</button>
      <button id="recent-button" type="button">Recent</button>
    </footer>
  </main>
  <script nonce="${nonce}" src="${options.scriptUri}"></script>
</body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';

  for (let index = 0; index < 32; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
