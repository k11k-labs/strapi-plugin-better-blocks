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
const diff = () => app.strapi.plugin('rewind').service('diff');

const versions = async () => app.strapi.db.query(VERSION_UID).findMany({ orderBy: { id: 'asc' } });

const added = (spans: any[]) =>
  spans
    .filter((s) => s.op === 'added')
    .map((s) => s.value.trim())
    .join(' ');
const removed = (spans: any[]) =>
  spans
    .filter((s) => s.op === 'removed')
    .map((s) => s.value.trim())
    .join(' ');

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
        attributes: {
          title: { type: 'string' },
          readingTime: { type: 'integer' },
          body: { type: 'json' },
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

describe('diff between consecutive versions', () => {
  it('shows a scalar as a plain before and after', async () => {
    const article = await app.strapi
      .documents(UID)
      .create({ data: { title: 'First', readingTime: 3 } });
    await settle();
    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, data: { readingTime: 7 } });
    await settle();

    const all = await versions();
    const result = await diff().between(all[1].id);

    const change = result.changes.find((c: any) => c.field === 'readingTime');
    expect(change).toMatchObject({ kind: 'changed', before: 3, after: 7 });
    // A number is not prose, so it gets values rather than a word diff.
    expect(change.spans).toBeUndefined();
  });

  it('word-diffs prose instead of dumping both versions', async () => {
    const article = await app.strapi.documents(UID).create({
      data: {
        title: 'A',
        body: [{ type: 'paragraph', children: [{ text: 'Pricing starts at ten euros' }] }],
      },
    });
    await settle();
    await app.strapi.documents(UID).update({
      documentId: article.documentId,
      data: {
        body: [{ type: 'paragraph', children: [{ text: 'Pricing starts at twelve euros' }] }],
      },
    });
    await settle();

    const all = await versions();
    const change = (await diff().between(all[1].id)).changes.find((c: any) => c.field === 'body');

    // The point of the feature: one word, not "content changed".
    expect(removed(change.spans)).toBe('ten');
    expect(added(change.spans)).toBe('twelve');
  });

  it('does not report a formatting-only edit as a text change', async () => {
    const article = await app.strapi.documents(UID).create({
      data: { title: 'A', body: [{ type: 'paragraph', children: [{ text: 'Same words' }] }] },
    });
    await settle();
    await app.strapi.documents(UID).update({
      documentId: article.documentId,
      data: {
        body: [{ type: 'paragraph', children: [{ text: 'Same words', bold: true }] }],
      },
    });
    await settle();

    const all = await versions();
    const change = (await diff().between(all[1].id)).changes.find((c: any) => c.field === 'body');

    // The field did change, but the readable text did not - saying so beats
    // showing an empty diff.
    expect(change).toBeDefined();
    expect(change.spans).toBeUndefined();
  });

  it('reports relations as linked and unlinked', async () => {
    const ada = await app.strapi.documents('api::person.person').create({ data: { name: 'Ada' } });
    const grace = await app.strapi
      .documents('api::person.person')
      .create({ data: { name: 'Grace' } });

    const article = await app.strapi
      .documents(UID)
      .create({ data: { title: 'A', author: ada.documentId } });
    await settle();
    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, data: { author: grace.documentId } });
    await settle();

    const all = await versions();
    const change = (await diff().between(all[1].id)).changes.find((c: any) => c.field === 'author');

    expect(change.linked.map((r: any) => r.documentId)).toEqual([grace.documentId]);
    expect(change.unlinked.map((r: any) => r.documentId)).toEqual([ada.documentId]);
  });

  it('reports no changes between identical content', async () => {
    const article = await app.strapi.documents(UID).create({ data: { title: 'Same' } });
    await settle();

    const all = await versions();
    const result = await diff().between(all[0].id, all[0].id);

    expect(result.identical).toBe(true);
    expect(result.changes).toEqual([]);
    expect(article.documentId).toBeTruthy();
  });

  it('treats the first version as everything being added', async () => {
    await app.strapi.documents(UID).create({ data: { title: 'Brand new' } });
    await settle();

    const [first] = await versions();
    const result = await diff().between(first.id);

    // Nothing precedes it, so there is no left-hand side to compare against.
    expect(result.from).toBeNull();
    expect(result.changes.find((c: any) => c.field === 'title')).toMatchObject({
      kind: 'added',
      after: 'Brand new',
    });
  });

  it('compares against any nominated version, not just the previous one', async () => {
    const article = await app.strapi.documents(UID).create({ data: { title: 'One' } });
    await settle();
    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, data: { title: 'Two' } });
    await settle();
    await app.strapi
      .documents(UID)
      .update({ documentId: article.documentId, data: { title: 'Three' } });
    await settle();

    const all = await versions();
    const result = await diff().between(all[2].id, all[0].id);

    expect(result.changes.find((c: any) => c.field === 'title')).toMatchObject({
      before: 'One',
      after: 'Three',
    });
  });
});
