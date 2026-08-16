import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { describe, it, expect, beforeAll } from 'vitest';

import BlocksRenderer from '../src/BlocksRenderer.astro';
import type { AstroBlockPlugin, ExtendedBlocksContent } from '../src/types';

import PluginChart from './fixtures/PluginChart.astro';
import PluginPanel from './fixtures/PluginPanel.astro';
import PluginBanner from './fixtures/PluginBanner.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

async function render(content: ExtendedBlocksContent, blockPlugins?: AstroBlockPlugin[]) {
  const raw = await container.renderToString(BlocksRenderer, {
    props: { content, blockPlugins },
  });
  const html = raw.replace(/ data-astro-source-(file|loc)="[^"]*"/g, '');
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { html, document };
}

const placeholder = [{ type: 'text' as const, text: '' }];

/** A stand-in for what Chartkit will register: a void block with its own spec. */
const chart: AstroBlockPlugin = { type: 'chart', content: 'void', component: PluginChart };

const chartBlock = (title: string) => ({ type: 'chart', spec: { title }, children: placeholder });

describe('registered block types', () => {
  it('renders a block this package does not ship', async () => {
    const { document } = await render([chartBlock('Revenue')] as ExtendedBlocksContent, [chart]);

    expect(document.querySelector('.plugin-chart')?.getAttribute('data-title')).toBe('Revenue');
  });

  it('renders nothing for that block when no plugin is passed', async () => {
    const { document } = await render([chartBlock('Revenue')] as ExtendedBlocksContent);

    expect(document.querySelector('.plugin-chart')).toBeNull();
    expect(document.body.textContent?.trim()).toBe('');
  });

  it('leaves the built-in blocks around it alone', async () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      chartBlock('Revenue'),
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ] as ExtendedBlocksContent;

    const { document } = await render(content, [chart]);

    expect(document.querySelectorAll('p')).toHaveLength(2);
    expect(document.querySelector('.plugin-chart')).not.toBeNull();
  });

  it('renders a registered block nested inside a callout', async () => {
    const content = [
      { type: 'callout', variant: 'info', children: [chartBlock('Nested')] },
    ] as ExtendedBlocksContent;

    const { document } = await render(content, [chart]);

    expect(document.querySelector('.bb-callout .plugin-chart')?.getAttribute('data-title')).toBe(
      'Nested'
    );
  });

  it('hands an "inline" block its rendered text, marks and all', async () => {
    const banner: AstroBlockPlugin = {
      type: 'banner',
      content: 'inline',
      component: PluginBanner,
    };

    const content = [
      {
        type: 'banner',
        children: [
          { type: 'text', text: 'plain ' },
          { type: 'text', text: 'bold', bold: true },
        ],
      },
    ] as ExtendedBlocksContent;

    const { document } = await render(content, [banner]);
    const el = document.querySelector('.plugin-banner');

    expect(el?.textContent).toContain('plain');
    expect(el?.querySelector('strong')?.textContent).toBe('bold');
  });

  it('hands a "blocks" block its rendered children, at any depth', async () => {
    const panel: AstroBlockPlugin = { type: 'panel', content: 'blocks', component: PluginPanel };

    const content = [
      {
        type: 'panel',
        label: 'outer',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'inside' }] },
          chartBlock('Deep'),
        ],
      },
    ] as ExtendedBlocksContent;

    const { document } = await render(content, [panel, chart]);
    const panelEl = document.querySelector('.plugin-panel');

    expect(panelEl?.getAttribute('data-label')).toBe('outer');
    expect(panelEl?.querySelector('p')?.textContent).toBe('inside');
    // The nesting block threads the registry down, so a registered block works
    // at any depth.
    expect(panelEl?.querySelector('.plugin-chart')?.getAttribute('data-title')).toBe('Deep');
  });
});
