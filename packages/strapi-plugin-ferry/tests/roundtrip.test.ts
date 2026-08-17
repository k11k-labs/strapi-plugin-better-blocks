/**
 * The claim, tested.
 *
 * Everything else checks a part. This checks the thing people actually do:
 * take a copy of an environment's content, put it into an environment that does
 * not have it, and end up with the same content. The measure is not "it did not
 * throw" - it is that a second export is byte-for-byte the first one.
 *
 * The plugin this replaces says of its own export "seems working, need
 * testing". This is that test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  ARTICLE,
  AUTHOR,
  QUOTE,
  SEO,
  TAG,
  bootWithFerry,
  fakeUpload,
  service,
  wipe,
} from './helpers';
import { parseFile } from '../server/src/services/parse';

let app: TestStrapiInstance;
let strapi: any;

const exportOf = (uid: string, format: 'json' | 'csv' = 'json') =>
  service(strapi, 'exporter').run({ uid, format });

const importInto = (
  uid: string,
  body: string,
  format: 'json' | 'csv' = 'json',
  options: any = {}
) =>
  service(strapi, 'importer').apply(
    { uid, ...options },
    parseFile(body, format, service(strapi, 'schema').plan(uid))
  );

/** The content the round trip has to survive, built once. */
const seed = async () => {
  const ada = await strapi.documents(AUTHOR).create({
    data: {
      documentId: 'ferryauthorada0000001',
      name: 'Ada',
      links: [
        { href: 'https://example.com', label: 'Home' },
        { href: 'https://example.org', label: 'Elsewhere' },
      ],
    },
  });

  await strapi.documents(AUTHOR).create({
    data: { documentId: 'ferryauthorgrace00001', name: 'Grace' },
  });

  const alpha = await strapi
    .documents(TAG)
    .create({ data: { documentId: 'ferrytagalpha0000001', name: 'Alpha' } });
  const beta = await strapi
    .documents(TAG)
    .create({ data: { documentId: 'ferrytagbeta00000001', name: 'Beta' } });

  await fakeUpload(strapi, 'ferryroundtriphash01');
  const cover = await strapi.db
    .query('plugin::upload.file')
    .findOne({ where: { hash: 'ferryroundtriphash01' } });

  await strapi.documents(ARTICLE).create({
    data: {
      documentId: 'ferryarticleone000001',
      title: 'The first one',
      body: 'Body with, a comma and a "quote" and\na line break',
      views: 42,
      featured: true,
      meta: { nested: { deep: true }, list: [1, 2, 3] },
      author: ada.documentId,
      tags: [beta.documentId, alpha.documentId],
      seo: {
        metaTitle: 'Meta title',
        canonical: { href: 'https://example.com/one', label: 'Canonical' },
        owner: ada.documentId,
      },
      blocks: [
        { __component: QUOTE, body: 'A quote' },
        { __component: SEO, metaTitle: 'Inside a zone' },
        { __component: QUOTE, body: 'Another quote' },
      ],
      cover: cover.id,
    },
  });

  await strapi.documents(ARTICLE).create({
    data: {
      documentId: 'ferryarticletwo000001',
      title: 'The second one',
      author: 'ferryauthorgrace00001',
    },
  });

  // The self-relation is wired after both articles exist, because Strapi
  // refuses a write naming a document that is not there yet. Seeding the
  // fixture runs into the exact wall the importer does, which is a fair
  // reminder that the two passes are not architecture for its own sake.
  await strapi.documents(ARTICLE).update({
    documentId: 'ferryarticleone000001',
    data: { related: ['ferryarticletwo000001'] },
  });
};

beforeAll(async () => {
  app = await bootWithFerry();
  strapi = app.strapi;
  await seed();
}, 180_000);

afterAll(() => app?.destroy());

