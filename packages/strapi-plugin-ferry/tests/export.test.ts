import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  ARTICLE,
  AUTHOR,
  HOMEPAGE,
  QUOTE,
  SEO,
  TAG,
  bootWithFerry,
  fakeUpload,
  service,
} from './helpers';
import type { Archive } from '../server/src/types';

let app: TestStrapiInstance;
let strapi: any;
let author: any;
let tagOne: any;
let tagTwo: any;

beforeAll(async () => {
  app = await bootWithFerry();
  strapi = app.strapi;

  author = await strapi.documents(AUTHOR).create({
    data: {
      documentId: 'ferryauthorada0000001',
      name: 'Ada',
      links: [
        { href: 'https://example.com', label: 'Home' },
        { href: 'https://example.org', label: 'Other' },
      ],
    },
  });

  tagOne = await strapi.documents(TAG).create({
    data: { documentId: 'ferrytagalpha00000001', name: 'Alpha' },
  });
  tagTwo = await strapi.documents(TAG).create({
    data: { documentId: 'ferrytagbeta000000001', name: 'Beta' },
  });

  await fakeUpload(strapi, 'ferrycoverhash0001');
  const cover = await strapi.db
    .query('plugin::upload.file')
    .findOne({ where: { hash: 'ferrycoverhash0001' } });

  await strapi.documents(ARTICLE).create({
    data: {
      documentId: 'ferryarticleone000001',
      title: 'The first one',
      body: 'Body text',
      views: 42,
      featured: true,
      meta: { source: 'test' },
      secret: 'not-for-export',
      author: author.documentId,
      // Deliberately out of order, to prove the export sorts them.
      tags: [tagTwo.documentId, tagOne.documentId],
      seo: {
        metaTitle: 'Meta',
        canonical: { href: 'https://example.com/one', label: 'Canonical' },
        owner: author.documentId,
      },
      blocks: [
        { __component: QUOTE, body: 'First block' },
        { __component: SEO, metaTitle: 'Second block' },
      ],
      cover: cover.id,
    },
  });

  await strapi.documents(ARTICLE).create({
    data: { documentId: 'ferryarticletwo000001', title: 'The second one' },
  });

  await strapi.documents(HOMEPAGE).create({
    data: { headline: 'Welcome', hero: { href: '/start', label: 'Start' } },
  });
}, 180_000);

afterAll(() => app?.destroy());

const run = (options: any) => service(strapi, 'exporter').run(options);

const archiveOf = async (options: any = {}): Promise<Archive> => {
  const result = await run({ uid: ARTICLE, format: 'json', ...options });
  return JSON.parse(result.body);
};

const first = async (options: any = {}) => {
  const archive = await archiveOf(options);
  return archive.documents.find((document) => document.documentId === 'ferryarticleone000001')!;
};

describe('what comes out', () => {
  it('1. carries the plain fields, with their types intact', async () => {
    const document = await first();

    expect(document).toMatchObject({
      title: 'The first one',
      body: 'Body text',
      views: 42,
      featured: true,
      meta: { source: 'test' },
    });
  });

  it('2. never carries a password, however it was asked', async () => {
    const document = await first();
    const text = JSON.stringify(await archiveOf());

    expect(document).not.toHaveProperty('secret');
    expect(text).not.toContain('not-for-export');
  });

  it('3. leaves out the bookkeeping Strapi maintains for itself', async () => {
    const document = await first();

    for (const field of ['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy']) {
      expect(document).not.toHaveProperty(field);
    }
    expect(document.documentId).toBe('ferryarticleone000001');
  });
});

