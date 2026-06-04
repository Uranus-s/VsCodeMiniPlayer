export function convertSrtToVtt(input: string): string {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  const body = normalized
    .split('\n')
    .filter((line) => !/^\d+$/.test(line.trim()))
    .join('\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trimEnd();

  return `WEBVTT\n\n${body}\n`;
}
