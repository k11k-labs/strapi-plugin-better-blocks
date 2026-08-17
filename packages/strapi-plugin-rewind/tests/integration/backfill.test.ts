import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

/**
 * Labelling versions that predate the label column.
 *
 * Exercised against a real Strapi because the label comes from the Content
 * Manager's own idea of an entry's title, which only exists on a booted
 * instance.
 */

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UID = 'api::article.article';
const VERSION_UID = 'plugin::rewind.version';

let app: TestStrapiInstance;

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

beforeAll(async () => {
  app = await createTestStrapi({
    contentTypes: {
      article: {
        info: {
          singularName: 'article',
          pluralName: 'articles',
          displayName: 'Article',
        },
        options: { draftAndPublish: true },
        attributes: { title: { type: 'string' } },
      },
    },
    plugins: {
      rewind: {
        enabled: true,
        resolve: PLUGIN_ROOT,
        config: { contentTypes: [UID], trackApiWrites: true },
      },
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

beforeEach(async () => {
  await app.strapi.db.query(VERSION_UID).deleteMany({});
  await app.strapi.db.query(UID).deleteMany({});
});

/** Imported from source: the plugin exposes it internally, not as a service. */
const runBackfill = async () => {
  const { backfillLabels } = await import('../../server/src/utils/backfillLabels');
  return backfillLabels(app.strapi as never, VERSION_UID);
};

describe('backfillLabels', () => {
  it('labels versions that were recorded without one', async () => {
    await app.strapi.documents(UID).create({ data: { title: 'An old entry' } });
    await settle();

    // Simulate a version written before the column existed.
    await app.strapi.db.query(VERSION_UID).updateMany({ where: {}, data: { label: null } });

    const labelled = await runBackfill();
    expect(labelled).toBe(1);

    const [version] = await app.strapi.db.query(VERSION_UID).findMany({});
    expect(version.label).toBe('An old entry');
  });

  it('does nothing when every version already has a label', async () => {
    await app.strapi.documents(UID).create({ data: { title: 'Already fine' } });
    await settle();

    // The capture path sets it, so there is nothing to do.
    expect(await runBackfill()).toBe(0);
  });

  it('terminates on a version whose content yields no label', async () => {
    await app.strapi.documents(UID).create({ data: { title: 'Has a title' } });
    await settle();

    await app.strapi.db.query(VERSION_UID).updateMany({
      where: {},
      // No title to derive from. Written as an empty string rather than left
      // null, or the next batch would select this row again forever.
      data: { label: null, data: { body: 'no title here' } },
    });

    const labelled = await runBackfill();
    expect(labelled).toBe(1);

    const [version] = await app.strapi.db.query(VERSION_UID).findMany({});
    expect(version.label).toBe('');

    // And a second pass finds nothing left to do.
    expect(await runBackfill()).toBe(0);
  });

  it('handles more rows than fit in one batch', async () => {
    const article = await app.strapi.documents(UID).create({ data: { title: 'Batch source' } });
    await settle();

    const [seed] = await app.strapi.db.query(VERSION_UID).findMany({});
    const rows = Array.from({ length: 250 }, (_, index) => ({
      ...seed,
      id: undefined,
      label: null,
      data: { title: `Entry ${index}` },
      relatedDocumentId: article.documentId,
    }));

    for (const row of rows) {
      await app.strapi.db.query(VERSION_UID).create({ data: row });
    }
    await app.strapi.db.query(VERSION_UID).updateMany({ where: {}, data: { label: null } });

    // 251 rows against a batch size of 200 - the loop has to go round twice.
    expect(await runBackfill()).toBe(251);

    const remaining = await app.strapi.db.query(VERSION_UID).count({ where: { label: null } });
    expect(remaining).toBe(0);
  });
});
