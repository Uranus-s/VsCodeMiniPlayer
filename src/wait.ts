export async function waitForValue<T>(
  readValue: () => T | undefined,
  trigger: () => PromiseLike<unknown>,
  timeoutMs: number,
  intervalMs: number,
  errorMessage: string,
): Promise<T> {
  const existing = readValue();
  if (existing !== undefined) {
    return existing;
  }

  await trigger();
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const value = readValue();
    if (value !== undefined) {
      return value;
    }

    await sleep(intervalMs);
  }

  throw new Error(errorMessage);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
