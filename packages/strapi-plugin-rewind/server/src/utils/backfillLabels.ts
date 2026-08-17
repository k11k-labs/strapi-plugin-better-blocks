import type { Core } from '@strapi/strapi';

import { createLabeller } from './versionLabel';

const BATCH_SIZE = 200;

/**
 * Gives versions recorded before labels existed something to show.
 *
 * Without this, upgrading leaves a history where older entries are a badge and
 * a timestamp and newer ones have a title — the list stays half-unreadable for
 * exactly as long as the old versions are worth keeping.
 *
 * Two details that matter:
 *
 * - Rows whose content yields no label are written as an empty string, not left
 *   null. Leaving them null would make the next batch select the same rows
 *   again, forever.
 * - It runs detached. The work is proportional to how many versions exist, and
 *   a site with a long history should not pay minutes of boot time for a
 *   cosmetic column.
 */
export const backfillLabels = async (strapi: Core.Strapi, versionUid: string): Promise<number> => {
  const query = strapi.db.query(versionUid);

  const missing = await query.count({ where: { label: null } });
  if (missing === 0) return 0;

  strapi.log.info(`[rewind] labelling ${missing} older version(s)…`);

  const labelFor = createLabeller(strapi);
  let labelled = 0;

  for (;;) {
    const rows = await query.findMany({
      select: ['id', 'contentType', 'data'],
      where: { label: null },
      limit: BATCH_SIZE,
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      const label = await labelFor(row.contentType as string, row.data as Record<string, unknown>);
      await query.update({
        where: { id: row.id },
        data: { label: label ?? '' },
      });
      labelled += 1;
    }
  }

  strapi.log.info(`[rewind] labelled ${labelled} older version(s)`);
  return labelled;
};
