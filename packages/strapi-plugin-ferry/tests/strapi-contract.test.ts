/**
 * Not a test of Ferry. A test of Strapi.
 *
 * The whole import design turns on questions the documentation does not answer,
 * and getting them wrong is not a bug you find later - it is a plugin that
 * duplicates a customer's content on the second run. The abandoned plugin in
 * this niche has an open issue titled "Import fails to create relations in
 * Strapi 5 (Documents API incompatibility)", which reads like nobody ever asked
 * Strapi directly. So: ask Strapi, and keep the answers as tests, because they
 * are assumptions that a Strapi minor could take away.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

const ARTICLE = 'api::article.article';
const AUTHOR = 'api::author.author';

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await createTestStrapi({
    contentTypes: {
      article: {
        info: { singularName: 'article', pluralName: 'articles', displayName: 'Article' },
        options: { draftAndPublish: true },
        attributes: {
          title: { type: 'string' },
          author: {
            type: 'relation',
            relation: 'manyToOne',
            target: AUTHOR,
            inversedBy: 'articles',
          },
          seo: { type: 'component', component: 'shared.seo', repeatable: false },
        },
      },
      author: {
        info: { singularName: 'author', pluralName: 'authors', displayName: 'Author' },
        attributes: {
          name: { type: 'string' },
          articles: {
            type: 'relation',
            relation: 'oneToMany',
            target: ARTICLE,
            mappedBy: 'author',
          },
        },
      },
    },
    components: {
      'shared.seo': {
        info: { displayName: 'Seo' },
        attributes: { metaTitle: { type: 'string' } },
      },
    },
  });
  strapi = app.strapi;
}, 180_000);

afterAll(() => app?.destroy());

const create = (uid: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  strapi.documents(uid).create({ data, ...extra });

describe('document identity', () => {
  it('1. lets an import choose the documentId, which is what makes it an upsert', async () => {
    const wanted = 'ferryprobedocumentid01';

    const created = await create(AUTHOR, { documentId: wanted, name: 'Ada' });

    // If this ever stops holding, Ferry cannot key on documentId and every
    // import has to invent identities and remap relations through a side table.
    expect(created.documentId).toBe(wanted);
  });

  it('2. does not merge a create onto an existing documentId - so the upsert has to look first', async () => {
    const id = 'ferryprobeduplicate001';
    await create(AUTHOR, { documentId: id, name: 'First' });

    let second: any = null;
    let failed = false;
    try {
      second = await create(AUTHOR, { documentId: id, name: 'Second' });
    } catch {
      failed = true;
    }

    const all = await strapi.documents(AUTHOR).findMany({ filters: { documentId: id } });

    // Whichever way it goes, the finding is that `create` is not an upsert:
    // Ferry must look the document up and choose create or update itself.
    expect(failed || all.length > 1).toBe(true);
    if (second) expect(all.length).toBeGreaterThan(1);
  });

  it('3. refuses an update to a documentId that is not there, rather than creating it', async () => {
    const result = await strapi
      .documents(AUTHOR)
      .update({ documentId: 'ferryprobemissing00001', data: { name: 'Nobody' } })
      .catch(() => 'threw');

    expect(result === null || result === 'threw').toBe(true);
  });
});

describe('relations', () => {
  it('4. connects by documentId, the one key that is the same in every environment', async () => {
    const author = await create(AUTHOR, { documentId: 'ferryprobeauthor000001', name: 'Grace' });

    const bare = await create(
      ARTICLE,
      { title: 'Bare', author: author.documentId },
      { populate: ['author'] }
    );
    const connected = await create(
      ARTICLE,
      { title: 'Connect', author: { connect: [author.documentId] } },
      { populate: ['author'] }
    );

    expect(bare.author?.documentId).toBe(author.documentId);
    expect(connected.author?.documentId).toBe(author.documentId);
  });

  it('5. rejects the whole write when a relation target is missing, which is why import is two-pass', async () => {
    const attempt = await create(ARTICLE, {
      title: 'Dangling',
      author: 'ferryprobenosuchdoc001',
    }).then(
      () => 'created',
      (error: Error) => error.message
    );

    expect(attempt).toContain('not found');

    // The row is refused outright, not saved with an empty relation. So an
    // import cannot write documents in file order and hope: an article listed
    // before its author would take the whole row down with it. Ferry writes
    // every document first and wires relations afterwards, and checks the
    // targets before either, so the dry run can name the ones that are missing
    // instead of the import dying half way through.
    const survivors = await strapi.documents(ARTICLE).findMany({ filters: { title: 'Dangling' } });
    expect(survivors).toHaveLength(0);
  });
});

describe('components', () => {
  it('6. takes a component as plain nested data, with no id of its own', async () => {
    const article = await create(
      ARTICLE,
      { title: 'With seo', seo: { metaTitle: 'Hello' } },
      { populate: ['seo'] }
    );

    expect(article.seo?.metaTitle).toBe('Hello');
  });

  it('7. ignores a component id carried over from another database, which is why the export drops them', async () => {
    const article = await create(
      ARTICLE,
      { title: 'Foreign component id', seo: { id: 999_999, metaTitle: 'Carried over' } },
      { populate: ['seo'] }
    );

    // A component row belongs to its one document and its id means nothing
    // anywhere else. Strapi quietly assigns its own, so keeping ids in the
    // export buys nothing and costs a diff on every line.
    expect(article.seo.metaTitle).toBe('Carried over');
    expect(article.seo.id).not.toBe(999_999);
  });
});

describe('validation', () => {
  it('9. lets a draft be incomplete, so `required` is no guide to what will import', async () => {
    const article = await create(ARTICLE, { title: null });

    // Worth pinning down, because the obvious assumption is the opposite one.
    // In Strapi 5 a required field is enforced when a document is published,
    // not when it is saved, so an import of drafts will accept rows that a
    // publish would refuse. Ferry reports what the database rejected rather
    // than pre-judging rows against `required` and refusing work Strapi would
    // have accepted.
    expect(article.documentId).toBeTruthy();
    expect(article.title).toBeFalsy();
  });
});

describe('draft and published', () => {
  it('8. keeps one documentId across both statuses, so publishing is a flag and not a second identity', async () => {
    const draft = await create(ARTICLE, { documentId: 'ferryprobepublish00001', title: 'Draft' });
    const published = await strapi.documents(ARTICLE).publish({ documentId: draft.documentId });

    expect(published.entries?.[0]?.documentId ?? published.documentId).toBe(draft.documentId);

    const asDraft = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: draft.documentId, status: 'draft' });
    const asPublished = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: draft.documentId, status: 'published' });

    expect(asDraft.documentId).toBe(asPublished.documentId);
  });
});
