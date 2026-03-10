/**
 * Vercel KV cache utilities.
 *
 * When KV_REST_API_URL is not configured, falls back to in-memory cache
 * so local development works without Vercel KV.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory fallback for local dev
const memoryCache = new Map<string, CacheEntry<unknown>>();

function buildKey(namespace: string, dateRange: string, building: string): string {
  return `chime:${namespace}:${building}:${dateRange}`;
}

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getCached<T>(
  namespace: string,
  dateRange: string,
  building: string
): Promise<T | null> {
  const key = buildKey(namespace, dateRange, building);

  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      return await kv.get<T>(key);
    } catch (e) {
      console.warn("KV get failed, falling back to memory:", e);
    }
  }

  // Memory fallback
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  memoryCache.delete(key);
  return null;
}

export async function setCache<T>(
  namespace: string,
  dateRange: string,
  building: string,
  data: T,
  ttl = 86400
): Promise<void> {
  const key = buildKey(namespace, dateRange, building);

  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(key, data, { ex: ttl });
      return;
    } catch (e) {
      console.warn("KV set failed, falling back to memory:", e);
    }
  }

  // Memory fallback
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttl * 1000,
  });
}
