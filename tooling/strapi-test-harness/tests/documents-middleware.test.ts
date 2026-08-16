import { AsyncLocalStorage } from 'node:async_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestStrapi } from '../src/index.js';
import type { TestStrapiInstance } from '../src/index.js';

/**
 * The content-history spike, run as a test.
 *
 * Every design decision in that plugin rests on how `strapi.documents.use()`
 * actually behaves — which actions fire, what the middleware receives, and
 * whether a publish nests an update inside its own async context. Those are
 * claims about Strapi, so they belong in a test that breaks when Strapi changes,
 * not in a paragraph of a handover document.
 */

const UID = 'api::article.article';

interface Call {
  action: string;
  uid: string;
  paramsLocale: unknown;
  /** Whether the ALS store set by an outer `publish` was visible here. */
  insidePublishContext: boolean;
  result: any;
}

let app: TestStrapiInstance;
let calls: Call[] = [];

const publishContext = new AsyncLocalStorage<{ publishing: true }>();

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
          // Deliberately not localized: the cross-locale restore rule depends on
          // Strapi propagating this to every locale.
          slug: {
            type: 'string',
            pluginOptions: { i18n: { localized: false } },
          },
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
          meta: {
            type: 'component',
            component: 'blocks.meta',
            repeatable: false,
          },
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
    onRegistered: (strapi) => {
      strapi.documents.use(async (context: any, next: any) => {
        const insidePublishContext = publishContext.getStore() !== undefined;

        const record = (result: unknown) => {
          calls.push({
            action: context.action,
            uid: context.uid ?? context.contentType?.uid,
            paramsLocale: context.params?.locale,
            insidePublishContext,
            result,
          });
        };

        if (context.action === 'publish') {
          return publishContext.run({ publishing: true }, async () => {
            const result = await next();
            record(result);
            return result;
          });
        }

        const result = await next();
        record(result);
        return result;
      });
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

async function seed(): Promise<string> {
  calls = [];
  const created = await app.strapi.documents(UID).create({
    data: {
      title: 'EN title',
      slug: 'shared-slug',
      sections: [{ heading: 'Intro', meta: { note: 'nested note' } }],
    },
    locale: 'en',
  });
  return created.documentId;
}

describe('documents.use — which actions reach the middleware', () => {
  it('fires for create, with the documentId only available on the result', async () => {
    const documentId = await seed();

    const create = calls.filter((c) => c.action === 'create');
    expect(create).toHaveLength(1);
    expect(create[0].uid).toBe(UID);
    expect(create[0].result.documentId).toBe(documentId);
  });

  it('fires for update', async () => {
    const documentId = await seed();
    calls = [];

    await app.strapi.documents(UID).update({
      documentId,
      locale: 'en',
      data: { title: 'EN title v2' },
    });

    expect(calls.map((c) => c.action)).toContain('update');
  });

  it('emits publish alone — the document service does not nest an update inside it', async () => {
    const documentId = await seed();
    calls = [];

    await app.strapi.documents(UID).publish({ documentId, locale: 'en' });

    // The double version per publish does not come from the document service.
    expect(calls.map((c) => c.action)).toEqual(['publish']);
  });

  it('sees the Content Manager update as a SIBLING of publish, not a child of it', async () => {
    const documentId = await seed();
    calls = [];

    // What the CM publish controller does (collection-types.js): update the
    // document, then publish it — two sequential calls in one transaction.
    await app.strapi.db.transaction(async () => {
      await app.strapi.documents(UID).update({
        documentId,
        locale: 'en',
        data: { title: 'edited then published' },
      });
      await app.strapi.documents(UID).publish({ documentId, locale: 'en' });
    });

    expect(calls.map((c) => c.action)).toEqual(['update', 'publish']);

    const update = calls.find((c) => c.action === 'update')!;
    // The update runs and finishes BEFORE publish is entered, so an
    // AsyncLocalStorage flag set on entering publish cannot suppress it. Any
    // design that relies on nesting is broken; de-duplication has to happen at
    // the shared transaction instead (see publish-coalescing.test.ts).
    expect(update.insidePublishContext).toBe(false);
  });

  it('fires for unpublish and discardDraft', async () => {
    const documentId = await seed();
    await app.strapi.documents(UID).publish({ documentId, locale: 'en' });
    calls = [];

    await app.strapi.documents(UID).unpublish({ documentId, locale: 'en' });
    expect(calls.map((c) => c.action)).toContain('unpublish');

    await app.strapi.documents(UID).publish({ documentId, locale: 'en' });
    await app.strapi.documents(UID).update({
      documentId,
      locale: 'en',
      data: { title: 'unsaved draft edit' },
    });
    calls = [];

    await app.strapi.documents(UID).discardDraft({ documentId, locale: 'en' });
    expect(calls.map((c) => c.action)).toContain('discardDraft');
  });
});

describe('documents.use — what the middleware result actually contains', () => {
  it('does not populate components on the result, so a snapshot cannot be built from it', async () => {
    const documentId = await seed();

    const create = calls.find((c) => c.action === 'create')!;
    expect(create.result.title).toBe('EN title');
    // The handover's central correction: `result` is not populated, so the
    // snapshot has to re-query with a deep populate instead.
    expect(create.result.sections).toBeUndefined();

    const populated = await app.strapi.db.query(UID).findOne({
      where: { documentId },
      populate: { sections: { populate: { meta: true } } },
    });
    expect(populated.sections[0].heading).toBe('Intro');
    expect(populated.sections[0].meta.note).toBe('nested note');
  });

  it('reports discardDraft only after the draft is already gone', async () => {
    const documentId = await seed();
    await app.strapi.documents(UID).publish({ documentId, locale: 'en' });
    await app.strapi.documents(UID).update({
      documentId,
      locale: 'en',
      data: { title: 'work in progress' },
    });
    calls = [];

    await app.strapi.documents(UID).discardDraft({ documentId, locale: 'en' });

    const draft = await app.strapi.documents(UID).findOne({
      documentId,
      locale: 'en',
      status: 'draft',
    });
    // Post-action state is the published title, so a snapshot taken after
    // discardDraft can never contain the work that was discarded. Capturing it
    // requires reading before next().
    expect(draft.title).toBe('EN title');
  });
});

describe('i18n behaviour the restore rules depend on', () => {
  it('propagates a non-localized field to every locale', async () => {
    const documentId = await seed();

    // A second locale for an existing document is added with update(), not
    // create() — create() would start a separate document.
    await app.strapi.documents(UID).update({
      documentId,
      locale: 'pl',
      data: { title: 'PL title' },
    });

    await app.strapi.documents(UID).update({
      documentId,
      locale: 'en',
      data: { slug: 'changed-once' },
    });

    const pl = await app.strapi
      .documents(UID)
      .findOne({ documentId, locale: 'pl' });
    // Rule 6: a non-localized field cannot be restored per-locale, because
    // writing it in one locale writes it in all of them.
    expect(pl.slug).toBe('changed-once');
    expect(pl.title).toBe('PL title');
  });
});
