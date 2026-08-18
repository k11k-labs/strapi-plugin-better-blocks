import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  ARTICLE,
  AUTHOR,
  HOMEPAGE,
  QUOTE,
  TAG,
  bootWithFerry,
  fakeUpload,
  service,
  wipe,
} from './helpers';
import { parseFile } from '../server/src/services/parse';
import type { Report } from '../server/src/types';

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await bootWithFerry();
  strapi = app.strapi;
}, 180_000);

afterAll(() => app?.destroy());

beforeEach(async () => {
  await wipe(strapi, ARTICLE);
  await wipe(strapi, AUTHOR);
  await wipe(strapi, TAG);
});

const plan = (uid: string) => service(strapi, 'schema').plan(uid);

const file = (documents: unknown[], contentType = ARTICLE) =>
  JSON.stringify({ ferry: 1, contentType, status: 'draft', count: documents.length, documents });

const preview = (documents: unknown[], options: any = {}): Promise<Report> =>
  service(strapi, 'importer').preview(
    { uid: ARTICLE, ...options },
    parseFile(file(documents, options.uid ?? ARTICLE), 'json', plan(options.uid ?? ARTICLE))
  );

const apply = (documents: unknown[], options: any = {}): Promise<Report> =>
  service(strapi, 'importer').apply(
    { uid: ARTICLE, ...options },
    parseFile(file(documents, options.uid ?? ARTICLE), 'json', plan(options.uid ?? ARTICLE))
  );

const articles = () =>
  strapi.documents(ARTICLE).findMany({ populate: ['author', 'tags', 'related', 'seo'] });

const anAuthor = (documentId = 'ferryauthor0000000001', name = 'Ada') =>
  strapi.documents(AUTHOR).create({ data: { documentId, name } });

describe('the dry run', () => {
  it('1. writes nothing at all', async () => {
    const report = await preview([{ documentId: 'ferrynew000000000001', title: 'New' }]);

    expect(report.applied).toBe(false);
    expect(report.created).toBe(1);
    expect(await articles()).toHaveLength(0);
  });

  it('2. tells creates from updates before either happens', async () => {
    await strapi
      .documents(ARTICLE)
      .create({ data: { documentId: 'ferryexisting00000001', title: 'Already here' } });

    const report = await preview([
      { documentId: 'ferryexisting00000001', title: 'Changed' },
      { documentId: 'ferrynew000000000001', title: 'New' },
    ]);

    expect(report.updated).toBe(1);
    expect(report.created).toBe(1);
    expect(report.rows).toEqual([
      expect.objectContaining({ row: 1, outcome: 'update' }),
      expect.objectContaining({ row: 2, outcome: 'create' }),
    ]);
  });

  it('3. promises what the import then does', async () => {
    const documents = [
      { documentId: 'ferryone00000000001', title: 'One' },
      { documentId: 'ferrytwo00000000001', title: 'Two' },
    ];

    const promised = await preview(documents);
    const done = await apply(documents);

    expect({ created: done.created, updated: done.updated, skipped: done.skipped }).toEqual({
      created: promised.created,
      updated: promised.updated,
      skipped: promised.skipped,
    });
  });
});

describe('identity', () => {
  it('4. creates the document under the documentId the file gives it', async () => {
    await apply([{ documentId: 'ferrykept00000000001', title: 'Kept' }]);

    const [article] = await articles();
    expect(article.documentId).toBe('ferrykept00000000001');
  });

  it('5. updates rather than duplicates on a second run', async () => {
    const documents = [{ documentId: 'ferryonce00000000001', title: 'Once' }];

    await apply(documents);
    const second = await apply(documents);

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(await articles()).toHaveLength(1);
  });

  it('6. leaves an existing document alone when told to', async () => {
    await apply([{ documentId: 'ferryhold00000000001', title: 'Original' }]);
    const report = await apply([{ documentId: 'ferryhold00000000001', title: 'Overwritten' }], {
      onExisting: 'skip',
    });

    const [article] = await articles();
    expect(report.skipped).toBe(1);
    expect(article.title).toBe('Original');
  });
});

