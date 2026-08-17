/**
 * Deciding which versions to throw away.
 *
 * Kept as a pure function, and tested harder than anything else in the plugin,
 * because it is the only code here that destroys data. Everything else can be
 * wrong and merely unhelpful.
 *
 * The shape of the policy is "recent history in full, older history thinned":
 * an editor looking at last week wants every save, and an editor looking at
 * last year wants a handful of points, not four hundred.
 */

export interface RetentionPolicy {
  /** Below this age nothing is touched. */
  keepAllDays: number;
  /** Up to this age, one version per calendar day survives. */
  dailyUntilDays: number;
  /** Older than that, one per ISO week survives. */
  maxAgeDays: number;
  /** Whether publish/unpublish/discardDraft/restore are exempt entirely. */
  keepAnchors: boolean;
}

export const DEFAULT_POLICY: RetentionPolicy = {
  keepAllDays: 7,
  dailyUntilDays: 30,
  maxAgeDays: 365,
  keepAnchors: true,
};

export interface PrunableVersion {
  id: number;
  createdAt: string | Date;
  origin: string;
  pinned?: boolean | null;
}

/**
 * The points an editor navigates by. Thinning these away would leave a history
 * that is technically continuous and practically useless — "the version I
 * published" is exactly what someone comes back for a year later.
 */
const ANCHOR_ORIGINS = new Set(['publish', 'unpublish', 'discardDraft', 'restore']);

const DAY_MS = 24 * 60 * 60 * 1000;

const ageInDays = (createdAt: string | Date, now: Date): number =>
  (now.getTime() - new Date(createdAt).getTime()) / DAY_MS;

/** Calendar day in UTC, so a bucket does not shift with the server's timezone. */
const dayBucket = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * ISO week bucket. Uses the Thursday rule so a week never splits across two
 * years, which would otherwise keep two versions for one week each new year.
 */
const weekBucket = (date: Date): string => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
};

/**
 * Ids to delete, given every version of one document in one locale.
 *
 * Takes the whole set for a document rather than a page of rows: "the newest
 * version that day" is not a question a single row can answer.
 */
export const selectExpendable = (
  versions: PrunableVersion[],
  now: Date,
  policy: RetentionPolicy = DEFAULT_POLICY
): number[] => {
  const survivors = new Map<string, PrunableVersion>();
  const expendable: number[] = [];

  // Newest first, so the first version seen in a bucket is the one that stays.
  const ordered = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const version of ordered) {
    if (version.pinned) continue;
    if (policy.keepAnchors && ANCHOR_ORIGINS.has(version.origin)) continue;

    const age = ageInDays(version.createdAt, now);
    if (age <= policy.keepAllDays) continue;

    // Past the ceiling nothing ordinary survives, whichever bucket it is in.
    if (age > policy.maxAgeDays) {
      expendable.push(version.id);
      continue;
    }

    const created = new Date(version.createdAt);
    const bucket =
      age <= policy.dailyUntilDays ? `d:${dayBucket(created)}` : `w:${weekBucket(created)}`;

    if (survivors.has(bucket)) expendable.push(version.id);
    else survivors.set(bucket, version);
  }

  return expendable;
};
