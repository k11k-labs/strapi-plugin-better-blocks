import { describe, expect, it } from 'vitest';

import { DEFAULT_POLICY, selectExpendable } from './thinning';
import type { PrunableVersion } from './thinning';

/**
 * This is the only code in the plugin that destroys data, so the tests lean
 * towards proving what SURVIVES rather than what goes.
 */

const NOW = new Date('2026-08-17T12:00:00.000Z');

const daysAgo = (days: number, hour = 12): string => {
  const date = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

let nextId = 1;
const version = (createdAt: string, origin = 'update', pinned = false): PrunableVersion => ({
  id: nextId++,
  createdAt,
  origin,
  pinned,
});

describe('selectExpendable', () => {
  it('keeps everything inside the recent window', () => {
    const recent = [
      version(daysAgo(0)),
      version(daysAgo(1)),
      version(daysAgo(1, 9)),
      version(daysAgo(6)),
    ];

    expect(selectExpendable(recent, NOW)).toEqual([]);
  });

  it('thins to one a day between the recent window and the daily limit', () => {
    const sameDay = [version(daysAgo(10, 9)), version(daysAgo(10, 13)), version(daysAgo(10, 17))];

    const expendable = selectExpendable(sameDay, NOW);

    // The newest of that day survives; the other two go.
    expect(expendable).toHaveLength(2);
    expect(expendable).not.toContain(sameDay[2].id);
  });

  it('keeps one per day across several days', () => {
    const versions = [
      version(daysAgo(10, 9)),
      version(daysAgo(10, 17)),
      version(daysAgo(11, 9)),
      version(daysAgo(11, 17)),
    ];

    expect(selectExpendable(versions, NOW)).toHaveLength(2);
  });

  it('thins to one a week once past the daily limit', () => {
    // Thu/Wed/Tue/Mon of one ISO week, all older than the daily limit.
    const versions = [
      version(daysAgo(39)),
      version(daysAgo(40)),
      version(daysAgo(41)),
      version(daysAgo(42)),
    ];

    expect(selectExpendable(versions, NOW)).toHaveLength(3);
  });

  it('puts a Sunday in the week that precedes it, as ISO does', () => {
    // 2026-07-05 is a Sunday and belongs to the week before 2026-07-06 (Mon).
    // Get this wrong and a Sunday edit silently evicts the Monday one.
    const monday = { id: 801, createdAt: '2026-07-06T10:00:00.000Z', origin: 'update' };
    const sunday = { id: 802, createdAt: '2026-07-05T10:00:00.000Z', origin: 'update' };

    expect(selectExpendable([monday, sunday], NOW)).toEqual([]);
  });

  it('never touches an anchor, however old', () => {
    const anchors = [
      version(daysAgo(400), 'publish'),
      version(daysAgo(400), 'unpublish'),
      version(daysAgo(400), 'discardDraft'),
      version(daysAgo(400), 'restore'),
    ];

    // "The version I published" is exactly what someone comes back for.
    expect(selectExpendable(anchors, NOW)).toEqual([]);
  });

  it('never touches a pinned version, however old', () => {
    const pinned = version(daysAgo(400), 'update', true);
    expect(selectExpendable([pinned], NOW)).toEqual([]);
  });

  it('deletes ordinary versions past the hard ceiling even if alone in their week', () => {
    const ancient = version(daysAgo(400));
    expect(selectExpendable([ancient], NOW)).toEqual([ancient.id]);
  });

  it('respects keepAnchors: false', () => {
    const published = version(daysAgo(400), 'publish');

    expect(selectExpendable([published], NOW, { ...DEFAULT_POLICY, keepAnchors: false })).toEqual([
      published.id,
    ]);
  });

  it('does not let an anchor stand in for the day it shares', () => {
    const published = version(daysAgo(10, 17), 'publish');
    const edited = version(daysAgo(10, 9));

    // The anchor is exempt rather than a survivor, so the day's newest ordinary
    // version still survives on its own account.
    expect(selectExpendable([published, edited], NOW)).toEqual([]);
  });

  it('is stable regardless of the order it is given', () => {
    const versions = [version(daysAgo(10, 9)), version(daysAgo(10, 17)), version(daysAgo(10, 13))];

    const forwards = selectExpendable(versions, NOW).sort();
    const backwards = selectExpendable([...versions].reverse(), NOW).sort();

    expect(forwards).toEqual(backwards);
  });

  it('keeps a version that is the only one in its bucket', () => {
    const versions = [version(daysAgo(10)), version(daysAgo(20)), version(daysAgo(25))];
    expect(selectExpendable(versions, NOW)).toEqual([]);
  });

  it('does not split one week across a year boundary', () => {
    // 29 Dec 2025 and 1 Jan 2026 are the same ISO week; a naive year-week key
    // would keep one version for each.
    const now = new Date('2026-03-01T12:00:00.000Z');
    const versions = [
      { id: 901, createdAt: '2025-12-29T10:00:00.000Z', origin: 'update' },
      { id: 902, createdAt: '2026-01-01T10:00:00.000Z', origin: 'update' },
    ];

    expect(selectExpendable(versions, now)).toEqual([901]);
  });

  it('handles an empty history', () => {
    expect(selectExpendable([], NOW)).toEqual([]);
  });
});
