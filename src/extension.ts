import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { formatCommandError } from './commandErrors';
import { readMiniPlayerConfig } from './config';
import { getHostText } from './localization';
import { PlayerPanel } from './playerPanel';
import { RecentStore } from './recentStore';
import { createAssPayload } from './subtitles/ass';
import { detectSubtitleFormat, matchingSubtitleCandidates } from './subtitles/match';
import { convertSrtToVtt } from './subtitles/srt';
import { normalizeVtt } from './subtitles/vtt';
import type { CornerPosition, RecentPlaybackItem, SubtitlePayload } from './types';
import { clearVideoCacheDirectory, ensureVideoCacheDirectory } from './videoCache';
import { preparePlayableVideo } from './videoPreparation';
import { assertSupportedVideoPath, SUPPORTED_VIDEO_EXTENSIONS } from './videoFormats';

const SUBTITLE_FILTERS = ['srt', 'vtt', 'ass', 'ssa'];

let activeVideoPath: string | undefined;
let activeSubtitlePath: string | undefined;
let activePosition = 0;
let saveTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const recentStore = new RecentStore(context.globalState);
  const panel = new PlayerPanel(
    context,
    readConfig().cornerPosition,
    readConfig().language,
    (state) => {
      activePosition = state.position;
      scheduleRecentSave(recentStore);
    },
    () => void runCommand(() => openSubtitle(panel, recentStore)),
    () => void runCommand(() => openRecent(panel, recentStore)),
    () => void runCommand(() => toggleCornerPosition(panel)),
    () => void runCommand(() => openVideoCache(panel)),
    () => void runCommand(() => clearVideoCache(panel)),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PlayerPanel.viewType, panel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('miniPlayer.openVideo', () => runCommand(() => openVideo(panel, recentStore))),
    vscode.commands.registerCommand('miniPlayer.togglePanel', () => runCommand(() => panel.show())),
    vscode.commands.registerCommand('miniPlayer.quickHide', () => runCommand(async () => {
      const config = readConfig();
      await saveActiveRecent(recentStore);
      await panel.quickHide(config.hideBehavior === 'pauseAndHide');
    })),
    vscode.commands.registerCommand('miniPlayer.openSubtitle', () => runCommand(() => openSubtitle(panel, recentStore))),
    vscode.commands.registerCommand('miniPlayer.openRecent', () => runCommand(() => openRecent(panel, recentStore))),
    vscode.commands.registerCommand('miniPlayer.toggleCornerPosition', () => runCommand(() => toggleCornerPosition(panel))),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('miniPlayer.cornerPosition')) {
        void runCommand(() => panel.setCornerPosition(readConfig().cornerPosition));
      }
      if (event.affectsConfiguration('miniPlayer.language')) {
        void runCommand(() => panel.setLanguage(readConfig().language));
      }
    }),
  );
}

export function deactivate(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
}

async function runCommand(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    void vscode.window.showErrorMessage(formatCommandError(error));
  }
}

async function openVideo(panel: PlayerPanel, recentStore: RecentStore): Promise<void> {
  const config = readConfig();
  const text = getHostText(config.language);
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { [text.videoFilter]: [...SUPPORTED_VIDEO_EXTENSIONS] },
  });
  const videoUri = selected?.[0];
  if (!videoUri) {
    return;
  }
  assertSupportedVideoPath(videoUri.fsPath);

  activeVideoPath = videoUri.fsPath;
  activeSubtitlePath = undefined;
  activePosition = 0;
  const subtitle = config.autoLoadMatchingSubtitle ? await findMatchingSubtitle(videoUri.fsPath) : undefined;
  if (subtitle) {
    activeSubtitlePath = subtitle.filePath;
  }
  const playable = await prepareVideoForPanel(panel, videoUri.fsPath);
  await panel.loadVideo(playable.playablePath, subtitle?.payload, config.defaultVolume, 0, path.basename(videoUri.fsPath));
  await saveActiveRecent(recentStore);
}

async function openSubtitle(panel: PlayerPanel, recentStore: RecentStore): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { [getHostText(readConfig().language).subtitleFilter]: SUBTITLE_FILTERS },
  });
  const subtitleUri = selected?.[0];
  if (!subtitleUri) {
    return;
  }

  const payload = await readSubtitlePayload(subtitleUri.fsPath, readConfig().language);
  activeSubtitlePath = subtitleUri.fsPath;
  await panel.loadSubtitle(payload);
  await saveActiveRecent(recentStore);
}

async function openRecent(panel: PlayerPanel, recentStore: RecentStore): Promise<void> {
  const items = recentStore.list();
  const text = getHostText(readConfig().language);
  if (items.length === 0) {
    void vscode.window.showInformationMessage(text.noRecentVideos);
    return;
  }

  const selected = await vscode.window.showQuickPick(
    items.map((item) => ({ label: item.videoName, description: item.subtitleName, item })),
    { placeHolder: text.recentPlaceholder },
  );
  if (!selected) {
    return;
  }

  const videoPath = vscode.Uri.parse(selected.item.videoUri).fsPath;
  assertSupportedVideoPath(videoPath);
  const subtitlePath = selected.item.subtitleUri ? vscode.Uri.parse(selected.item.subtitleUri).fsPath : undefined;
  const subtitle = subtitlePath ? await readSubtitlePayload(subtitlePath, readConfig().language) : undefined;
  activeVideoPath = videoPath;
  activeSubtitlePath = subtitlePath;
  activePosition = selected.item.position;
  const playable = await prepareVideoForPanel(panel, videoPath);
  await panel.loadVideo(playable.playablePath, subtitle, readConfig().defaultVolume, activePosition, path.basename(videoPath));
}

