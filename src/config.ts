import type { CornerPosition, HideBehavior, MiniPlayerConfig } from './types';

export interface RawMiniPlayerConfig {
  hideBehavior?: unknown;
  cornerPosition?: unknown;
  defaultVolume?: unknown;
  autoLoadMatchingSubtitle?: unknown;
  recentLimit?: unknown;
}

const DEFAULT_CONFIG: MiniPlayerConfig = {
  hideBehavior: 'pauseAndHide',
  cornerPosition: 'right',
  defaultVolume: 0.7,
  autoLoadMatchingSubtitle: true,
  recentLimit: 10,
};

export function normalizeConfig(raw: RawMiniPlayerConfig): MiniPlayerConfig {
  return {
    hideBehavior: normalizeHideBehavior(raw.hideBehavior),
    cornerPosition: normalizeCornerPosition(raw.cornerPosition),
    defaultVolume: clampNumber(raw.defaultVolume, DEFAULT_CONFIG.defaultVolume, 0, 1),
    autoLoadMatchingSubtitle:
      typeof raw.autoLoadMatchingSubtitle === 'boolean'
        ? raw.autoLoadMatchingSubtitle
        : DEFAULT_CONFIG.autoLoadMatchingSubtitle,
    recentLimit: Math.round(clampNumber(raw.recentLimit, DEFAULT_CONFIG.recentLimit, 1, 50)),
  };
}

export function readMiniPlayerConfig(getValue: <T>(key: string) => T | undefined): MiniPlayerConfig {
  return normalizeConfig({
    hideBehavior: getValue('hideBehavior'),
    cornerPosition: getValue('cornerPosition'),
    defaultVolume: getValue('defaultVolume'),
    autoLoadMatchingSubtitle: getValue('autoLoadMatchingSubtitle'),
    recentLimit: getValue('recentLimit'),
  });
}

function normalizeHideBehavior(value: unknown): HideBehavior {
  return value === 'keepPlayingAndHide' ? 'keepPlayingAndHide' : DEFAULT_CONFIG.hideBehavior;
}

function normalizeCornerPosition(value: unknown): CornerPosition {
  return value === 'left' ? 'left' : DEFAULT_CONFIG.cornerPosition;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
