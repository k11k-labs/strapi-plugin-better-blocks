/**
 * The fixture set, chosen to break things.
 *
 * A chart that looks right on tidy data tells you nothing — tidy data is the
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

const bar = (
  title: string,
  labels: string[],
  values: (number | null)[],
  options: ChartSpec['options'] = {}
): ChartSpec => ({
  version: 1,
  type: 'bar',
  title,
  data: { source: 'inline', labels, series: [{ name: 'Series 1', values }] },
  options,
});

export const fixtures: Fixture[] = [
  {
    id: 'ordinary',
    breaks: 'nothing — the control case, so a regression elsewhere is visible',
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
    breaks: 'scale degeneracy — the domain has no width, so every tick collides',
    spec: bar('Nothing yet', ['Mon', 'Tue', 'Wed', 'Thu'], [0, 0, 0, 0]),
  },
  {
    id: 'null-hole',
    breaks: 'gaps — a missing value must not be drawn as a measured zero',
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
    id: 'markup-in-labels',
    breaks: 'escaping — this is a stored XSS if any of it reaches the output raw',
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