describe('components', () => {
  it('4. carries a component as nested data', async () => {
    const document = await first();

    expect(document.seo).toMatchObject({ metaTitle: 'Meta' });
  });

  it('5. follows a component into the component inside it', async () => {
    const document = await first();

    // `populate: '*'` stops one level short of this, which is how an export
    // ends up quietly missing half of a real schema.
    expect((document.seo as any).canonical).toMatchObject({
      href: 'https://example.com/one',
      label: 'Canonical',
    });
  });

  it('6. carries a relation that lives inside a component', async () => {
    const document = await first();

    expect((document.seo as any).owner).toBe(author.documentId);
  });

  it('7. drops component ids, which mean nothing in another database', async () => {
    const document = await first();

    expect(document.seo).not.toHaveProperty('id');
    expect((document.seo as any).canonical).not.toHaveProperty('id');
  });

  it('8. keeps a dynamic zone in order, because the order is the content', async () => {
    const document = await first();
    const blocks = document.blocks as any[];

    expect(blocks.map((block) => block.__component)).toEqual([QUOTE, SEO]);
    expect(blocks[0].body).toBe('First block');
    expect(blocks[1].metaTitle).toBe('Second block');
  });

  it('9. carries a repeatable component, in order', async () => {
    const result = await run({ uid: AUTHOR, format: 'json' });
    const archive: Archive = JSON.parse(result.body);
    const document = archive.documents[0];

    expect((document.links as any[]).map((link) => link.label)).toEqual(['Home', 'Other']);
  });
});

describe('relations', () => {
  it('10. carries a relation as the documentId, the one key that travels', async () => {
    const document = await first();

    expect(document.author).toBe(author.documentId);
  });

  it('11. sorts a to-many relation, so the file does not change when nothing did', async () => {
    const document = await first();

    expect(document.tags).toEqual([tagOne.documentId, tagTwo.documentId].sort());
  });

  it('12. leaves relations out when they are not wanted', async () => {
    const document = await first({ relations: false });

    expect(document).not.toHaveProperty('author');
    expect(document).not.toHaveProperty('tags');
  });
});

describe('media', () => {
  it('13. carries a reference to the file rather than the file', async () => {
    const document = await first();

    expect(document.cover).toMatchObject({ hash: 'ferrycoverhash0001', ext: '.png' });
  });

  it('14. says so, rather than letting someone discover it after the import', async () => {
    const result = await run({ uid: ARTICLE, format: 'json' });

    expect(result.warnings.join(' ')).toContain('reference');
  });
});

describe('the file itself', () => {
  it('15. is the same bytes twice, so it can be committed and diffed', async () => {
    const one = await run({ uid: ARTICLE, format: 'json' });
    const two = await run({ uid: ARTICLE, format: 'json' });

    expect(one.body).toBe(two.body);
  });

  it('16. holds no timestamp, which is what would break that', async () => {
    const result = await run({ uid: ARTICLE, format: 'json' });

    expect(result.body).not.toMatch(/exportedAt|generatedAt|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('17. sorts documents by the key that is the same in every environment', async () => {
    const archive = await archiveOf();
    const ids = archive.documents.map((document) => document.documentId);

    expect(ids).toEqual([...ids].sort());
  });

  it('18. names what it is, so a reader knows what they have', async () => {
    const archive = await archiveOf();

    expect(archive).toMatchObject({ ferry: 1, contentType: ARTICLE, status: 'draft' });
    expect(archive.count).toBe(archive.documents.length);
  });
});

describe('csv', () => {
  it('19. writes the flat fields, and says what it left behind', async () => {
    const result = await run({ uid: ARTICLE, format: 'csv' });

    expect(result.filename).toBe('article.csv');
    expect(result.body).toContain('documentId');
    expect(result.body).toContain('The first one');
    expect(result.warnings.join(' ')).toContain('seo');
    expect(result.warnings.join(' ')).toContain('blocks');
  });

  it('20. writes a to-many relation as one cell of keys', async () => {
    const result = await run({ uid: ARTICLE, format: 'csv' });

    expect(result.body).toContain(`"${[tagOne.documentId, tagTwo.documentId].sort().join(',')}"`);
  });
});

describe('scope', () => {
  it('21. exports exactly the documents it was given, for a list-view selection', async () => {
    const archive = await archiveOf({ documentIds: ['ferryarticletwo000001'] });

    expect(archive.documents).toHaveLength(1);
    expect(archive.documents[0].title).toBe('The second one');
  });

  it('22. exports a single type as the one document it is', async () => {
    const result = await run({ uid: HOMEPAGE, format: 'json' });
    const archive: Archive = JSON.parse(result.body);

    expect(archive.documents).toHaveLength(1);
    expect(archive.documents[0]).toMatchObject({ headline: 'Welcome' });
    expect((archive.documents[0].hero as any).label).toBe('Start');
  });

  it('23. refuses a content type that is not the project’s own', async () => {
    await expect(run({ uid: 'plugin::upload.file', format: 'json' })).rejects.toThrow(
      'not available'
    );
  });
});
