export function normalizeVtt(input: string): string {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();

  if (normalized.trimStart().startsWith('WEBVTT')) {
    return `${normalized}\n`;
  }

  return `WEBVTT\n\n${normalized}\n`;
}
