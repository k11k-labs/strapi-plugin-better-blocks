import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestStrapi, dbFileExists } from '../src/index.js';
import type { TestStrapiInstance } from '../src/index.js';

let app: TestStrapiInstance;

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
          slug: {
            type: 'string',
            pluginOptions: { i18n: { localized: false } },
          },
          body: {
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
          // Nested component — the case Strapi's own history snapshot has an
          // open TODO for, so every fixture here needs to exercise it.
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
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

describe('harness boot', () => {
  it('creates a SQLite database on disk', () => {
    expect(dbFileExists(app.dbFile)).toBe(true);
  });

  it('registers the fixture content type under an api:: uid', () => {
    expect(app.strapi.contentTypes['api::article.article']).toBeDefined();
  });

  it('registers nested components', () => {
    expect(app.strapi.getModel('blocks.section')).toBeDefined();
    expect(app.strapi.getModel('blocks.meta')).toBeDefined();
  });

  it('creates the requested locales with the first as default', async () => {
    const locales = await app.strapi.plugin('i18n').service('locales').find();
    expect(locales.map((l: { code: string }) => l.code).sort()).toEqual([
      'en',
      'pl',
    ]);

    const defaultLocale = await app.strapi
      .plugin('i18n')
      .service('locales')
      .getDefaultLocale();
    expect(defaultLocale).toBe('en');
  });

  it('writes and reads documents through the document service', async () => {
    const created = await app.strapi.documents('api::article.article').create({
      data: { title: 'Hello', slug: 'hello' },
      locale: 'en',
    });

    expect(created.documentId).toBeTruthy();

    const found = await app.strapi.documents('api::article.article').findOne({
      documentId: created.documentId,
      locale: 'en',
    });

    expect(found.title).toBe('Hello');
  });
});