async function toggleCornerPosition(panel: PlayerPanel): Promise<void> {
  const config = vscode.workspace.getConfiguration('miniPlayer');
  const current = readConfig().cornerPosition;
  const next: CornerPosition = current === 'right' ? 'left' : 'right';
  await config.update('cornerPosition', next, vscode.ConfigurationTarget.Global);
  await panel.setCornerPosition(next);
}

async function findMatchingSubtitle(videoPath: string): Promise<{ filePath: string; payload: SubtitlePayload } | undefined> {
  for (const filePath of matchingSubtitleCandidates(videoPath)) {
    if (existsSync(filePath)) {
      return { filePath, payload: await readSubtitlePayload(filePath) };
    }
  }

  return undefined;
}

async function readSubtitlePayload(filePath: string, language = readConfig().language): Promise<SubtitlePayload> {
  const format = detectSubtitleFormat(filePath);
  if (!format) {
    throw new Error(getHostText(language).unsupportedSubtitleFile(filePath));
  }

  const raw = await readFile(filePath, 'utf8');
  if (format === 'srt') {
    return { name: path.basename(filePath), format, content: convertSrtToVtt(raw) };
  }
  if (format === 'vtt') {
    return { name: path.basename(filePath), format, content: normalizeVtt(raw) };
  }

  createAssPayload(raw);
  return { name: path.basename(filePath), format, content: raw };
}

function scheduleRecentSave(recentStore: RecentStore): void {
  if (!activeVideoPath) {
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => void saveActiveRecent(recentStore), 750);
}

async function saveActiveRecent(recentStore: RecentStore): Promise<void> {
  if (!activeVideoPath) {
    return;
  }

  const config = readConfig();
  const item: RecentPlaybackItem = {
    videoUri: vscode.Uri.file(activeVideoPath).toString(),
    videoName: path.basename(activeVideoPath),
    subtitleUri: activeSubtitlePath ? vscode.Uri.file(activeSubtitlePath).toString() : undefined,
    subtitleName: activeSubtitlePath ? path.basename(activeSubtitlePath) : undefined,
    position: activePosition,
    openedAt: Date.now(),
  };
  await recentStore.upsert(item, config.recentLimit);
}

function readConfig() {
  const config = vscode.workspace.getConfiguration('miniPlayer');
  return readMiniPlayerConfig((key) => config.get(key));
}

async function openVideoCache(panel: PlayerPanel): Promise<void> {
  const text = getHostText(readConfig().language);
  const cacheDir = getVideoCacheDir(panel);
  await ensureVideoCacheDirectory(cacheDir);
  await vscode.env.openExternal(vscode.Uri.file(cacheDir));
  await panel.appendActivity(text.openedMkvCacheFolder(cacheDir));
}

async function clearVideoCache(panel: PlayerPanel): Promise<void> {
  const text = getHostText(readConfig().language);
  const confirmed = await vscode.window.showWarningMessage(
    text.clearCacheWarning,
    { modal: true },
    text.clearCacheButton,
  );
  if (confirmed !== text.clearCacheButton) {
    return;
  }

  const result = await clearVideoCacheDirectory(getVideoCacheDir(panel));
  await panel.appendActivity(text.clearedMkvCache(result.deletedEntries));
  void vscode.window.showInformationMessage(text.cacheClearedInfo(result.deletedEntries));
}

function getVideoCacheDir(panel: PlayerPanel): string {
  return path.join(panel.extensionStoragePath, 'remuxed-videos');
}

async function prepareVideoForPanel(panel: PlayerPanel, videoPath: string) {
  const isMkv = path.extname(videoPath).toLowerCase() === '.mkv';
  let lastProgress = -1;
  let lastProgressLoggedAt = 0;
  if (isMkv) {
    await panel.show();
    await panel.appendActivity(getHostText(readConfig().language).preparingMkv(0));
  }

  const playable = await preparePlayableVideo({
    filePath: videoPath,
    cacheDir: getVideoCacheDir(panel),
    onProgress: isMkv
      ? (percent) => {
        const now = Date.now();
        if (percent < 100 && percent - lastProgress < 5 && now - lastProgressLoggedAt < 1000) {
          return;
        }

        lastProgress = percent;
        lastProgressLoggedAt = now;
        void panel.appendActivity(getHostText(readConfig().language).preparingMkv(percent));
      }
      : undefined,
  });

  if (playable.isRemuxed) {
    await panel.appendActivity(getHostText(readConfig().language).usingRemuxedCache(path.basename(playable.playablePath)));
  }

  return playable;
}
