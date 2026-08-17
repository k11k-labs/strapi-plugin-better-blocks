import { fileURLToPath } from 'node:url';

import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

export const UID = 'api::article.article';
/** No i18n, and no Draft & Publish — used for the rejection cases. */
export const PLAIN_UID = 'api::note.note';
export const NO_DP_UID = 'api::tag.tag';

/**
 * Absolute, because the harness writes its fixture app to a temp directory and a
 * relative `resolve` would be resolved from there rather than from the repo.
 */
export const PLUGIN_PATH = fileURLToPath(new URL('..', import.meta.url));

export const bootWithGreenlight = (
  options: Parameters<typeof createTestStrapi>[0] = {}
): Promise<TestStrapiInstance> =>
  createTestStrapi({
    contentTypes: {
      article: {
        info: { singularName: 'article', pluralName: 'articles', displayName: 'Article' },
        options: { draftAndPublish: true },
        pluginOptions: { i18n: { localized: true } },
        attributes: {
          title: { type: 'string', pluginOptions: { i18n: { localized: true } } },
        },
      },
      note: {
        info: { singularName: 'note', pluralName: 'notes', displayName: 'Note' },
        options: { draftAndPublish: true },
        attributes: { title: { type: 'string' } },
      },
      tag: {
        info: { singularName: 'tag', pluralName: 'tags', displayName: 'Tag' },
        options: { draftAndPublish: false },
        attributes: { title: { type: 'string' } },
      },
    },
    locales: [
      { code: 'en', name: 'English (en)' },
      { code: 'pl', name: 'Polish (pl)' },
    ],
    plugins: {
      greenlight: { enabled: true, resolve: PLUGIN_PATH },
    },
    ...options,
  });

export const plugin = (strapi: any, name: string) => strapi.plugin('greenlight').service(name);

/** A three-stage workflow: Draft → In review → Approved. */
export const seedWorkflow = async (
  strapi: any,
  overrides: Record<string, unknown> = {},
  contentTypes: string[] = [UID]
) =>
  plugin(strapi, 'workflow').create({
    name: `Editorial ${Math.round(performance.now() * 1000)}`,
    contentTypes,
    stages: [
      { name: 'Draft', order: 0 },
      { name: 'In review', order: 1 },
      { name: 'Approved', order: 2, isTerminal: true },
    ],
    ...overrides,
  });

export const asUser = (id = 1, roles: Array<{ id: number; code?: string }> = []) => ({
  id,
  firstname: 'Anna',
  lastname: 'Kowalska',
  roles,
});

export const SUPER_ADMIN = asUser(99, [{ id: 1, code: 'strapi-super-admin' }]);

export const publishedCount = async (strapi: any, documentId: string, uid = UID) => {
  const rows = await strapi.db
    .query(uid)
    .findMany({ where: { documentId, publishedAt: { $notNull: true } } });
  return rows.length;
};
