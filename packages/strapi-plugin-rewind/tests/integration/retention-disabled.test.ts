import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

/**
 * Its own file because `createStrapi()` assigns `global.strapi`: a second
 * instance in the same worker clobbers the first, and Strapi fails with
 * "Duplicated item key". One booted instance per test file.
 */

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UID = 'api::article.article';
const VERSION_UID = 'plugin::rewind.version';

let app: TestStrapiInstance;

beforeAll(async () => {
  app = await createTestStrapi({
    contentTypes: {
      article: {
        info: {
          singularName: 'article',
          pluralName: 'articles',
          displayName: 'Article',
        },
        attributes: { title: { type: 'string' } },
      },
    },
    plugins: {
      rewind: {
        enabled: true,
        resolve: PLUGIN_ROOT,
        config: {
          contentTypes: [UID],
          trackApiWrites: true,
          retention: { enabled: false },
        },
      },
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

describe('retention disabled', () => {
  it('deletes nothing, however old the history is', async () => {
    await app.strapi.db.query(VERSION_UID).create({
      data: {
        contentType: UID,
        relatedDocumentId: 'doc-1',
        locale: null,
        status: 'draft',
        data: { title: 'ancient' },
        schemaSnapshot: { attributes: {}, components: {} },
        relations: {},
        contentHash: 'ancient-hash',
        origin: 'update',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    const result = await app.strapi.plugin('rewind').service('retention').prune();

    expect(result).toEqual({ scanned: 0, deleted: 0, documents: 0 });
    expect(await app.strapi.db.query(VERSION_UID).count({})).toBe(1);
  });
});
