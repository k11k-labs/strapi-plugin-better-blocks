import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UID = 'api::article.article';
const VERSION_UID = 'plugin::rewind.version';

let app: TestStrapiInstance;

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

const restore = () => app.strapi.plugin('rewind').service('restore');

const versions = async () => app.strapi.db.query(VERSION_UID).findMany({ orderBy: { id: 'asc' } });

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
          // Shared across locales - the field that makes restore dangerous.
          slug: { type: 'string', pluginOptions: { i18n: { localized: false } } },
          author: {
            type: 'relation',
            relation: 'oneToOne',
            target: 'api::person.person',
          },
        },
      },
      person: {
        info: {
          singularName: 'person',
          pluralName: 'people',
          displayName: 'Person',
        },
        attributes: { name: { type: 'string' } },
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
  await app.strapi.db.query('api::person.person').deleteMany({});
});

const seed = async () => {
  const article = await app.strapi.documents(UID).create({
    data: { title: 'Version one', slug: 'shared' },
    locale: 'en',
  });
  await settle();

  await app.strapi.documents(UID).update({
    documentId: article.documentId,
    locale: 'en',
    data: { title: 'Version two' },
  });
  await settle();

  const [first] = await versions();
  return { article, firstVersionId: first.id as number };
};

describe('restore', () => {
  it('puts the old content back', async () => {
    const { article, firstVersionId } = await seed();

    await restore().apply(firstVersionId, null);
    await settle();

    const draft = await app.strapi
      .documents(UID)
      .findOne({ documentId: article.documentId, locale: 'en', status: 'draft' });

    expect(draft.title).toBe('Version one');
  });

  it('takes a version of the state it replaces, so it can be undone', async () => {
    const { firstVersionId } = await seed();

    await restore().apply(firstVersionId, null);
    await settle();

    const restorePoint = (await versions()).find((row) => row.origin === 'restore');

    expect(restorePoint).toBeDefined();
    // The state that was about to be overwritten, not the one being restored.
    expect((restorePoint!.data as any).title).toBe('Version two');
  });

  it('records the restore once, not twice', async () => {
    const { firstVersionId } = await seed();
    const before = (await versions()).length;

    await restore().apply(firstVersionId, null);
    await settle();

    // The write restore performs is itself a document-service update; without
    // suppression it would be captured again as an ordinary edit.
    expect((await versions()).length).toBe(before + 1);
  });

  it('writes to the draft and leaves the published version alone', async () => {
    const { article, firstVersionId } = await seed();
    await app.strapi.documents(UID).publish({ documentId: article.documentId, locale: 'en' });
    await settle();

    await restore().apply(firstVersionId, null);
    await settle();

    const published = await app.strapi.documents(UID).findOne({
      documentId: article.documentId,
      locale: 'en',
      status: 'published',
    });

    // Publishing a restore has to stay a deliberate act.
    expect(published.title).toBe('Version two');
  });
});

describe('preview', () => {
  it('names the fields that will change every locale at once', async () => {
    const { firstVersionId } = await seed();

    const preview = await restore().preview(firstVersionId);

    // `slug` is not localised, so restoring it rewrites it for pl as well.
    expect(preview.crossLocaleFields).toContain('slug');
    expect(preview.crossLocaleFields).not.toContain('title');
    expect(preview.affectedLocales.sort()).toEqual(['en', 'pl']);
  });

  it('reports a relation whose target has been deleted', async () => {
    const person = await app.strapi
      .documents('api::person.person')
      .create({ data: { name: 'Ada' } });

    const article = await app.strapi.documents(UID).create({
      data: { title: 'With author', slug: 'a', author: person.documentId },
      locale: 'en',
    });
    await settle();

    await app.strapi.documents('api::person.person').delete({ documentId: person.documentId });

    const [version] = await versions();
    const preview = await restore().preview(version.id as number);

    expect(preview.brokenRelations).toHaveLength(1);

    // And restoring anyway must not throw - it drops the target and says so.
    const result = await restore().apply(version.id as number, null);
    await settle();
    expect(result.warnings.join(' ')).toMatch(/no longer exist/);

    const draft = await app.strapi
      .documents(UID)
      .findOne({ documentId: article.documentId, locale: 'en' });
    expect(draft.title).toBe('With author');
  });
});

describe('restoring across a schema change', () => {
  it('keeps the value of a field that did not exist in the version', async () => {
    const { article, firstVersionId } = await seed();

    // Simulate a field added after the version was taken by removing it from
    // the stored snapshot's schema.
    const version = await app.strapi.db
      .query(VERSION_UID)
      .findOne({ where: { id: firstVersionId } });

    const schemaSnapshot = version.schemaSnapshot as any;
    delete schemaSnapshot.attributes.slug;
    await app.strapi.db.query(VERSION_UID).update({
      where: { id: firstVersionId },
      data: { schemaSnapshot },
    });

    await app.strapi.documents(UID).update({
      documentId: article.documentId,
      locale: 'en',
      data: { slug: 'set-after-the-version' },
    });
    await settle();

    const preview = await restore().preview(firstVersionId);
    expect(preview.fieldsKeptAsIs).toContain('slug');

    await restore().apply(firstVersionId, null);
    await settle();

    const draft = await app.strapi
      .documents(UID)
      .findOne({ documentId: article.documentId, locale: 'en' });

    // Strapi's own restore nulls fields it has no value for. Losing a field's
    // content because it was added last week is not a restore, it is a bug.
    expect(draft.slug).toBe('set-after-the-version');
    expect(draft.title).toBe('Version one');
  });

  it('skips a field that has since been removed from the model', async () => {
    const { firstVersionId } = await seed();

    const version = await app.strapi.db
      .query(VERSION_UID)
      .findOne({ where: { id: firstVersionId } });

    const schemaSnapshot = version.schemaSnapshot as any;
    schemaSnapshot.attributes.subtitle = { type: 'string' };
    const data = { ...(version.data as any), subtitle: 'gone from the model' };
    await app.strapi.db
      .query(VERSION_UID)
      .update({ where: { id: firstVersionId }, data: { schemaSnapshot, data } });

    const preview = await restore().preview(firstVersionId);
    expect(preview.fieldsDropped).toContain('subtitle');

    // Must not throw on the way in.
    const result = await restore().apply(firstVersionId, null);
    expect(result.warnings.join(' ')).toMatch(/subtitle/);
  });
});
