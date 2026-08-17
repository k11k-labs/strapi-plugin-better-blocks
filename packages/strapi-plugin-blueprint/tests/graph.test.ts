import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  ARTICLE,
  AUTHOR,
  HOMEPAGE,
  LINK,
  QUOTE,
  SEO,
  bootWithBlueprint,
  graphService,
} from './helpers';
import type { Edge, Graph } from '../server/src/types';

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await bootWithBlueprint();
  strapi = app.strapi;
}, 180_000);

afterAll(() => app?.destroy());

const build = (options = {}): Graph => graphService(strapi).build(options);

const uids = (graph: Graph) => graph.nodes.map((node) => node.uid);
const between = (graph: Graph, from: string, to: string): Edge[] =>
  graph.edges.filter((edge) => edge.from === from && edge.to === to);

describe('what ends up on the diagram', () => {
  it('1. draws the project’s own content types, and leaves Strapi’s out', () => {
    const graph = build();

    expect(uids(graph)).toEqual(expect.arrayContaining([ARTICLE, AUTHOR, HOMEPAGE]));
    expect(uids(graph).some((uid) => uid.startsWith('plugin::'))).toBe(false);
    expect(uids(graph).some((uid) => uid.startsWith('admin::'))).toBe(false);
  });

  it('2. includes Strapi’s own types when asked, and marks them as not yours', () => {
    const graph = build({ includeForeign: true });

    const foreign = graph.nodes.filter((node) => node.foreign);
    expect(foreign.length).toBeGreaterThan(0);
    expect(foreign.every((node) => !node.uid.startsWith('api::'))).toBe(true);
  });

  it('3. tells a single type from a collection type', () => {
    const graph = build();

    expect(graph.nodes.find((n) => n.uid === HOMEPAGE)?.kind).toBe('singleType');
    expect(graph.nodes.find((n) => n.uid === ARTICLE)?.kind).toBe('collectionType');
  });

  it('4. hides Strapi’s bookkeeping fields unless they are asked for', () => {
    const lean = build().nodes.find((node) => node.uid === ARTICLE)!;
    const full = build({ includeDefaultFields: true }).nodes.find((n) => n.uid === ARTICLE)!;

    expect(lean.fields.map((f) => f.name)).not.toContain('createdAt');
    expect(full.fields.map((f) => f.name)).toContain('createdAt');
    expect(full.fields.length).toBeGreaterThan(lean.fields.length);
  });

  it('5. carries required and the relation kind onto the field', () => {
    const article = build().nodes.find((node) => node.uid === ARTICLE)!;

    expect(article.fields.find((f) => f.name === 'title')).toMatchObject({
      type: 'string',
      required: true,
    });
    expect(article.fields.find((f) => f.name === 'author')).toMatchObject({
      type: 'relation',
      relation: 'manyToOne',
    });
  });
});

describe('components and dynamic zones', () => {
  it('6. puts components on the diagram — the thing no other plugin in this category does', () => {
    const graph = build();

    expect(uids(graph)).toEqual(expect.arrayContaining([SEO, QUOTE, LINK]));
    expect(graph.nodes.find((node) => node.uid === SEO)?.kind).toBe('component');
  });

  it('7. joins a content type to the component it embeds', () => {
    const edges = between(build(), ARTICLE, SEO);

    expect(edges.some((edge) => edge.kind === 'component' && edge.field === 'seo')).toBe(true);
  });

  it('8. marks a repeatable component as many', () => {
    const [edge] = between(build(), AUTHOR, LINK);

    expect(edge).toMatchObject({ kind: 'component', many: true });
  });

  it('9. draws one edge per member of a dynamic zone', () => {
    const graph = build();
    const zone = graph.edges.filter((edge) => edge.kind === 'dynamiczone');

    expect(zone.map((edge) => edge.to).sort()).toEqual([SEO, QUOTE].sort());
    expect(zone.every((edge) => edge.field === 'body' && edge.many)).toBe(true);
  });

  it('10. follows a component into another component', () => {
    const edges = between(build(), SEO, LINK);

    expect(edges.some((edge) => edge.kind === 'component' && edge.field === 'canonical')).toBe(
      true
    );
  });

  it('11. drops components, and every edge into them, when switched off', () => {
    const graph = build({ includeComponents: false });

    expect(uids(graph)).not.toContain(SEO);
    // The edge would otherwise point at a box that is not on the picture.
    expect(graph.edges.some((edge) => edge.kind === 'component')).toBe(false);
    expect(graph.edges.some((edge) => edge.kind === 'dynamiczone')).toBe(false);
  });
});

describe('relations', () => {
  it('12. draws a two-sided relation once, from the owning side', () => {
    const graph = build();
    const forward = between(graph, ARTICLE, AUTHOR);
    const back = between(graph, AUTHOR, ARTICLE);

    // `author` on Article owns it (inversedBy); `articles` on Author is mappedBy.
    expect(forward).toHaveLength(1);
    expect(back).toHaveLength(0);
    expect(forward[0]).toMatchObject({ cardinality: 'manyToOne', many: false });
  });
});

describe('what a click can reach', () => {
  it('19. marks your own content types and components as openable', () => {
    const graph = build();

    expect(graph.nodes.every((node) => node.navigable)).toBe(true);
  });

  it('20. marks a plugin’s internal tables as not openable', () => {
    const graph = build({ includeForeign: true });

    // upload's folders, i18n's locales, everything under admin:: — real content
    // types, on the diagram, with no page in the Content-Type Builder to open.
    const hidden = graph.nodes.filter((node) => node.uid.startsWith('admin::'));

    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((node) => !node.navigable)).toBe(true);
    expect(graph.nodes.find((node) => node.uid === 'plugin::upload.file')?.navigable).toBe(false);
    // The user's own types are still openable with foreign types switched on.
    expect(graph.nodes.find((node) => node.uid === ARTICLE)?.navigable).toBe(true);
  });
});

describe('the fields nobody asked to see', () => {
  it('15. draws no line for a field it is not drawing', () => {
    const graph = build({ includeForeign: true });
    const loops = graph.edges.filter((edge) => edge.from === edge.to);

    // i18n adds a `localizations` relation to every content type, pointing at
    // itself. Filtering it out of the field list but not out of the edges put a
    // self-loop on every single box on the diagram.
    expect(loops.some((edge) => edge.field === 'localizations')).toBe(false);
    expect(graph.edges.some((edge) => edge.field === 'createdBy')).toBe(false);
  });

  it('16. brings those lines back when the fields are switched on', () => {
    const graph = build({ includeForeign: true, includeDefaultFields: true });

    expect(graph.edges.some((edge) => edge.field === 'localizations')).toBe(true);
  });
});

describe('exclusions', () => {
  it('17. leaves out anything excluded, and the edges that pointed at it', () => {
    const graph = build({ exclude: [SEO] });

    expect(uids(graph)).not.toContain(SEO);
    expect(graph.edges.some((edge) => edge.to === SEO)).toBe(false);
    // A dynamic zone with one member excluded keeps the other.
    expect(graph.edges.some((edge) => edge.kind === 'dynamiczone' && edge.to === QUOTE)).toBe(true);
  });

  it('18. offers everything hideable in the catalogue, including components', () => {
    const catalogue = graphService(strapi).catalogue() as Array<{ uid: string; kind: string }>;

    expect(catalogue.map((entry) => entry.uid)).toEqual(expect.arrayContaining([ARTICLE, SEO]));
    expect(catalogue.find((entry) => entry.uid === SEO)?.kind).toBe('component');
  });
});
