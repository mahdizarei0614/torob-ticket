/** Bounded workers share one index. The abort fence prevents queued work starting. */
export async function scheduleProviders<T>(items: readonly T[], signal: AbortSignal, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const index = next++;
      if (index >= items.length) return;
      await work(items[index]!);
    }
  };
  const results = await Promise.allSettled([worker(), worker()]);
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
