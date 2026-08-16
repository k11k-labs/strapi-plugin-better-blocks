import { describe, it, expect } from 'vitest';

import { CHART_SPEC_VERSION, renderChart, type ChartSpec } from '@qkix/chartkit-core';

import { readValue, starterSpec, writeValue } from '../admin/src/value';

const spec = (): ChartSpec => ({
  version: CHART_SPEC_VERSION,
  type: 'bar',
  title: 'Revenue',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2'],
    series: [{ name: 'North', values: [10, 20] }],
  },
});

describe('reading a stored field value', () => {
  it('reads a chart Strapi handed over as a JSON string', () => {
    const result = readValue(JSON.stringify(spec()));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.spec.title).toBe('Revenue');
  });

  it('reads a chart Strapi handed over already parsed', () => {
    // Both happen. Which one depends on the code path the value arrived by, so
    // a field that only handles the string case works until it does not.
    const result = readValue(spec());

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.spec.title).toBe('Revenue');
  });

  it.each([[null], [undefined], [''], ['null'], ['""']])(
    'treats %s as a field nobody has filled in',
    (value) => {
      expect(readValue(value)).toEqual({ status: 'empty' });
    }
  );

  it('brings an older spec up to the current version on the way in', () => {
    // The author is about to edit and save this. Migrating on the way out
    // instead would write back whatever version it arrived as.
    const old = {
      version: 1,
      type: 'bar',
      data: {
        source: 'inline',
        labels: ['Q1'],
        series: [{ name: 'A', values: [1] }],
      },
      options: { barMode: 'stacked' },
    };

    const result = readValue(JSON.stringify(old));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.spec.version).toBe(CHART_SPEC_VERSION);
    expect(result.spec.options?.stackMode).toBe('stacked');
    expect(result.spec.options).not.toHaveProperty('barMode');
  });

  it.each([
    ['text that is not JSON', 'not json at all {'],
    ['JSON that is not an object', '42'],
    ['an array', '[1, 2, 3]'],
    ['an object with no version marker', '{"type":"bar"}'],
    ['a version from the future', `{"version":${CHART_SPEC_VERSION + 1},"type":"bar"}`],
  ])('refuses to read %s, and says why', (_case, value) => {
    const result = readValue(value);

    // Not `empty`. Offering to create a chart over data that exists and is
    // merely unrecognised is an offer to overwrite it.
    expect(result.status).toBe('unreadable');
    if (result.status !== 'unreadable') return;
    expect(result.reason).not.toBe('');
  });

  it('never throws, whatever is in the field', () => {
    // This runs while the edit view renders. Throwing here would take down
    // every other field on the page along with this one.
    const hostile = [0, false, () => {}, Symbol('x'), new Date(), NaN, '{"a":', '[]', {}];

    for (const value of hostile) {
      expect(() => readValue(value)).not.toThrow();
    }
  });
});

describe('writing the field value', () => {
  it('round trips through a string, which is how Strapi reads json fields back', () => {
    const result = readValue(writeValue(spec()));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.spec).toEqual(spec());
  });
});

describe('the chart a new field starts from', () => {
  it('renders, so a field just added does not open on an error panel', () => {
    const result = renderChart(starterSpec());

    expect(result.ok).toBe(true);
  });

  it('has rows to type into and is the current version', () => {
    expect(starterSpec().version).toBe(CHART_SPEC_VERSION);
    expect(starterSpec().data.labels).toHaveLength(4);
    // Empty, not zero: the grid should show gaps waiting for numbers, not a
    // series of measured zeroes sitting on the baseline.
    expect(starterSpec().data.series[0].values).toEqual([null, null, null, null]);
  });
});
