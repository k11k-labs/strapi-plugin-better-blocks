/**
 * The fixture set, chosen to break things.
 *
 * A chart that looks right on tidy data tells you nothing - tidy data is the
 * case that works by accident. Each fixture below targets a specific way the
 * geometry can fall apart, and the name says which. They are shared between the
 * snapshot tests and the gallery page, so what is asserted and what is looked
 * at are the same charts.
 */

import type { ChartSpec } from './types';

export type Fixture = {
  id: string;
  /** What this is meant to break. */
  breaks: string;
  spec: ChartSpec;
};

const multi = (
  title: string,
  labels: string[],
  series: { name: string; values: (number | null)[] }[],
  options: ChartSpec['options'] = {}
): ChartSpec => ({
  version: 2,
  type: 'bar',
  title,
  data: { source: 'inline', labels, series },
  options,
});

const bar = (
  title: string,
  labels: string[],
  values: (number | null)[],
  options: ChartSpec['options'] = {}
): ChartSpec => ({
  version: 2,
  type: 'bar',
  title,
  data: { source: 'inline', labels, series: [{ name: 'Series 1', values }] },
  options,
});

export const fixtures: Fixture[] = [
  {
    id: 'ordinary',
    breaks: 'nothing - the control case, so a regression elsewhere is visible',
    spec: {
      ...bar('Quarterly revenue', ['Q1', 'Q2', 'Q3', 'Q4'], [420, 610, 385, 720]),
      description: 'Revenue by quarter, rising to a peak in Q4.',
    },
  },
  {
    id: 'negative-values',
    breaks: 'the position of the zero baseline, and which way bars grow',
    spec: bar('Net change', ['Jan', 'Feb', 'Mar', 'Apr', 'May'], [12, -8, 4, -15, 9]),
  },
  {
    id: 'all-zeros',
    breaks: 'scale degeneracy - the domain has no width, so every tick collides',
    spec: bar('Nothing yet', ['Mon', 'Tue', 'Wed', 'Thu'], [0, 0, 0, 0]),
  },
  {
    id: 'null-hole',
    breaks: 'gaps - a missing value must not be drawn as a measured zero',
    spec: bar('With a gap', ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], [30, null, 45, null, 20]),
  },
  {
    id: 'single-point',
    breaks: 'a domain with no extent, and a band scale of one',
    spec: bar('One reading', ['Only'], [42]),
  },
  {
    id: 'fifty-categories',
    breaks: 'x-axis label collision, and bands narrower than their own gap',
    spec: bar(
      'Fifty buckets',
      Array.from({ length: 50 }, (_, i) => `Item ${i + 1}`),
      Array.from({ length: 50 }, (_, i) => Math.round(50 + 40 * Math.sin(i / 3)))
    ),
  },
  {
    id: 'long-labels',
    breaks: 'truncation and the left margin',
    spec: bar(
      'Long category names',
      [
        'Extraordinarily long category name one',
        'Extraordinarily long category name two',
        'Extraordinarily long category name three',
        'Extraordinarily long category name four',
      ],
      [18, 26, 11, 31]
    ),
  },
  {
    id: 'orders-of-magnitude',
    breaks: 'tick selection and notation when values span several magnitudes',
    spec: bar(
      'Wildly different sizes',
      ['Tiny', 'Small', 'Big', 'Huge'],
      [3, 240, 18500, 1420000],
      {
        valueFormat: { notation: 'compact' },
      }
    ),
  },
  {
    id: 'empty',
    breaks: 'everything that assumes there is at least one value',
    spec: bar('No data at all', [], []),
  },
  {
    id: 'explicit-bounds',
    breaks: 'the zero baseline when the author overrides the axis',
    spec: bar('Cropped axis', ['A', 'B', 'C'], [96, 98, 97], {
      yAxis: { min: 95, max: 100 },
    }),
  },
  {
    id: 'grouped',
    breaks: 'sharing a band between series, and the legend',
    spec: multi(
      'Grouped: revenue by region',
      ['Q1', 'Q2', 'Q3', 'Q4'],
      [
        { name: 'North', values: [420, 610, 385, 720] },
        { name: 'South', values: [310, 480, 520, 400] },
        { name: 'East', values: [180, 220, 300, 510] },
      ],
      { stackMode: 'grouped' }
    ),
  },
  {
    id: 'stacked',
    breaks: 'the axis covering totals rather than values, and segment offsets',
    spec: multi(
      'Stacked: revenue by region',
      ['Q1', 'Q2', 'Q3', 'Q4'],
      [
        { name: 'North', values: [420, 610, 385, 720] },
        { name: 'South', values: [310, 480, 520, 400] },
        { name: 'East', values: [180, 220, 300, 510] },
      ],
      { stackMode: 'stacked' }
    ),
  },
  {
    id: 'stacked-diverging',
    breaks: 'positive and negative stacking away from the baseline separately',
    spec: multi(
      'Stacked with losses',
      ['Jan', 'Feb', 'Mar', 'Apr'],
      [
        { name: 'Gains', values: [40, 25, 60, 15] },
        { name: 'More gains', values: [20, 35, 10, 45] },
        { name: 'Losses', values: [-30, -55, -12, -40] },
        { name: 'More losses', values: [-15, -10, -35, -20] },
      ],
      { stackMode: 'stacked' }
    ),
  },
  {
    id: 'stacked-holes',
    breaks: 'a stack where some series are missing a value',
    spec: multi(
      'Stacked with gaps',
      ['Q1', 'Q2', 'Q3', 'Q4'],
      [
        { name: 'Alpha', values: [30, null, 45, 20] },
        { name: 'Beta', values: [null, 40, 25, null] },
        { name: 'Gamma', values: [15, 20, null, 35] },
      ],
      { stackMode: 'stacked' }
    ),
  },
  {
    id: 'eight-series',
    breaks: 'palette exhaustion and legend wrapping',
    spec: multi(
      'Eight series at once',
      ['Q1', 'Q2', 'Q3'],
      Array.from({ length: 8 }, (_, i) => ({
        name: `Series number ${i + 1}`,
        values: [20 + i * 6, 45 - i * 3, 30 + ((i * 7) % 25)],
      })),
      { stackMode: 'grouped' }
    ),
  },
  {
    id: 'line',
    breaks: 'a domain cropped to the data instead of anchored at zero',
    spec: {
      version: 2,
      type: 'line',
      title: 'Line: server temperature',
      description: 'Temperature readings through the day, peaking at midday.',
      data: {
        source: 'inline',
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        series: [{ name: 'Rack A', values: [21.4, 21.1, 22.8, 24.6, 23.9, 22.2] }],
      },
    },
  },
  {
    id: 'line-gaps',
    breaks: 'holes - the line must break, and a lone reading must still show',
    spec: {
      version: 2,
      type: 'line',
      title: 'Line with gaps and a lone reading',
      data: {
        source: 'inline',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        // Apr is isolated: both neighbors are holes, so a path through it draws
        // no segment at all and the value would vanish.
        series: [{ name: 'Readings', values: [12, 18, null, 26, null, 9, 14] }],
      },
    },
  },
  {
    id: 'line-multi',
    breaks: 'several lines sharing a plot, and the legend above them',
    spec: {
      version: 2,
      type: 'line',
      title: 'Three lines',
      data: {
        source: 'inline',
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'North', values: [420, 610, 385, 720] },
          { name: 'South', values: [310, 480, 520, 400] },
          { name: 'East', values: [180, 220, 300, 510] },
        ],
      },
    },
  },
  {
    id: 'area',
    breaks: 'a fill measured from the baseline, so zero must be in the domain',
    spec: {
      version: 2,
      type: 'area',
      title: 'Area: signups',
      data: {
        source: 'inline',
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        series: [{ name: 'Signups', values: [120, 180, 150, 260, 310] }],
      },
    },
  },
  {
    id: 'area-negative',
    breaks: 'a fill that has to hang below the baseline as well as sit on it',
    spec: {
      version: 2,
      type: 'area',
      title: 'Area crossing zero',
      data: {
        source: 'inline',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [{ name: 'Net', values: [18, 6, -12, -20, 4, 22] }],
      },
    },
  },
  {
    id: 'line-single-point',
    breaks: 'a line with nothing to join to',
    spec: {
      version: 2,
      type: 'line',
      title: 'One reading only',
      data: { source: 'inline', labels: ['Only'], series: [{ name: 'Reading', values: [42] }] },
    },
  },
  {
    id: 'area-stacked',
    breaks: 'bands sitting on each other, and an axis covering the totals',
    spec: {
      version: 2,
      type: 'area',
      title: 'Stacked area: traffic',
      description: 'Search, direct and social traffic, stacked to show the total.',
      data: {
        source: 'inline',
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        series: [
          { name: 'Search', values: [120, 180, 150, 260, 310] },
          { name: 'Direct', values: [80, 90, 140, 120, 160] },
          { name: 'Social', values: [40, 60, 30, 90, 70] },
        ],
      },
      options: { stackMode: 'stacked' },
    },
  },
  {
    id: 'area-stacked-holes',
    breaks: 'a gap low in the stack - the bands above it drop, because the total really did',
    spec: {
      version: 2,
      type: 'area',
      title: 'Stacked area with a gap',
      data: {
        source: 'inline',
        labels: ['Mon', 'Tue', 'Wed', 'Thu'],
        series: [
          { name: 'Alpha', values: [40, null, 60, 30] },
          { name: 'Beta', values: [20, 35, 25, 45] },
        ],
      },
      options: { stackMode: 'stacked' },
    },
  },
  {
    id: 'pie',
    breaks: 'a chart with no axes at all, and a legend naming slices not series',
    spec: {
      version: 2,
      type: 'pie',
      title: 'Traffic by source',
      description: 'Search 45%, direct 25%, social 18%, referral 12%.',
      data: {
        source: 'inline',
        labels: ['Search', 'Direct', 'Social', 'Referral'],
        series: [{ name: 'Sessions', values: [4500, 2500, 1800, 1200] }],
      },
    },
  },
  {
    id: 'donut',
    breaks: 'the same, with the middle removed',
    spec: {
      version: 2,
      type: 'donut',
      title: 'Storage used',
      data: {
        source: 'inline',
        labels: ['Images', 'Video', 'Documents', 'Other'],
        series: [{ name: 'GB', values: [120, 340, 45, 25] }],
      },
    },
  },
  {
    id: 'pie-slivers',
    breaks: 'slices too thin to label, and a legend that must still name them',
    spec: {
      version: 2,
      type: 'pie',
      title: 'One dominant slice',
      data: {
        source: 'inline',
        labels: ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Other'],
        series: [{ name: 'Share', values: [880, 60, 30, 18, 7, 5] }],
      },
    },
  },
  {
    id: 'pie-single-slice',
    breaks: 'a whole made of one thing',
    spec: {
      version: 2,
      type: 'pie',
      title: 'All of it',
      data: { source: 'inline', labels: ['Everything'], series: [{ name: 'All', values: [100] }] },
    },
  },
  {
    id: 'pie-all-zero',
    breaks: 'nothing to divide up - a full circle here would be a lie',
    spec: {
      version: 2,
      type: 'pie',
      title: 'Nothing recorded yet',
      data: {
        source: 'inline',
        labels: ['A', 'B', 'C'],
        series: [{ name: 'Counts', values: [0, 0, 0] }],
      },
    },
  },
  {
    id: 'markup-in-labels',
    breaks: 'escaping - this is a stored XSS if any of it reaches the output raw',
    spec: {
      ...bar('</title><script>alert(1)</script>', ['<b>bold</b>', 'a & b', '"quoted"'], [5, 9, 3]),
      description: 'Labels containing markup, which must arrive as text.',
    },
  },
];

export const fixtureById = (id: string): Fixture => {
  const found = fixtures.find((fixture) => fixture.id === id);
  if (!found) throw new Error(`No fixture "${id}"`);
  return found;
};
