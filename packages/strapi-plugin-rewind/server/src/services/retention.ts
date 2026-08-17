import type { Core } from '@strapi/strapi';

import { VERSION_UID } from './snapshot';
import { DEFAULT_POLICY, selectExpendable } from '../utils/thinning';
import type { RetentionPolicy } from '../utils/thinning';

/**
 * Rows deleted per statement. Small enough that other writers are never held up
 * for long - an editor saving a document must not wait on the nightly tidy-up.
 */
const DELETE_BATCH = 500;

export interface PruneResult {
  scanned: number;
  deleted: number;
  documents: number;
}

const retention = ({ strapi }: { strapi: Core.Strapi }) => {
  const query = () => strapi.db.query(VERSION_UID);

  /**
   * Every (content type, document, locale) that has at least one version old
   * enough to be a candidate.
   *
   * Worked out first, and then handled a document at a time, because "the
   * newest version that day" is a question about a whole document's history -
   * but holding every version of every document in memory to answer it is how
   * a tidy-up job takes a site down.
   */
  const groupsWithOldVersions = async (olderThan: Date) => {
    const rows = await query().findMany({
      select: ['contentType', 'relatedDocumentId', 'locale'],
      where: { createdAt: { $lt: olderThan } },
    });

    const groups = new Map<
      string,
      { contentType: string; relatedDocumentId: string; locale: string | null }
    >();

    for (const row of rows) {
      const key = `${row.contentType}|${row.relatedDocumentId}|${row.locale ?? ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          contentType: row.contentType as string,
          relatedDocumentId: row.relatedDocumentId as string,
          locale: (row.locale as string | null) ?? null,
        });
      }
    }

    return [...groups.values()];
  };

  return {
    /**
     * Thins the history according to the configured policy.
     *
     * Returns what it did rather than logging and forgetting, so the cron can
     * report it and a test can assert on it.
     */
    async prune(now = new Date()): Promise<PruneResult> {
      const config = strapi.config.get('plugin::rewind') as {
        retention?: Partial<RetentionPolicy> & { enabled?: boolean };
      };

      const policy: RetentionPolicy = { ...DEFAULT_POLICY, ...config?.retention };
      if (config?.retention?.enabled === false) {
        return { scanned: 0, deleted: 0, documents: 0 };
      }

      const cutoff = new Date(now.getTime() - policy.keepAllDays * 24 * 60 * 60 * 1000);

      const groups = await groupsWithOldVersions(cutoff);
      let scanned = 0;
      let deleted = 0;

      for (const group of groups) {
        const versions = await query().findMany({
          select: ['id', 'createdAt', 'origin', 'pinned'],
          where: {
            contentType: group.contentType,
            relatedDocumentId: group.relatedDocumentId,
            locale: group.locale,
          },
        });

        scanned += versions.length;

        const expendable = selectExpendable(versions as never, now, policy);

        for (let i = 0; i < expendable.length; i += DELETE_BATCH) {
          const batch = expendable.slice(i, i + DELETE_BATCH);
          await query().deleteMany({ where: { id: { $in: batch } } });
          deleted += batch.length;
        }
      }

      return { scanned, deleted, documents: groups.length };
    },
  };
};

export default retention;
