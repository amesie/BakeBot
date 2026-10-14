// REQ-25: resend a saved draft up to 3 times, waiting 2 s, 4 s, then 8 s.
export const RETRY_DELAYS_MS = [2000, 4000, 8000];

export type AttemptResult<T> = { done: true; value: T } | { done: false };

/**
 * Calls attempt() up to delays.length times, sleeping delays[i] before each
 * try. Stops early when attempt() reports done.
 */
export async function retryWithBackoff<T>(
  attempt: (n: number) => Promise<AttemptResult<T>>,
  delays: number[] = RETRY_DELAYS_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<{ value: T | null; attempts: number }> {
  for (let i = 0; i < delays.length; i++) {
    await sleep(delays[i]);
    const result = await attempt(i + 1);
    if (result.done) return { value: result.value, attempts: i + 1 };
  }
  return { value: null, attempts: delays.length };
}
