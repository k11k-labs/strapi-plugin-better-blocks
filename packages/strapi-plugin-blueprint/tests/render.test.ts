import { describe, expect, it } from 'vitest';

import { layout } from '../server/src/services/layout';
import { escapeXml, render } from '../server/src/services/svg';
import type { Graph } from '../server/src/types';

/** No Strapi here on purpose: layout and drawing are pure functions of a graph. */
const node = (
  uid: string,
  label: string,
  kind: Graph['nodes'][number]['kind'] = 'collectionType'
) => ({
  uid,
  kind,
  label,
  group: 'api',
  foreign: false,
  navigable: true,
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'body', type: 'text' },
  ],
});

const sample: Graph = {
  nodes: [
    node('api::article.article', 'Article'),
    node('api::author.author', 'Author'),
    node('shared.seo', 'Seo', 'component'),
  ],
  edges: [
    {
      from: 'api::article.article',
      to: 'api::author.author',
      kind: 'relation',
      field: 'author',
      cardinality: 'manyToOne',
    },
    { from: 'api::article.article', to: 'shared.seo', kind: 'component', field: 'seo' },
    {
      from: 'api::article.article',
      to: 'shared.seo',
      kind: 'dynamiczone',
      field: 'body',
      many: true,
    },
  ],
};

describe('layout', () => {
  it('15. gives every box a position and a size, and the sheet an extent', () => {
    const placed = layout(sample);

    expect(placed.nodes).toHaveLength(3);
    expect(placed.nodes.every((n) => n.width > 0 && n.height > 0)).toBe(true);
    expect(placed.width).toBeGreaterThan(0);
    expect(placed.height).toBeGreaterThan(0);
  });

  it('16. keeps both lines when two edges join the same pair', () => {
    // A dynamic zone whose member is also an ordinary component field: without
    // a multigraph, dagre keeps one of the two and a line silently vanishes.
    const placed = layout(sample);
    const doubled = placed.edges.filter(
      (edge) => edge.from === 'api::article.article' && edge.to === 'shared.seo'
    );

    expect(doubled).toHaveLength(2);
    expect(doubled.every((edge) => edge.points.length >= 2)).toBe(true);
  });

  it('17. lays out horizontally when asked, and it is not the same picture', () => {
    const down = layout(sample, 'TB');
    const across = layout(sample, 'LR');

    // Compared against each other rather than against an aspect ratio: boxes are
    // wide and short, so a handful of them stacked vertically is still a wide
    // sheet. What must hold is that the direction moved the extent the right way.
    expect(across.width).toBeGreaterThan(down.width);
    expect(down.height).toBeGreaterThan(across.height);
  });

  it('18. does not overlap boxes', () => {
    const { nodes } = layout(sample);

    for (const a of nodes) {
      for (const b of nodes) {
        if (a.uid === b.uid) continue;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.uid} overlaps ${b.uid}`).toBe(true);
      }
    }
  });
});

describe('drawing', () => {
  it('19. produces a standalone document, with no external references', () => {
    const svg = render(layout(sample));

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    // Anything fetched would be dropped by an <img> tag and by most viewers.
    expect(svg).not.toMatch(/<(image|script)\b/);
    expect(svg).not.toMatch(/url\(["']?https?:/);
  });

  it('20. draws one group per box, carrying the uid the panel clicks on', () => {
    const svg = render(layout(sample));

    for (const item of sample.nodes) {
      expect(svg).toContain(`data-uid="${item.uid}"`);
    }
  });

  it('21b. marks a box that has nowhere to open as not navigable', () => {
    const internal: Graph = {
      nodes: [{ ...node('plugin::upload.file', 'File'), navigable: false }],
      edges: [],
    };

    expect(render(layout(internal))).toContain('data-navigable="false"');
    expect(render(layout(sample))).toContain('data-navigable="true"');
  });

  it('21. distinguishes the three kinds of line', () => {
    const svg = render(layout(sample));

    expect(svg).toContain('bp-edge-relation');
    expect(svg).toContain('bp-edge-component');
    expect(svg).toContain('bp-edge-dynamiczone');
  });

  it('22. escapes everything it writes', () => {
    const nasty: Graph = {
      nodes: [
        {
          ...node('api::x.x', '</text><script>alert(1)</script>'),
          fields: [{ name: '"><script>', type: 'a & b' }],
        },
      ],
      edges: [],
    };

    const svg = render(layout(nasty));

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
  });

  it('23. escapes the five characters that matter and leaves text alone', () => {
    expect(escapeXml('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f');
    expect(escapeXml('Article')).toBe('Article');
  });

  it('24. survives a graph with nothing in it', () => {
    const svg = render(layout({ nodes: [], edges: [] }));

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
