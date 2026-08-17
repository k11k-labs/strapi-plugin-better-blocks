import { fileURLToPath } from 'node:url';

import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

export const ARTICLE = 'api::article.article';
export const AUTHOR = 'api::author.author';
export const TAG = 'api::tag.tag';
export const HOMEPAGE = 'api::homepage.homepage';
export const SEO = 'shared.seo';
export const LINK = 'shared.link';
export const QUOTE = 'shared.quote';

/**
 * Absolute, because the harness writes its fixture app to a temp directory and a
 * relative `resolve` would be resolved from there rather than from the repo.
 */
export const PLUGIN_PATH = fileURLToPath(new URL('..', import.meta.url));

/**
 * One of everything an import has to survive.
 *
 * The awkward parts are deliberate, because they are the parts that break:
 *
 *   a two-sided relation      article <-> author, so the pair is not written twice
 *   a to-many relation        article -> tags, where order is not meaningful
 *   a self relation           article -> article, which is the forward reference
 *   a nested component        seo -> link, a component inside a component
 *   a relation in a component seo.owner -> author, which is why nested.ts exists
 *   a dynamic zone            article.blocks, one edge per member, order is content
 *   a single type             homepage, which has no documentId to match on
 *   a media field             article.cover, carried as a reference and not bytes
 */
export const bootWithFerry = (
  options: Parameters<typeof createTestStrapi>[0] = {}
): Promise<TestStrapiInstance> =>
  createTestStrapi({
    contentTypes: {
      article: {
        info: { singularName: 'article', pluralName: 'articles', displayName: 'Article' },
        options: { draftAndPublish: true },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'text' },
          views: { type: 'integer' },
          featured: { type: 'boolean' },
          meta: { type: 'json' },
          secret: { type: 'password' },
          author: {
            type: 'relation',
            relation: 'manyToOne',
            target: AUTHOR,
            inversedBy: 'articles',
          },
          tags: { type: 'relation', relation: 'manyToMany', target: TAG },
          // A relation to its own type, so a file can name a document that is
          // further down the same file. This is the case no single-pass import
          // can serve, and the reason Ferry writes everything before it wires
          // anything.
          related: { type: 'relation', relation: 'manyToMany', target: ARTICLE },
          seo: { type: 'component', component: SEO, repeatable: false },
          blocks: { type: 'dynamiczone', components: [QUOTE, SEO] },
          cover: { type: 'media', multiple: false },
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
          links: { type: 'component', component: LINK, repeatable: true },
        },
      },
      tag: {
        info: { singularName: 'tag', pluralName: 'tags', displayName: 'Tag' },
        attributes: { name: { type: 'string' } },
      },
      homepage: {
        kind: 'singleType',
        info: { singularName: 'homepage', pluralName: 'homepages', displayName: 'Homepage' },
        attributes: {
          headline: { type: 'string' },
          hero: { type: 'component', component: LINK, repeatable: false },
        },
      },
    },
    components: {
      'shared.seo': {
        info: { displayName: 'Seo' },
        attributes: {
          metaTitle: { type: 'string' },
          canonical: { type: 'component', component: LINK, repeatable: false },
          owner: { type: 'relation', relation: 'oneToOne', target: AUTHOR },
        },
      },
      'shared.link': {
        info: { displayName: 'Link' },
        attributes: { href: { type: 'string' }, label: { type: 'string' } },
      },
      'shared.quote': {
        info: { displayName: 'Quote' },
        attributes: { body: { type: 'text' } },
      },
    },
    plugins: {
      ferry: { enabled: true, resolve: PLUGIN_PATH },
    },
    ...options,
  });

export const service = (strapi: any, name: string) => strapi.plugin('ferry').service(name);

/** Remove every document of a content type, to import into an empty environment. */
export const wipe = async (strapi: any, uid: string): Promise<void> => {
  const documents = await strapi.documents(uid).findMany({ fields: ['documentId'], limit: 1000 });
  for (const document of documents) {
    await strapi.documents(uid).delete({ documentId: document.documentId });
  }
};

/**
 * A file row, without going through an upload provider.
 *
 * Ferry matches media by hash, and what it needs to match against is a row in
 * the file table. Writing one directly keeps the media tests about the matching
 * rather than about configuring storage.
 */
export const fakeUpload = (strapi: any, hash: string, name = `${hash}.png`) =>
  strapi.db.query('plugin::upload.file').create({
    data: {
      name,
      hash,
      ext: '.png',
      mime: 'image/png',
      size: 12.34,
      url: `/uploads/${name}`,
      provider: 'local',
      folderPath: '/',
    },
  });
