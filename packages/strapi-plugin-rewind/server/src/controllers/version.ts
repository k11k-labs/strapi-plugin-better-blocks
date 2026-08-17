import type { Core } from '@strapi/strapi';

import { VERSION_UID } from '../services/snapshot';

/**
 * The list endpoint never returns `data`.
 *
 * A single document with a rich-text body runs to 100+ KB, and the panel asks
 * for ten versions at a time - sending the content of each just to render a row
 * of timestamps would make opening the panel slower than opening the document.
 * `data` comes down one version at a time, when something is actually shown.
 */
const LIST_FIELDS = [
  'id',
  'contentType',
  'relatedDocumentId',
  'locale',
  'status',
  'label',
  'origin',
  'userId',
  'pinned',
  'contentHash',
  'createdAt',
];

const version = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const { contentType, documentId, locale, page = 1, pageSize = 10 } = ctx.query;

    if (!contentType || !documentId) {
      return ctx.badRequest('contentType and documentId are required.');
    }

    const where: Record<string, unknown> = {
      contentType,
      relatedDocumentId: documentId,
      ...(locale ? { locale } : {}),
    };

    const limit = Math.min(Number(pageSize) || 10, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const [rows, total] = await Promise.all([
      strapi.db.query(VERSION_UID).findMany({
        select: LIST_FIELDS,
        where,
        orderBy: { createdAt: 'desc' },
        limit,
        offset,
      }),
      strapi.db.query(VERSION_UID).count({ where }),
    ]);

    ctx.body = {
      data: await withUserNames(strapi, rows),
      meta: { page: Number(page) || 1, pageSize: limit, total },
    };
  },

  async findOne(ctx: any) {
    const row = await strapi.db
      .query(VERSION_UID)
      .findOne({ where: { id: Number(ctx.params.id) } });

    if (!row) return ctx.notFound('No such version.');

    ctx.body = { data: (await withUserNames(strapi, [row]))[0] };
  },

  async diff(ctx: any) {
    const { against } = ctx.query;
    try {
      ctx.body = {
        data: await strapi
          .plugin('rewind')
          .service('diff')
          .between(Number(ctx.params.id), against ? Number(against) : undefined),
      };
    } catch (error) {
      return ctx.badRequest(
        error instanceof Error ? error.message : 'Could not compare these versions.'
      );
    }
  },

  async preview(ctx: any) {
    try {
      ctx.body = {
        data: await strapi.plugin('rewind').service('restore').preview(Number(ctx.params.id)),
      };
    } catch (error) {
      return ctx.badRequest(error instanceof Error ? error.message : 'Preview failed.');
    }
  },

  async restore(ctx: any) {
    try {
      ctx.body = {
        data: await strapi
          .plugin('rewind')
          .service('restore')
          .apply(Number(ctx.params.id), ctx.state?.user?.id ?? null),
      };
    } catch (error) {
      return ctx.badRequest(error instanceof Error ? error.message : 'Restore failed.');
    }
  },
});

/**
 * Resolves author names in one query per request rather than one per row.
 *
 * `userId` is a plain integer rather than a relation, precisely so that deleting
 * an admin account cannot delete or orphan the history they made - which means
 * the name has to be looked up here, and may legitimately be missing.
 */
const withUserNames = async (strapi: Core.Strapi, rows: any[]) => {
  const ids = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  if (ids.length === 0) return rows.map((row) => ({ ...row, user: null }));

  const users = await strapi.db
    .query('admin::user')
    .findMany({ select: ['id', 'firstname', 'lastname', 'email'], where: { id: ids } });

  const byId = new Map(users.map((user: any) => [user.id, user]));

  return rows.map((row) => {
    const user = byId.get(row.userId);
    return {
      ...row,
      user: user
        ? {
            id: user.id,
            name: [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email,
          }
        : null,
    };
  });
};

export default version;
