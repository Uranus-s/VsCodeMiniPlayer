export interface AssSubtitlePayload {
  script: string;
}

export function createAssPayload(input: string): AssSubtitlePayload {
  const script = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!script.includes('[Events]')) {
    throw new Error('ASS/SSA subtitle is missing an [Events] section.');
  }

  return { script };
}