describe('relations', () => {
  it('7. connects a relation whose target is already here', async () => {
    const author = await anAuthor();

    await apply([
      { documentId: 'ferrylinked0000000001', title: 'Linked', author: author.documentId },
    ]);

    const [article] = await articles();
    expect(article.author?.documentId).toBe(author.documentId);
  });

  it('8. connects two documents from the same file, in either order', async () => {
    // The second article is named by the first, before it exists. A single pass
    // fails here, and Strapi refuses the whole row rather than the one field.
    await apply([
      { documentId: 'ferryfirst000000001', title: 'First', related: ['ferrysecond00000001'] },
      { documentId: 'ferrysecond00000001', title: 'Second' },
    ]);

    const all = await articles();
    const first = all.find((article: any) => article.documentId === 'ferryfirst000000001');

    expect(all).toHaveLength(2);
    expect(first.related.map((entry: any) => entry.documentId)).toEqual(['ferrysecond00000001']);
  });

  it('9. connects a to-many relation to every target', async () => {
    const alpha = await strapi
      .documents(TAG)
      .create({ data: { documentId: 'ferrytagalpha000001', name: 'Alpha' } });
    const beta = await strapi
      .documents(TAG)
      .create({ data: { documentId: 'ferrytagbeta0000001', name: 'Beta' } });

    await apply([
      {
        documentId: 'ferrytagged00000001',
        title: 'Tagged',
        tags: [alpha.documentId, beta.documentId],
      },
    ]);

    const [article] = await articles();
    expect(article.tags.map((tag: any) => tag.documentId).sort()).toEqual(
      [alpha.documentId, beta.documentId].sort()
    );
  });

  it('10. connects a relation that lives inside a component', async () => {
    const author = await anAuthor();

    await apply([
      {
        documentId: 'ferrynested00000001',
        title: 'Nested',
        seo: { metaTitle: 'Meta', owner: author.documentId },
      },
    ]);

    const [article] = await articles();
    const seo = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: article.documentId, populate: { seo: { populate: ['owner'] } } });

    expect(seo.seo.owner.documentId).toBe(author.documentId);
  });
});

describe('relations that point at nothing', () => {
  it('11. names the row, the field and the key, instead of failing at the database', async () => {
    const report = await preview([
      { documentId: 'ferrydangling000001', title: 'Dangling', author: 'ferrynosuchauthor01' },
    ]);

    expect(report.unresolved).toEqual([
      expect.objectContaining({
        row: 1,
        field: 'author',
        target: AUTHOR,
        keys: ['ferrynosuchauthor01'],
      }),
    ]);
  });

  it('12. finds one inside a component, with the path to it', async () => {
    const report = await preview([
      {
        documentId: 'ferrydeep0000000001',
        title: 'Deep',
        seo: { metaTitle: 'Meta', owner: 'ferrynosuchauthor01' },
      },
    ]);

    expect(report.unresolved[0]).toMatchObject({ field: 'seo.owner', target: AUTHOR });
  });

  it('13. keeps the row and drops the link, by default', async () => {
    await apply([
      { documentId: 'ferrykeeprow0000001', title: 'Kept', author: 'ferrynosuchauthor01' },
    ]);

    const [article] = await articles();
    expect(article.title).toBe('Kept');
    expect(article.author).toBeFalsy();
  });

  it('14. writes nothing at all when told to refuse instead', async () => {
    const report = await apply(
      [{ documentId: 'ferryrefused0000001', title: 'Refused', author: 'ferrynosuchauthor01' }],
      { onMissingRelation: 'fail' }
    );

    expect(report.applied).toBe(false);
    expect(await articles()).toHaveLength(0);
  });
});

describe('all or nothing', () => {
  // A hand-edited file with text where a number belongs. Strapi refuses it,
  // which is what makes it a usable stand-in for any row that cannot be
  // written. Note that `required` would not do: a Strapi 5 draft is allowed to
  // be incomplete, so a missing title is not an error until publish time.
  const clashing = [
    { documentId: 'ferrygood00000000001', title: 'Good', views: 1 },
    { documentId: 'ferrybad000000000001', title: 'Bad', views: 'not a number' },
  ];

  it('15. rolls the whole import back when a row fails', async () => {
    const report = await apply(clashing);

    expect(report.applied).toBe(false);
    expect(report.errored).toBeGreaterThan(0);
    // The good row was written and then taken back, which is the point: a
    // half-applied import is worse than a refused one, because nobody knows
    // which half.
    expect(await articles()).toHaveLength(0);
  });

  it('16. commits the rest when asked to keep going', async () => {
    const report = await apply(clashing, { continueOnError: true });

    expect(report.applied).toBe(true);
    expect(report.errored).toBe(1);

    const all = await articles();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Good');
  });
});

