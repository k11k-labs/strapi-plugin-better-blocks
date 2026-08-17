import type { Core } from '@strapi/strapi';

import { VERSION_UID } from './services/snapshot';
import { bufferFor, coalesce, isRestoreInProgress } from './utils/captureContext';
import type { Origin } from './utils/captureContext';
import { backfillLabels } from './utils/backfillLabels';
import { persistVersionsTable } from './utils/persistTable';

const TRACKED_ACTIONS: Origin[] = [
  'create',
  'update',
  'clone',
  'publish',
  'unpublish',
  'discardDraft',
];

interface PluginConfig {
  contentTypes: string[];
  trackApiWrites: boolean;
  retention?: { enabled?: boolean };
  cron?: string;
}

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const config = strapi.config.get('plugin::rewind') as PluginConfig;

  await persistVersionsTable(strapi, 'rewind_versions');
  await createLookupIndex(strapi);

  // Detached on purpose — see backfillLabels. A boot must not wait on a
  // cosmetic column, and nothing else depends on it having finished.
  void backfillLabels(strapi, VERSION_UID).catch((error: unknown) =>
    strapi.log.warn(
      `[rewind] could not label older versions: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  );

  scheduleThinning(strapi, config);

  const service = () => strapi.plugin('rewind').service('snapshot');

  const shouldCapture = (context: any): boolean => {
    if (!TRACKED_ACTIONS.includes(context.action)) return false;

    const uid: string = context.contentType?.uid ?? context.uid ?? '';
    if (!uid.startsWith('api::')) return false;
    if (!config.contentTypes.includes(uid)) return false;

    // A restore writes through the Document Service like anything else. Left
    // alone it would record itself as an ordinary edit, on top of the version
    // it already took of the pre-restore state.
    if (isRestoreInProgress()) return false;

    if (!config.trackApiWrites) {
      const url = strapi.requestContext.get()?.request?.url;
      if (!url?.startsWith('/content-manager')) return false;
    }

    return true;
  };

  strapi.documents.use(async (context: any, next: any) => {
    if (!shouldCapture(context)) return next();

    const uid: string = context.contentType?.uid ?? context.uid;
    const locale: string | null = context.params?.locale ?? null;

    // The only state `discardDraft` leaves behind is the published one it
    // reverted to. The work it threw away has to be read before it runs.
    const before =
      context.action === 'discardDraft' && context.params?.documentId
        ? await service().readRows(uid, context.params.documentId, [locale])
        : null;

    const result = await next();

    const relatedDocumentId: string =
      context.action === 'create' || context.action === 'clone'
        ? result?.documentId
        : context.params?.documentId;

    if (!relatedDocumentId) return result;

    const userId = currentUserId(strapi);

    await strapi.db.transaction(async ({ trx, onCommit }: any) => {
      // Buffered against the transaction, not written yet: the Content
      // Manager's update-then-publish pair lands here twice and has to leave
      // as one version.
      const buffer = bufferFor(trx);
      buffer.intents.push({
        uid,
        relatedDocumentId,
        locale,
        origin: context.action as Origin,
        before,
      });

      if (buffer.flushRegistered) return;
      buffer.flushRegistered = true;

      onCommit(() => {
        // Not awaited, and after the commit: by the time this runs the
        // editor's save is already durable, so nothing here can undo it or
        // hold it up. Fail-open by shape, rather than by remembering to wrap
        // things in try/catch.
        const intents = buffer.intents.splice(0, buffer.intents.length);
        service()
          .captureAll(coalesce(intents), userId)
          .catch((error: unknown) =>
            strapi.log.error('[rewind] failed to record a version', error)
          );
      });
    });

    return result;
  });
};

/**
 * Null for a programmatic write, which has no user behind it. Inventing one
 * would be worse than admitting there isn't one.
 */
const currentUserId = (strapi: Core.Strapi): number | null =>
  (strapi.requestContext.get() as any)?.state?.user?.id ?? null;

/**
 * Strapi will not index this for us, and every panel query filters on exactly
 * these columns in exactly this order.
 */
const createLookupIndex = async (strapi: Core.Strapi): Promise<void> => {
  try {
    const { tableName } = strapi.db.metadata.get(VERSION_UID) as {
      tableName: string;
    };

    await strapi.db.connection.raw(
      `CREATE INDEX IF NOT EXISTS idx_rewind_lookup
         ON ${tableName} (content_type, related_document_id, locale, created_at)`
    );
  } catch (error) {
    // A missing index is slow, not broken — never a reason to refuse to boot.
    strapi.log.warn(
      `[rewind] could not create the lookup index, queries will be slower: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export default bootstrap;

/**
 * Runs the thinning nightly, once across the whole deployment.
 *
 * The lock matters because every instance behind a load balancer runs this same
 * cron: without it they all start the same scan at the same time.
 */
const scheduleThinning = (strapi: Core.Strapi, config: PluginConfig): void => {
  if (config.retention?.enabled === false) return;

  strapi.cron.add({
    rewindPrune: {
      async task() {
        const lock = strapi.plugin('rewind').service('lock');
        if (!(await lock.acquire('prune', 30 * 60 * 1000))) return;

        try {
          const result = await strapi.plugin('rewind').service('retention').prune();
          if (result.deleted > 0) {
            strapi.log.info(
              `[rewind] thinned ${result.deleted} version(s) across ${result.documents} document(s)`
            );
          }
        } catch (error) {
          strapi.log.error('[rewind] thinning failed', error);
        } finally {
          await lock.release('prune');
        }
      },
      options: { rule: config.cron ?? '0 3 * * *' },
    },
  });
};
