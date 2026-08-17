import type { Core } from '@strapi/strapi';

import { ASSIGNMENT_UID, TRANSITION_UID } from '../uids';

const tableOf = (strapi: Core.Strapi, uid: string): string =>
  (strapi.db.metadata.get(uid) as { tableName: string }).tableName;

/**
 * Indexes Strapi will not create for us.
 *
 * A plugin cannot ship migrations - `database.migrations.dir` is hardwired to the
 * *application's* `database/migrations` - so raw SQL at boot is the only route.
 * `IF NOT EXISTS` makes it idempotent across restarts.
 */
export const createIndexes = async (strapi: Core.Strapi): Promise<void> => {
  const assignments = tableOf(strapi, ASSIGNMENT_UID);
  const transitions = tableOf(strapi, TRANSITION_UID);

  /**
   * The one that enforces a rule rather than speeding one up: a document, in a
   * locale, sits in exactly one stage. `ensure()` races on it deliberately -
   * concurrent bulk publishes call it for the same document at the same moment,
   * and catching the unique violation is what makes that safe.
   *
   * Unlike the lookup index below, this one can fail on data that already breaks
   * it - a database written by a version of this plugin from before the index
   * existed. That is worth a loud warning and not worth refusing to boot over:
   * the plugin still works, it is just no longer protected against a duplicate.
   */
  await tryCreate(
    strapi,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_greenlight_assignment_lookup
       ON ${assignments} (related_document_id, content_type_uid, locale)`,
    `could not create the unique index on ${assignments}. If this database predates the index it may already hold duplicate assignments for one document; the plugin will run without the guarantee that it cannot happen again`
  );

  /** Every panel query reads the log by document, newest first. */
  await tryCreate(
    strapi,
    `CREATE INDEX IF NOT EXISTS idx_greenlight_transition_lookup
       ON ${transitions} (related_document_id, content_type_uid, locale, created_at)`,
    `could not create the lookup index on ${transitions}, history queries will be slower`
  );
};

const tryCreate = async (strapi: Core.Strapi, sql: string, warning: string): Promise<void> => {
  try {
    await strapi.db.connection.raw(sql);
  } catch (error) {
    strapi.log.warn(
      `[greenlight] ${warning}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