describe('csv', () => {
  const csvApply = (text: string, options: any = {}) =>
    service(strapi, 'importer').apply(
      { uid: ARTICLE, ...options },
      parseFile(text, 'csv', plan(ARTICLE))
    );

  it('17. talks a spreadsheet out of everything being a string', async () => {
    await csvApply('documentId,title,views,featured\r\nferrycsv00000000001,From CSV,7,true\r\n');

    const [article] = await articles();
    expect(article.views).toBe(7);
    expect(article.featured).toBe(true);
    expect(article.title).toBe('From CSV');
  });

  it('18. reads a to-many relation from one cell', async () => {
    await strapi.documents(TAG).create({ data: { documentId: 'ferrytagalpha000001', name: 'A' } });
    await strapi.documents(TAG).create({ data: { documentId: 'ferrytagbeta0000001', name: 'B' } });

    await csvApply(
      'documentId,title,tags\r\nferrycsvrel00000001,Tagged,"ferrytagalpha000001,ferrytagbeta0000001"\r\n'
    );

    const [article] = await articles();
    expect(article.tags).toHaveLength(2);
  });

  it('19. leaves a blank cell alone rather than erasing what is there', async () => {
    await apply([{ documentId: 'ferryblank000000001', title: 'Has a body', body: 'Keep me' }]);
    await csvApply('documentId,title,body\r\nferryblank000000001,Renamed,\r\n');

    const [article] = await articles();
    expect(article.title).toBe('Renamed');
    expect(article.body).toBe('Keep me');
  });

  it('20. says which columns it did not recognise', async () => {
    const report = await service(strapi, 'importer').preview(
      { uid: ARTICLE },
      parseFile('documentId,title,nonsense\r\nferrycsv00000000001,T,x\r\n', 'csv', plan(ARTICLE))
    );

    expect(report.warnings.join(' ')).toContain('nonsense');
  });
});

describe('media', () => {
  it('21. reconnects a file that is already in this Media Library, by hash', async () => {
    await fakeUpload(strapi, 'ferryknownhash0001');

    await apply([
      {
        documentId: 'ferrymedia000000001',
        title: 'With cover',
        cover: { hash: 'ferryknownhash0001', name: 'known.png' },
      },
    ]);

    const [article] = await articles();
    const populated = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: article.documentId, populate: ['cover'] });

    expect(populated.cover?.hash).toBe('ferryknownhash0001');
  });

  it('22. leaves the field empty and says so when the file is not here', async () => {
    const report = await apply([
      {
        documentId: 'ferrynomedia0000001',
        title: 'No cover here',
        cover: { hash: 'ferrymissinghash01', name: 'missing.png' },
      },
    ]);

    expect(report.warnings.join(' ')).toContain('Media Library');

    const [article] = await articles();
    const populated = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: article.documentId, populate: ['cover'] });

    expect(populated.cover).toBeFalsy();
    expect(populated.title).toBe('No cover here');
  });
});

describe('publishing', () => {
  it('23. publishes what the import was told is published', async () => {
    await apply([{ documentId: 'ferrylive0000000001', title: 'Live' }], { status: 'published' });

    const published = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: 'ferrylive0000000001', status: 'published' });

    expect(published?.title).toBe('Live');
  });

  it('24. leaves a draft as a draft', async () => {
    await apply([{ documentId: 'ferrydraft000000001', title: 'Draft' }]);

    const published = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: 'ferrydraft000000001', status: 'published' });

    expect(published).toBeFalsy();
  });
});

describe('single types', () => {
  it('25. updates the one document there is, rather than making a second', async () => {
    await strapi.documents(HOMEPAGE).create({ data: { headline: 'Before' } });

    const report = await service(strapi, 'importer').apply(
      { uid: HOMEPAGE },
      parseFile(file([{ headline: 'After' }], HOMEPAGE), 'json', plan(HOMEPAGE))
    );

    const homepage = await strapi.documents(HOMEPAGE).findFirst();

    expect(report.updated).toBe(1);
    expect(homepage.headline).toBe('After');
  });
});

describe('scope', () => {
  it('26. refuses a content type that is not the project’s own', async () => {
    await expect(
      service(strapi, 'importer').apply(
        { uid: 'plugin::upload.file' },
        { documents: [], warnings: [] }
      )
    ).rejects.toThrow('not available');
  });

  it('27. says when the file was exported from something else', async () => {
    const report = await service(strapi, 'importer').preview(
      { uid: ARTICLE },
      parseFile(
        file([{ documentId: 'ferryelse0000000001', title: 'X' }], AUTHOR),
        'json',
        plan(ARTICLE)
      )
    );

    expect(report.warnings.join(' ')).toContain(AUTHOR);
  });
});

describe('dynamic zones', () => {
  it('28. writes a dynamic zone back in the order the file has it', async () => {
    await apply([
      {
        documentId: 'ferryzone0000000001',
        title: 'Zoned',
        blocks: [
          { __component: QUOTE, body: 'First' },
          { __component: QUOTE, body: 'Second' },
        ],
      },
    ]);

    const article = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: 'ferryzone0000000001', populate: ['blocks'] });

    expect(article.blocks.map((block: any) => block.body)).toEqual(['First', 'Second']);
  });
});
