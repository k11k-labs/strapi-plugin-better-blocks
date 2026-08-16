import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestStrapi } from '../src/index.js';
import type { TestStrapiInstance } from '../src/index.js';

/**
 * How to record exactly one version per publish.
 *
 * The Content Manager's publish controller calls `updateDocument()` and then
 * `documentManager.publish()` as two sequential calls wrapped in a single
 * `strapi.db.transaction`. They are siblings, not nested — so no async-context
 * flag set when entering `publish` can suppress the `update` that already ran.
 *
 * What they do share is the transaction. Buffering snapshot intents and flushing
 * them on commit lets the two collapse into one, and works for programmatic
 * writes too, where no request URL exists to sniff.
 */

const UID = 'api::article.article';

let app: TestStrapiInstance;

/**
 * Snapshot intents recorded during the current transaction.
 *
 * NOTE FOR THE REAL IMPLEMENTATION: a module-level buffer is only safe here
 * because the test drives one write at a time. In the plugin the buffer must be
 * scoped to the transaction — an AsyncLocalStorage store established when the
 * transaction opens — or two concurrent requests will flush each other's
 * intents.
 */
let buffer: Array<{ action: string; documentId: string; locale: string }> = [];
/** Snapshots that survived coalescing and would be written to the versions table. */
let flushed: Array<{ action: string; documentId: string; locale: string }> = [];

const ANCHOR_PRIORITY = [
  'publish',
  'unpublish',
  'discardDraft',
  'clone',
  'create',
  'update',
];

function coalesce(intents: typeof buffer): typeof buffer {
  const byDocument = new Map<string, (typeof buffer)[number]>();

  for (const intent of intents) {
    const key = `${intent.documentId}:${intent.locale}`;
    const current = byDocument.get(key);
    if (
      !current ||
      ANCHOR_PRIORITY.indexOf(intent.action) <
        ANCHOR_PRIORITY.indexOf(current.action)
    ) {
      byDocument.set(key, intent);
    }
  }

  return [...byDocument.values()];
}

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
        pluginOptions: { i18n: { localized: true } },
        attributes: {
          title: {
            type: 'string',
            pluginOptions: { i18n: { localized: true } },
          },
        },
      },
    },
    locales: [
      { code: 'en', name: 'English (en)' },
      { code: 'pl', name: 'Polish (pl)' },
    ],
    onRegistered: (strapi) => {
      strapi.documents.use(async (context: any, next: any) => {
        const result = await next();

        const tracked = [
          'create',
          'update',
          'clone',
          'publish',
          'unpublish',
          'discardDraft',
        ];
        if (!tracked.includes(context.action)) return result;

        const documentId = result?.documentId ?? context.params?.documentId;
        const locale = context.params?.locale ?? 'en';

        await strapi.db.transaction(async ({ onCommit }: any) => {
          buffer.push({ action: context.action, documentId, locale });
          onCommit(() => {
            // Everything buffered under this transaction lands together.
            flushed.push(...coalesce(buffer));
            buffer = [];
          });
        });

        return result;
      });
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

function reset() {
  buffer = [];
  flushed = [];
}

describe('publish coalescing via the shared transaction', () => {
  it('collapses the Content Manager update+publish pair into a single publish version', async () => {
    const created = await app.strapi.documents(UID).create({
      data: { title: 'draft' },
      locale: 'en',
    });
    reset();

    // Exactly what the CM publish controller does: update, then publish, both
    // inside one transaction.
    await app.strapi.db.transaction(async () => {
      await app.strapi.documents(UID).update({
        documentId: created.documentId,
        locale: 'en',
        data: { title: 'edited then published' },
      });
      await app.strapi.documents(UID).publish({
        documentId: created.documentId,
        locale: 'en',
      });
    });

    expect(flushed).toHaveLength(1);
    expect(flushed[0].action).toBe('publish');
  });

  it('still records a standalone update as its own version', async () => {
    const created = await app.strapi.documents(UID).create({
      data: { title: 'draft' },
      locale: 'en',
    });
    reset();

    await app.strapi.documents(UID).update({
      documentId: created.documentId,
      locale: 'en',
      data: { title: 'just an edit' },
    });

    expect(flushed).toHaveLength(1);
    expect(flushed[0].action).toBe('update');
  });

  it('keeps versions for different locales separate', async () => {
    const created = await app.strapi.documents(UID).create({
      data: { title: 'EN' },
      locale: 'en',
    });
    await app.strapi.documents(UID).update({
      documentId: created.documentId,
      locale: 'pl',
      data: { title: 'PL' },
    });
    reset();

    await app.strapi.db.transaction(async () => {
      await app.strapi.documents(UID).update({
        documentId: created.documentId,
        locale: 'en',
        data: { title: 'EN v2' },
      });
      await app.strapi.documents(UID).update({
        documentId: created.documentId,
        locale: 'pl',
        data: { title: 'PL v2' },
      });
    });

    expect(flushed).toHaveLength(2);
    expect(flushed.map((f) => f.locale).sort()).toEqual(['en', 'pl']);
  });

  it('writes no version when the surrounding transaction rolls back', async () => {
    const created = await app.strapi.documents(UID).create({
      data: { title: 'draft' },
      locale: 'en',
    });
    reset();

    await expect(
      app.strapi.db.transaction(async () => {
        await app.strapi.documents(UID).update({
          documentId: created.documentId,
          locale: 'en',
          data: { title: 'never committed' },
        });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');

    // Rule 11: a version of a document state that never existed must not survive.
    expect(flushed).toHaveLength(0);
  });
});
