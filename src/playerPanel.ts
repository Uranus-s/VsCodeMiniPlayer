import path from 'node:path';
import * as vscode from 'vscode';
import type {
  CornerPosition,
  ExtensionToWebviewMessage,
  RecentPlaybackItem,
  SubtitlePayload,
  VideoPayload,
  WebviewToExtensionMessage,
} from './types';
import { waitForValue } from './wait';
import { createPlayerHtml } from './webview/html';

const VIEW_CONTAINER_COMMAND = 'workbench.view.extension.miniPlayerPanel';
const VIEW_OPEN_TIMEOUT_MS = 3000;
const VIEW_OPEN_POLL_MS = 25;

export class PlayerPanel implements vscode.WebviewViewProvider {
  static readonly viewType = 'miniPlayer.playerView';

  private view?: vscode.WebviewView;
  private latestVideo?: VideoPayload;
  private latestState = { position: 0, volume: 0.7, muted: false };
  private cornerPosition: CornerPosition;
  private resourceRoots: vscode.Uri[];

  constructor(
    private readonly context: vscode.ExtensionContext,
    initialCornerPosition: CornerPosition,
    private readonly onPlaybackState: (item: Pick<RecentPlaybackItem, 'position'>) => void,
    private readonly onRequestSubtitle: () => void,
    private readonly onRequestRecent: () => void,
    private readonly onRequestToggleCorner: () => void,
  ) {
    this.cornerPosition = initialCornerPosition;
    this.resourceRoots = [context.extensionUri];
  }

  get extensionStoragePath(): string {
    return this.context.globalStorageUri.fsPath;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.configureWebview();
    webviewView.webview.html = this.createHtml(webviewView.webview);
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => this.handleMessage(message));
  }

  async show(): Promise<void> {
    const view = await waitForValue(
      () => this.view,
      () => vscode.commands.executeCommand(VIEW_CONTAINER_COMMAND),
      VIEW_OPEN_TIMEOUT_MS,
      VIEW_OPEN_POLL_MS,
      'Mini Player panel did not open.',
    );
    view.show?.(true);
  }

  hide(): void {
    void vscode.commands.executeCommand('workbench.action.closePanel');
  }

  async quickHide(shouldPause: boolean): Promise<void> {
    if (shouldPause) {
      await this.post({ type: 'pause' });
    }
    this.hide();
  }

  async setCornerPosition(position: CornerPosition): Promise<void> {
    this.cornerPosition = position;
    await this.post({ type: 'setCornerPosition', position });
  }

  async loadVideo(
    videoPath: string,
    subtitle?: SubtitlePayload,
    volume = 0.7,
    position = 0,
    displayName = path.basename(videoPath),
  ): Promise<VideoPayload> {
    await this.show();
    const webview = this.requireWebview();
    const roots = [this.context.extensionUri, vscode.Uri.file(path.dirname(videoPath))];
    this.setLocalResourceRoots(roots);

    const payload: VideoPayload = {
      uri: webview.asWebviewUri(vscode.Uri.file(videoPath)).toString(),
      name: displayName,
      subtitle,
      volume,
      position,
    };
    this.latestVideo = payload;
    this.latestState = { position, volume, muted: false };
    await this.post({ type: 'loadVideo', payload });
    return payload;
  }

  async loadSubtitle(subtitle: SubtitlePayload): Promise<void> {
    await this.show();
    this.latestVideo = this.latestVideo ? { ...this.latestVideo, subtitle } : undefined;
    await this.post({ type: 'loadSubtitle', payload: subtitle });
  }

  async appendActivity(message: string): Promise<void> {
    await this.post({ type: 'appendActivity', message });
  }

  private configureWebview(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: this.resourceRoots,
    };
  }

  private createHtml(webview: vscode.Webview): string {
    return createPlayerHtml({
      cspSource: webview.cspSource,
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'player.js')).toString(),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'player.css')).toString(),
    });
  }

  private setLocalResourceRoots(roots: vscode.Uri[]): void {
    const seen = new Set<string>();
    this.resourceRoots = roots.filter((root) => {
      const key = root.toString();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    this.configureWebview();
  }

  private handleMessage(message: WebviewToExtensionMessage): void {
    if (message.type === 'ready' && this.latestVideo) {
      void this.post({ type: 'setCornerPosition', position: this.cornerPosition });
      void this.post({ type: 'loadVideo', payload: this.latestVideo });
      void this.post({ type: 'restoreState', ...this.latestState });
    }
    if (message.type === 'ready' && !this.latestVideo) {
      void this.post({ type: 'setCornerPosition', position: this.cornerPosition });
    }
    if (message.type === 'playbackState') {
      this.latestState = { position: message.position, volume: message.volume, muted: message.muted === true };
      this.onPlaybackState({ position: message.position });
    }
    if (message.type === 'mediaError' || message.type === 'subtitleError') {
      void vscode.window.showErrorMessage(message.message);
    }
    if (message.type === 'requestSubtitle') {
      this.onRequestSubtitle();
    }
    if (message.type === 'requestRecent') {
      this.onRequestRecent();
    }
    if (message.type === 'requestToggleCorner') {
      this.onRequestToggleCorner();
    }
  }

  private async post(message: ExtensionToWebviewMessage): Promise<void> {
    await this.view?.webview.postMessage(message);
  }

  private requireWebview(): vscode.Webview {
    if (!this.view) {
      throw new Error('Mini Player panel did not open.');
    }

    return this.view.webview;
  }
}
