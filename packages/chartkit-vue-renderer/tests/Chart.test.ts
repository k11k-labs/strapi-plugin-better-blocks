import { BlocksRenderer } from '@qkix/better-blocks-vue-renderer';
import { createChartBlock } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';
import { mount } from '@vue/test-utils';
import { createSSRApp, h, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';

import Chart from '../src/Chart.vue';
import { chartBlockPlugin } from '../src/blockPlugin';

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

/** The server-rendered HTML, which is what a Nuxt page actually ships. */
function renderSSR(component: Component, props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(component, props) }));
}

describe('Chart', () => {
  it('renders the chart as inline SVG', () => {
    const wrapper = mount(Chart, { props: { spec, locale: 'en-US' } });
    const svg = wrapper.find('svg');

    expect(svg.exists()).toBe(true);
    expect(svg.attributes('role')).toBe('img');
    expect(wrapper.findAll('rect')).toHaveLength(2);
  });

  it('ships no JavaScript at all', async () => {
    // The reason this package exists. A page with a chart on it should download
    // exactly as much chart library as a page without one: none.
    const html = await renderSSR(Chart, { spec });

    expect(html).toContain('<svg');
    expect(html).not.toContain('<script');
  });

  it('renders nothing for a spec that will not draw', () => {
    const broken = { ...spec, type: 'sunburst' } as unknown as ChartSpec;
    const wrapper = mount(Chart, { props: { spec: broken } });

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('puts consumer attributes on the wrapper', () => {
    const wrapper = mount(Chart, { props: { spec }, attrs: { class: 'my-chart' } });

    expect(wrapper.find('div.my-chart svg').exists()).toBe(true);
  });
});

describe('chartBlockPlugin', () => {
  it('draws a chart block inside a Better Blocks document', () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ];

    const wrapper = mount(BlocksRenderer, {
      props: { content, blockPlugins: [chartBlockPlugin] },
    });

    expect(wrapper.findAll('p')).toHaveLength(2);
    expect(wrapper.find('svg[role="img"]').exists()).toBe(true);
  });

  it('renders nothing for the chart when the plugin is not passed', () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      createChartBlock(spec),
    ];

    const wrapper = mount(BlocksRenderer, { props: { content } });

    expect(wrapper.find('p').text()).toContain('before');
    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('gives two charts in one document different accessible-name ids', async () => {
    const second: ChartSpec = { ...spec, title: 'Headcount' };
    const html = await renderSSR(BlocksRenderer, {
      content: [createChartBlock(spec), createChartBlock(second)],
      blockPlugins: [chartBlockPlugin],
    });

    expect(html).toContain('chartkit-quarterly-revenue');
    expect(html).toContain('chartkit-headcount');
  });
});
