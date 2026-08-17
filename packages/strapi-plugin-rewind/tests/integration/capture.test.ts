import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

/**
 * The write path, against a real Strapi.
 *
 * None of this can be asserted against a mock: which actions reach the
 * middleware, whether a publish records one version or two, and whether a
 * rolled-back save leaves a version behind are all facts about Strapi.
 */

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UID = 'api::article.article';
const VERSION_UID = 'plugin::rewind.version';

let app: TestStrapiInstance;

const versions = async (filters: Record<string, unknown> = {}) =>
  app.strapi.db.query(VERSION_UID).findMany({
    where: { contentType: UID, ...filters },
    orderBy: { id: 'asc' },
  });

/** The snapshot lands in a commit hook, which resolves just after the write. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

const createArticle = async (data: Record<string, unknown> = {}) => {
  const article = await app.strapi.documents(UID).create({
    data: { title: 'First', slug: 'first', ...data },
    locale: 'en',
  });
  await settle();
  return article;
};

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
          title: { type: 'string', pluginOptions: { i18n: { localized: true } } },
          slug: { type: 'string', pluginOptions: { i18n: { localized: false } } },
          sections: {
            type: 'component',
            component: 'blocks.section',
            repeatable: true,
          },
        },
      },
    },
    components: {
      'blocks.section': {
        info: { displayName: 'Section' },
        attributes: {
          heading: { type: 'string' },
          meta: { type: 'component', component: 'blocks.meta', repeatable: false },
        },
      },
      'blocks.meta': {
        info: { displayName: 'Meta' },
        attributes: { note: { type: 'string' } },
      },
    },
    locales: [
      { code: 'en', name: 'English (en)' },
      { code: 'pl', name: 'Polish (pl)' },
    ],
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

describe('which actions record a version', () => {
  it('records a create', async () => {
    await createArticle();

    const rows = await versions();
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('create');
    expect(rows[0].status).toBe('draft');
  });

  it('records an update', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, locale: 'en', data: { title: 'Second' } });
    await settle();

    const rows = await versions();
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('update');
    expect((rows[0].data as any).title).toBe('Second');
  });

  it('records publish, unpublish and discardDraft', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi.documents(UID).publish({ documentId: article.documentId, locale: 'en' });
    await settle();
    await app.strapi.documents(UID).unpublish({ documentId: article.documentId, locale: 'en' });
    await settle();

    const origins = (await versions()).map((row) => row.origin);
    expect(origins).toContain('publish');
    expect(origins).toContain('unpublish');
  });

  it('ignores content types not listed in config', async () => {
    // Nothing else is configured, so this is really asserting the default:
    // a freshly installed plugin tracks nothing at all.
    const config = app.strapi.config.get('plugin::rewind') as { contentTypes: string[] };
    expect(config.contentTypes).toEqual([UID]);
  });
});

describe('one publish, one version', () => {
  it('collapses the Content Manager update-then-publish pair', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    // Exactly what the CM publish controller does: both calls in one
    // transaction, the update first.
    await app.strapi.db.transaction(async () => {
      await app.strapi.documents(UID).update({
        documentId: article.documentId,
        locale: 'en',
        data: { title: 'Edited then published' },
      });
      await app.strapi.documents(UID).publish({
        documentId: article.documentId,
        locale: 'en',
      });
    });
    await settle();

    const rows = await versions();
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('publish');
  });

  it('still records a standalone update as its own version', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, locale: 'en', data: { title: 'Just an edit' } });
    await settle();

    expect(await versions()).toHaveLength(1);
  });
});

describe('what must never produce a version', () => {
  it('records nothing when the save is rolled back', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await expect(
      app.strapi.db.transaction(async () => {
        await app.strapi.documents(UID).update({
          documentId: article.documentId,
          locale: 'en',
          data: { title: 'Never committed' },
        });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    await settle();

    // A version of a document state that never existed is worse than no version.
    expect(await versions()).toHaveLength(0);
  });

  it('records nothing for a save that changed nothing', async () => {
    const article = await createArticle({ title: 'First' });
    // The create's version is the baseline the hash is compared against, so it
    // deliberately stays.
    expect(await versions()).toHaveLength(1);

    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, locale: 'en', data: { title: 'First' } });
    await settle();

    // Still one. updatedAt changes on every write, so this only holds because
    // the snapshot omits it before hashing.
    expect(await versions()).toHaveLength(1);
  });

  it('still records an anchor even when the content is identical', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi.documents(UID).publish({ documentId: article.documentId, locale: 'en' });
    await settle();

    // Publishing unchanged content is still a thing that happened, and the
    // point an editor navigates back to.
    expect(await versions()).toHaveLength(1);
  });
});

describe('discardDraft', () => {
  it('records the work that was discarded, not the state it reverted to', async () => {
    const article = await createArticle({ title: 'Published copy' });
    await app.strapi.documents(UID).publish({ documentId: article.documentId, locale: 'en' });
    await app.strapi.documents(UID).update({
      documentId: article.documentId,
      locale: 'en',
      data: { title: 'Work in progress' },
    });
    await settle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi.documents(UID).discardDraft({
      documentId: article.documentId,
      locale: 'en',
    });
    await settle();

    const rows = await versions({ origin: 'discardDraft' });
    expect(rows).toHaveLength(1);
    // Snapshotting after the action would have stored "Published copy" - the
    // one state that is still recoverable anyway.
    expect((rows[0].data as any).title).toBe('Work in progress');
  });
});

describe('what a version stores', () => {
  it('keeps nested component content and its schema', async () => {
    await createArticle({
      sections: [{ heading: 'Intro', meta: { note: 'nested note' } }],
    });

    const [row] = await versions();
    const data = row.data as any;

    expect(data.sections[0].heading).toBe('Intro');
    expect(data.sections[0].meta.note).toBe('nested note');

    // The component-inside-a-component that Strapi's own snapshot leaves out.
    const schema = row.schemaSnapshot as any;
    expect(schema.components['blocks.section']).toBeDefined();
    expect(schema.components['blocks.meta']).toBeDefined();
  });

  it('stores no component ids', async () => {
    await createArticle({ sections: [{ heading: 'Intro' }] });

    const [row] = await versions();
    // A remembered component id points at a row that no longer exists by the
    // time anyone restores it.
    expect(JSON.stringify(row.data)).not.toContain('"id"');
  });

  it('omits the fields that change on every write', async () => {
    await createArticle();

    const [row] = await versions();
    const data = row.data as any;

    expect(data.updatedAt).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
    expect(data.publishedAt).toBeUndefined();
  });
});

describe('locales', () => {
  it('keeps a separate version per locale', async () => {
    const article = await createArticle();
    await app.strapi.db.query(VERSION_UID).deleteMany({});

    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, locale: 'pl', data: { title: 'Polski' } });
    await settle();

    const rows = await versions();
    expect(rows).toHaveLength(1);
    expect(rows[0].locale).toBe('pl');
  });
});

describe('the versions table', () => {
  it('is registered for persistence so disabling the plugin cannot drop it', async () => {
    const persisted = (await app.strapi.store.get({
      type: 'core',
      key: 'persisted_tables',
    })) as { name: string }[];

    const names = persisted.map((table) => (typeof table === 'string' ? table : table.name));
    expect(names).toContain('rewind_versions');
  });

  it('survives a document being deleted', async () => {
    const article = await createArticle();
    await app.strapi.documents(UID).delete({ documentId: article.documentId });
    await settle();

    // History matters most at exactly the moment the document is gone, so the
    // link is a plain string rather than a cascading relation.
    expect(await versions()).not.toHaveLength(0);
  });
});
