import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { formatCommandError } from './commandErrors';
import { readMiniPlayerConfig } from './config';
import { PlayerPanel } from './playerPanel';
import { RecentStore } from './recentStore';
import { createAssPayload } from './subtitles/ass';
import { detectSubtitleFormat, matchingSubtitleCandidates } from './subtitles/match';
import { convertSrtToVtt } from './subtitles/srt';
import { normalizeVtt } from './subtitles/vtt';
import type { CornerPosition, RecentPlaybackItem, SubtitlePayload } from './types';

const VIDEO_FILTERS = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v'];
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
    (state) => {
      activePosition = state.position;
      scheduleRecentSave(recentStore);
    },
    () => void runCommand(() => openSubtitle(panel, recentStore)),
    () => void runCommand(() => openRecent(panel, recentStore)),
    () => void runCommand(() => toggleCornerPosition(panel)),
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
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { Videos: VIDEO_FILTERS },
  });
  const videoUri = selected?.[0];
  if (!videoUri) {
    return;
  }

  activeVideoPath = videoUri.fsPath;
  activeSubtitlePath = undefined;
  activePosition = 0;
  const subtitle = config.autoLoadMatchingSubtitle ? await findMatchingSubtitle(videoUri.fsPath) : undefined;
  if (subtitle) {
    activeSubtitlePath = subtitle.filePath;
  }
  await panel.loadVideo(videoUri.fsPath, subtitle?.payload, config.defaultVolume);
  await saveActiveRecent(recentStore);
}

async function openSubtitle(panel: PlayerPanel, recentStore: RecentStore): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { Subtitles: SUBTITLE_FILTERS },
  });
  const subtitleUri = selected?.[0];
  if (!subtitleUri) {
    return;
  }

  const payload = await readSubtitlePayload(subtitleUri.fsPath);
  activeSubtitlePath = subtitleUri.fsPath;
  await panel.loadSubtitle(payload);
  await saveActiveRecent(recentStore);
}

async function openRecent(panel: PlayerPanel, recentStore: RecentStore): Promise<void> {
  const items = recentStore.list();
  if (items.length === 0) {
    void vscode.window.showInformationMessage('Mini Player has no recent videos yet.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    items.map((item) => ({ label: item.videoName, description: item.subtitleName, item })),
    { placeHolder: 'Open recent Mini Player video' },
  );
  if (!selected) {
    return;
  }

  const videoPath = vscode.Uri.parse(selected.item.videoUri).fsPath;
  const subtitlePath = selected.item.subtitleUri ? vscode.Uri.parse(selected.item.subtitleUri).fsPath : undefined;
  const subtitle = subtitlePath ? await readSubtitlePayload(subtitlePath) : undefined;
  activeVideoPath = videoPath;
  activeSubtitlePath = subtitlePath;
  activePosition = selected.item.position;
  await panel.loadVideo(videoPath, subtitle, readConfig().defaultVolume, activePosition);
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

async function readSubtitlePayload(filePath: string): Promise<SubtitlePayload> {
  const format = detectSubtitleFormat(filePath);
  if (!format) {
    throw new Error(`Unsupported subtitle file: ${filePath}`);
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
