import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlocksRenderer } from '@qkix/better-blocks-react-renderer';
import type { ExtendedBlocksContent } from '@qkix/better-blocks-react-renderer';
import { createChartBlock } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';

import { Chart, chartBlockPlugin } from '../src';

const spec: ChartSpec = {
  version: 2,
  type: 'bar',
  title: 'Quarterly revenue',
  description: 'Revenue by quarter.',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2'],
    series: [{ name: 'Revenue', values: [10, 20] }],
  },
};

describe('Chart', () => {
  it('renders the chart as inline SVG', () => {
    const { container } = render(<Chart spec={spec} locale="en-US" />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });

  it('ships no script and needs no hydration', () => {
    // The whole premise: a chart costs a page nothing at runtime.
    const { container } = render(<Chart spec={spec} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('onclick');
  });

  it('renders nothing for a spec that will not draw', () => {
    const broken = { ...spec, type: 'sunburst' } as unknown as ChartSpec;
    const { container } = render(<Chart spec={broken} />);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('hands the reasons to a fallback when one is given', () => {
    const broken = { ...spec, type: 'sunburst' } as unknown as ChartSpec;

    render(<Chart spec={broken} fallback={(issues) => <p>{issues[0].message}</p>} />);

    expect(screen.getByText(/chart type/i)).toBeInTheDocument();
  });

  it('scopes accessible-name ids so two charts cannot collide', () => {
    const { container } = render(
      <>
        <Chart spec={spec} idPrefix="a" />
        <Chart spec={{ ...spec, title: 'Other' }} idPrefix="b" />
      </>
    );

    expect(container.querySelector('#a-title')).not.toBeNull();
    expect(container.querySelector('#b-title')).not.toBeNull();
  });
});

describe('chartBlockPlugin', () => {
  it('draws a chart block inside a Better Blocks document', () => {
    // The end-to-end path: a chart node stored in a document, rendered by
    // Better Blocks through the registration API, drawn by Chartkit.
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ] as ExtendedBlocksContent;

    const { container } = render(
      <BlocksRenderer content={content} blockPlugins={[chartBlockPlugin({ locale: 'en-US' })]} />
    );

    expect(screen.getByText('before')).toBeInTheDocument();
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    expect(screen.getByText('after')).toBeInTheDocument();
  });

  it('renders nothing for the chart when the plugin is not passed', () => {
    // Unregistered content is not lost, it simply is not drawn - the rest of
    // the document still renders.
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
    ] as ExtendedBlocksContent;

    const { container } = render(<BlocksRenderer content={content} />);

    expect(screen.getByText('before')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('carries the core validator, so a broken chart is reported in document terms', () => {
    const plugin = chartBlockPlugin();
    const issues: { path: string; message: string }[] = [];

    plugin.validate?.({ type: 'chart', spec: { version: 2, type: 'bar' } } as never, {
      path: '[3]',
      fail: (path, message) => issues.push({ path, message }),
    });

    // Re-rooted at the node's position: an editor showing `data.labels` alone
    // would not say which chart is broken.
    expect(issues[0].path).toBe('[3].spec.data');
  });

  it('delegates migration to the spec, keeping the node around it', () => {
    const plugin = chartBlockPlugin();
    const outcome = plugin.migrate?.({ type: 'chart', spec: { version: 99 } } as never);

    expect(outcome?.status).toBe('skipped');
  });

  it('upgrades a version 1 spec through the block migrator', () => {
    // The path Better Blocks actually walks: it hands each chart node to this
    // package and never learns what a spec is.
    const plugin = chartBlockPlugin();
    const outcome = plugin.migrate?.({
      type: 'chart',
      spec: { version: 1, type: 'bar', options: { barMode: 'stacked' } },
    } as never);

    expect(outcome?.status).toBe('migrated');
    if (outcome?.status !== 'migrated') return;
    const spec = (outcome.node as { spec: { version: number; options: Record<string, unknown> } })
      .spec;
    expect(spec.version).toBe(2);
    expect(spec.options.stackMode).toBe('stacked');
  });
});
