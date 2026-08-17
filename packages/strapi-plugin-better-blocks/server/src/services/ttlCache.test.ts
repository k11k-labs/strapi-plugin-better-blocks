import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTtlCache } from './ttlCache';

describe('createTtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stored value before it expires', () => {
    const cache = createTtlCache<string>({ max: 10 });
    cache.set('a', 'value', 1000);

    vi.advanceTimersByTime(999);
    expect(cache.get('a')).toBe('value');
  });

  it('drops an expired entry instead of returning it', () => {
    const cache = createTtlCache<string>({ max: 10 });
    cache.set('a', 'value', 1000);

    vi.advanceTimersByTime(1000);

    expect(cache.get('a')).toBeUndefined();
    // The read is what frees it - the old implementation stopped here and never
    // reclaimed the memory.
    expect(cache.size).toBe(0);
  });

  it('never grows past max', () => {
    const cache = createTtlCache<number>({ max: 3 });

    for (let i = 0; i < 100; i += 1) {
      cache.set(`key-${i}`, i, 60_000);
    }

    expect(cache.size).toBeLessThanOrEqual(3);
  });

  it('evicts the least recently used entry first', () => {
    const cache = createTtlCache<number>({ max: 3 });
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('c', 3, 60_000);

    // Touching 'a' makes 'b' the coldest entry.
    expect(cache.get('a')).toBe(1);

    cache.set('d', 4, 60_000);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('sacrifices expired entries before live ones', () => {
    const cache = createTtlCache<number>({ max: 3 });
    cache.set('stale', 1, 1000);
    cache.set('fresh-1', 2, 60_000);
    cache.set('fresh-2', 3, 60_000);

    vi.advanceTimersByTime(2000);
    cache.set('new', 4, 60_000);

    // 'stale' was the oldest AND expired, so nothing live had to go.
    expect(cache.get('fresh-1')).toBe(2);
    expect(cache.get('fresh-2')).toBe(3);
    expect(cache.get('new')).toBe(4);
  });

  it('treats overwriting a key as a fresh insertion', () => {
    const cache = createTtlCache<number>({ max: 2 });
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('a', 10, 60_000);

    // 'a' was rewritten, so 'b' is now the coldest.
    cache.set('c', 3, 60_000);

    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('restarts the TTL when a key is overwritten', () => {
    const cache = createTtlCache<number>({ max: 5 });
    cache.set('a', 1, 1000);

    vi.advanceTimersByTime(900);
    cache.set('a', 2, 1000);
    vi.advanceTimersByTime(900);

    expect(cache.get('a')).toBe(2);
  });

  it('supports delete and clear', () => {
    const cache = createTtlCache<number>({ max: 5 });
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);

    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('b')).toBeUndefined();
  });

  it('refuses a max below one, which would cache nothing', () => {
    expect(() => createTtlCache({ max: 0 })).toThrow(/at least 1/);
  });
});