describe('out and back', () => {
  it('1. rebuilds a whole environment from its files, exactly', async () => {
    const authorsBefore = await exportOf(AUTHOR);
    const tagsBefore = await exportOf(TAG);
    const articlesBefore = await exportOf(ARTICLE);

    // A different environment: nothing of ours in it.
    await wipe(strapi, ARTICLE);
    await wipe(strapi, AUTHOR);
    await wipe(strapi, TAG);

    expect(await strapi.documents(ARTICLE).findMany()).toHaveLength(0);

    // Targets before the documents that point at them - the order a person
    // would choose. The self-relation inside the article file is the part that
    // no ordering can help with, and that the second pass exists for.
    const authors = await importInto(AUTHOR, authorsBefore.body);
    const tags = await importInto(TAG, tagsBefore.body);
    const articles = await importInto(ARTICLE, articlesBefore.body);

    expect([authors.errored, tags.errored, articles.errored]).toEqual([0, 0, 0]);
    expect(articles.unresolved).toEqual([]);

    expect((await exportOf(AUTHOR)).body).toBe(authorsBefore.body);
    expect((await exportOf(TAG)).body).toBe(tagsBefore.body);
    expect((await exportOf(ARTICLE)).body).toBe(articlesBefore.body);
  });

  it('2. keeps every kind of field through the trip', async () => {
    const article = await strapi.documents(ARTICLE).findOne({
      documentId: 'ferryarticleone000001',
      populate: {
        author: true,
        tags: true,
        related: true,
        cover: true,
        blocks: { on: { [QUOTE]: true, [SEO]: true } },
        seo: { populate: { canonical: true, owner: true } },
      },
    });

    expect(article.title).toBe('The first one');
    expect(article.body).toContain('a line break');
    expect(article.views).toBe(42);
    expect(article.featured).toBe(true);
    expect(article.meta).toEqual({ nested: { deep: true }, list: [1, 2, 3] });

    expect(article.author.documentId).toBe('ferryauthorada0000001');
    expect(article.tags).toHaveLength(2);
    expect(article.related.map((entry: any) => entry.documentId)).toEqual([
      'ferryarticletwo000001',
    ]);

    expect(article.seo.metaTitle).toBe('Meta title');
    expect(article.seo.canonical.href).toBe('https://example.com/one');
    expect(article.seo.owner.documentId).toBe('ferryauthorada0000001');

    expect(article.blocks.map((block: any) => block.__component)).toEqual([QUOTE, SEO, QUOTE]);
    expect(article.blocks[2].body).toBe('Another quote');

    expect(article.cover.hash).toBe('ferryroundtriphash01');
  });

  it('3. keeps a repeatable component in order', async () => {
    const author = await strapi
      .documents(AUTHOR)
      .findOne({ documentId: 'ferryauthorada0000001', populate: ['links'] });

    expect(author.links.map((link: any) => link.label)).toEqual(['Home', 'Elsewhere']);
  });

  it('4. changes nothing when the same file is imported again', async () => {
    const before = await exportOf(ARTICLE);

    const again = await importInto(ARTICLE, before.body);

    expect(again.created).toBe(0);
    expect(again.errored).toBe(0);
    expect((await exportOf(ARTICLE)).body).toBe(before.body);
  });
});

describe('out and back as a spreadsheet', () => {
  it('5. round-trips the flat fields, commas and line breaks included', async () => {
    const before = await exportOf(ARTICLE, 'csv');

    await importInto(ARTICLE, before.body, 'csv');

    expect((await exportOf(ARTICLE, 'csv')).body).toBe(before.body);
  });

  it('6. leaves the fields CSV cannot carry exactly as they were', async () => {
    // The CSV import above wrote every row. Nothing it could not describe may
    // have been cleared as a side effect - which is the whole reason a blank
    // cell means "leave alone" rather than "empty this".
    const article = await strapi.documents(ARTICLE).findOne({
      documentId: 'ferryarticleone000001',
      populate: {
        seo: { populate: ['canonical'] },
        blocks: { on: { [QUOTE]: true, [SEO]: true } },
      },
    });

    expect(article.seo.metaTitle).toBe('Meta title');
    expect(article.seo.canonical.href).toBe('https://example.com/one');
    expect(article.blocks).toHaveLength(3);
  });
});
