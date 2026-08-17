import { fileURLToPath } from 'node:url';

import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

export const ARTICLE = 'api::article.article';
export const AUTHOR = 'api::author.author';
export const HOMEPAGE = 'api::homepage.homepage';
export const SEO = 'shared.seo';
export const QUOTE = 'shared.quote';
export const LINK = 'shared.link';

/**
 * Absolute, because the harness writes its fixture app to a temp directory and a
 * relative `resolve` would be resolved from there rather than from the repo.
 */
export const PLUGIN_PATH = fileURLToPath(new URL('..', import.meta.url));

/**
 * A schema with one of everything the diagram has to handle:
 *
 *   a two-sided relation      article ↔ author, so the pair must not draw twice
 *   a single type             homepage, drawn differently from a collection
 *   a component               article → shared.seo
 *   a repeatable component    author → shared.link, "many"
 *   a nested component        shared.seo → shared.link, a component of a component
 *   a dynamic zone            article → quote | seo, one edge per member
 */
export const bootWithBlueprint = (
  options: Parameters<typeof createTestStrapi>[0] = {}
): Promise<TestStrapiInstance> =>
  createTestStrapi({
    contentTypes: {
      article: {
        info: { singularName: 'article', pluralName: 'articles', displayName: 'Article' },
        options: { draftAndPublish: true },
        attributes: {
          title: { type: 'string', required: true },
          author: {
            type: 'relation',
            relation: 'manyToOne',
            target: AUTHOR,
            inversedBy: 'articles',
          },
          seo: { type: 'component', component: SEO, repeatable: false },
          body: { type: 'dynamiczone', components: [QUOTE, SEO] },
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
      homepage: {
        kind: 'singleType',
        info: { singularName: 'homepage', pluralName: 'homepages', displayName: 'Homepage' },
        attributes: { headline: { type: 'string' } },
      },
    },
    components: {
      'shared.seo': {
        attributes: {
          metaTitle: { type: 'string' },
          canonical: { type: 'component', component: LINK, repeatable: false },
        },
      },
      'shared.quote': {
        attributes: { text: { type: 'text' } },
      },
      'shared.link': {
        attributes: { href: { type: 'string' }, label: { type: 'string' } },
      },
    },
    plugins: {
      blueprint: { enabled: true, resolve: PLUGIN_PATH },
    },
    ...options,
  });

export const graphService = (strapi: any) => strapi.plugin('blueprint').service('graph');
