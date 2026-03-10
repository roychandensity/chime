export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrency && queue.length > 0) {
      const item = queue.shift()!;
      const idx = results.length + running.length;
      const promise = fn(item).then((result) => {
        results[idx] = result;
      });
      running.push(
        promise.then(() => {
          running.splice(running.indexOf(promise.then(() => {})), 1);
        })
      );
    }
    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  return results;
}

export async function fetchInBatches<R>(
  allIds: string[],
  batchSize: number,
  concurrency: number,
  fetchFn: (ids: string[]) => Promise<R[]>
): Promise<R[]> {
  const chunks = chunkArray(allIds, batchSize);
  const allResults: R[][] = [];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((chunk) => fetchFn(chunk)));
    allResults.push(...batchResults);
  }

  return allResults.flat();
}
