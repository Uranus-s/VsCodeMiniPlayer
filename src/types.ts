export type HideBehavior = 'pauseAndHide' | 'keepPlayingAndHide';
export type CornerPosition = 'left' | 'right';
export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa';

export interface MiniPlayerConfig {
  hideBehavior: HideBehavior;
  cornerPosition: CornerPosition;
  defaultVolume: number;
  autoLoadMatchingSubtitle: boolean;
  recentLimit: number;
}

export interface RecentPlaybackItem {
  videoUri: string;
  videoName: string;
  subtitleUri?: string;
  subtitleName?: string;
  position: number;
  openedAt: number;
}

export interface SubtitlePayload {
  uri?: string;
  name: string;
  format: SubtitleFormat;
  content?: string;
}

export interface VideoPayload {
  uri: string;
  name: string;
  subtitle?: SubtitlePayload;
  volume: number;
  position?: number;
}

export type ExtensionToWebviewMessage =
  | { type: 'loadVideo'; payload: VideoPayload }
  | { type: 'loadSubtitle'; payload: SubtitlePayload }
  | { type: 'setCornerPosition'; position: CornerPosition }
  | { type: 'setHideBehavior'; behavior: HideBehavior }
  | { type: 'pause' }
  | { type: 'restoreState'; position: number; volume: number };

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'mediaError'; message: string }
  | { type: 'subtitleError'; message: string }
  | { type: 'playbackState'; position: number; duration: number; paused: boolean; volume: number; muted?: boolean }
  | { type: 'requestSubtitle' }
  | { type: 'requestRecent' }
  | { type: 'requestToggleCorner' };
