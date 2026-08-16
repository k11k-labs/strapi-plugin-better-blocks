import { createHash } from 'node:crypto';

import type { Core } from '@strapi/strapi';

import { buildDeepPopulate, split } from './serializer';
import type { SnapshotIntent } from '../utils/captureContext';

export const VERSION_UID = 'plugin::rewind.version';

/**
 * Origins that anchor the history.
 *
 * These are the points an editor navigates by — "the version I published",
 * "the draft I threw away" — so they are never deduplicated away, however
 * little the content changed.
 */
const ANCHORS = new Set(['publish', 'unpublish', 'discardDraft', 'restore']);

const hash = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const snapshot = ({ strapi }: { strapi: Core.Strapi }) => {
  const hasDraftAndPublish = (uid: string): boolean =>
    Boolean((strapi.contentTypes[uid] as any)?.options?.draftAndPublish);

  const isLocalized = (uid: string): boolean =>
    Boolean(
      (strapi.getModel(uid as never) as any)?.pluginOptions?.i18n?.localized ??
      (strapi.contentTypes[uid] as any)?.pluginOptions?.i18n?.localized
    );

  /**
   * Reads the rows a version is built from.
   *
   * Deliberately not the middleware's `result`: that is not populated, so a
   * snapshot built from it silently loses every component and relation. Strapi
   * re-queries here for the same reason.
   *
   * Always the draft rows — a `publish` version records what was published, and
   * comparing it against the surrounding drafts only means something if both
   * sides are the same kind of thing.
   */
  const readRows = async (
    uid: string,
    relatedDocumentId: string,
    locales: (string | null)[]
  ): Promise<Record<string, unknown>[]> => {
    const localeFilter =
      isLocalized(uid) && locales.filter(Boolean).length > 0
        ? { locale: { $in: locales.filter(Boolean) } }
        : {};

    return strapi.db.query(uid).findMany({
      where: {
        documentId: relatedDocumentId,
        ...localeFilter,
        ...(hasDraftAndPublish(uid) ? { publishedAt: null } : {}),
      },
      populate: buildDeepPopulate(strapi, uid),
    });
  };

  const statusOf = async (
    uid: string,
    row: Record<string, unknown>
  ): Promise<'draft' | 'published' | 'modified'> => {
    try {
      const metadata = strapi.plugin('content-manager').service('document-metadata');
      const meta = await metadata.getMetadata(uid, row);
      return metadata.getStatus(row, meta.availableStatus);
    } catch {
      // A content type without draft & publish has no status to speak of.
      return 'draft';
    }
  };

  const lastVersion = async (uid: string, relatedDocumentId: string, locale: string | null) =>
    strapi.db.query(VERSION_UID).findOne({
      where: { contentType: uid, relatedDocumentId, locale },
      orderBy: { createdAt: 'desc' },
    });

  return {
    readRows,

    /**
     * Writes one version per affected locale, for each buffered intent.
     *
     * Called from the transaction's commit hook and never awaited by the write
     * path — a failure here must not be able to reach the editor's save.
     */
    async captureAll(intents: SnapshotIntent[], userId: number | null): Promise<void> {
      for (const intent of intents) {
        await this.capture(intent, userId);
      }
    },

    async capture(intent: SnapshotIntent, userId: number | null): Promise<void> {
      const { uid, relatedDocumentId, locale, origin } = intent;

      // `discardDraft` is the one action whose interesting state is the one it
      // destroyed, so the rows were read before it ran.
      const rows = intent.before ?? (await readRows(uid, relatedDocumentId, [locale]));

      for (const row of rows) {
        const rowLocale = (row.locale as string | null) ?? null;
        const { data, relations, schemaSnapshot } = split(strapi, uid, row);
        const contentHash = hash({ data, relations });

        if (!ANCHORS.has(origin)) {
          const previous = await lastVersion(uid, relatedDocumentId, rowLocale);
          // Strapi writes a row even when nothing changed. A save that changed
          // nothing is not a version of anything.
          if (previous?.contentHash === contentHash) continue;
        }

        await strapi.db.query(VERSION_UID).create({
          data: {
            contentType: uid,
            relatedDocumentId,
            locale: rowLocale,
            status: await statusOf(uid, row),
            data,
            relations,
            schemaSnapshot,
            contentHash,
            origin,
            userId,
            pinned: false,
          },
        });
      }
    },
  };
};

export default snapshot;
