export function formatCommandError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error === undefined || error === null) {
    return 'Unknown Mini Player error.';
  }

  return String(error);
}
