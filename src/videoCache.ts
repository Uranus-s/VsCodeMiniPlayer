import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

export interface ClearVideoCacheResult {
  deletedEntries: number;
}

export async function ensureVideoCacheDirectory(cacheDir: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
}

export async function clearVideoCacheDirectory(cacheDir: string): Promise<ClearVideoCacheResult> {
  await ensureVideoCacheDirectory(cacheDir);
  const entries = await readdir(cacheDir);

  await Promise.all(entries.map((entry) => rm(path.join(cacheDir, entry), { recursive: true, force: true })));

  return { deletedEntries: entries.length };
}
