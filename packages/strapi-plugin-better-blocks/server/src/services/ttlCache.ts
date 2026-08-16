/**
 * A bounded cache with per-entry expiry.
 *
 * The oEmbed service used a bare `Map` keyed by URL, which meant one entry for
 * every social post ever embedded, for the life of the process. Entries expired
 * logically — a stale hit was discarded on read — but nothing ever removed them,
 * so a long-running instance kept the memory whether or not anyone asked for
 * that post again.
 *
 * Eviction is least-recently-used: a hit moves its entry to the end, and a write
 * past `max` drops the entry at the front. `Map` iterates in insertion order and
 * re-inserting moves a key to the end, which is the whole implementation.
 */
export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs: number): void;
  delete(key: string): boolean;
  clear(): void;
  readonly size: number;
}

export const createTtlCache = <T>({ max }: { max: number }): TtlCache<T> => {
  if (max < 1) {
    throw new Error(`ttlCache: max must be at least 1 (received ${max})`);
  }

  const entries = new Map<string, { expires: number; value: T }>();

  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;

      if (hit.expires <= Date.now()) {
        entries.delete(key);
        return undefined;
      }

      // Re-insert to mark the key as most recently used.
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },

    set(key, value, ttlMs) {
      // Delete first so an overwrite counts as a fresh insertion rather than
      // keeping the key at its old position in the eviction order.
      entries.delete(key);

      // Drop anything already expired before evicting a live entry — cheaper to
      // lose a stale entry than a useful one.
      if (entries.size >= max) {
        const now = Date.now();
        for (const [k, entry] of entries) {
          if (entry.expires <= now) entries.delete(k);
        }
      }

      while (entries.size >= max) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }

      entries.set(key, { expires: Date.now() + ttlMs, value });
    },

    delete: (key) => entries.delete(key),

    clear: () => entries.clear(),

    get size() {
      return entries.size;
    },
  };
};
