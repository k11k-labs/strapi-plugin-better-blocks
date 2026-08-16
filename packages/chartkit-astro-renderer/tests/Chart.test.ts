import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { describe, it, expect, beforeAll } from 'vitest';

import BlocksRenderer from '@qkix/better-blocks-astro-renderer/BlocksRenderer.astro';
import { createChartBlock } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';

import Chart from '../src/Chart.astro';
import { chartBlockPlugin } from '../src/blockPlugin';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const spec: ChartSpec = {
  version: 1,
  type: 'bar',
  title: 'Quarterly revenue',
  description: 'Revenue by quarter.',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2'],
    series: [{ name: 'Revenue', values: [10, 20] }],
  },
};

async function renderToDocument(Component: unknown, props: Record<string, unknown>) {
  const raw = await container.renderToString(Component as never, { props });
  const html = raw.replace(/ data-astro-source-(file|loc)="[^"]*"/g, '');
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { html, document };
}

describe('Chart', () => {
  it('renders the chart as inline SVG', async () => {
    const { document } = await renderToDocument(Chart, { spec, locale: 'en-US' });
    const svg = document.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(document.querySelectorAll('rect')).toHaveLength(2);
  });

  it('ships no JavaScript at all', async () => {
    // The reason this package exists. An Astro page with a chart on it should
    // download exactly as much script as an Astro page without one.
    const { html } = await renderToDocument(Chart, { spec });

    expect(html).not.toContain('<script');
    expect(html).not.toContain('astro-island');
  });

  it('renders nothing for a spec that will not draw', async () => {
    const broken = { ...spec, type: 'sunburst' } as unknown as ChartSpec;
    const { document } = await renderToDocument(Chart, { spec: broken });

    expect(document.querySelector('svg')).toBeNull();
  });
});

describe('chartBlockPlugin', () => {
  it('draws a chart block inside a Better Blocks document', async () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ];

    const { document } = await renderToDocument(BlocksRenderer, {
      content,
      blockPlugins: [chartBlockPlugin],
    });

    expect(document.querySelectorAll('p')).toHaveLength(2);
    expect(document.querySelector('svg[role="img"]')).not.toBeNull();
  });

  it('renders nothing for the chart when the plugin is not passed', async () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
    ];

    const { document } = await renderToDocument(BlocksRenderer, { content });

    expect(document.querySelector('p')?.textContent).toContain('before');
    expect(document.querySelector('svg')).toBeNull();
  });

  it('keeps the document script-free with a chart in it', async () => {
    const { html } = await renderToDocument(BlocksRenderer, {
      content: [createChartBlock(spec)],
      blockPlugins: [chartBlockPlugin],
    });

    expect(html).not.toContain('<script');
  });
});
