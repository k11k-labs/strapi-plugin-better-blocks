import { describe, it, expect } from 'vitest';

import type { ChartSpec } from '@qkix/chartkit-core';

import {
  addRow,
  addSeries,
  hasAnyValue,
  normalizeShape,
  removeRow,
  removeSeries,
  replaceData,
  setCell,
  setLabel,
  setSeriesName,
  setType,
  typeChangeDiscardsSeries,
} from '../src/edit';
import { parseDelimited, toNumber } from '../src/csv';

const spec = (): ChartSpec => ({
  version: 2,
  type: 'bar',
  title: 'Revenue',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2'],
    series: [
      { name: 'North', values: [10, 20] },
      { name: 'South', values: [30, 40] },
    ],
  },
});

describe('edits', () => {
  it('never mutates the spec it was given', () => {
    // Strapi decides a document is dirty by comparing references, so an
    // in-place edit shows changes the save button does not know about.
    const before = spec();
    const snapshot = JSON.stringify(before);

    setCell(before, 0, 0, 99);
    addRow(before);
    removeSeries(before, 0);
    setType(before, 'pie');

    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('keeps every series the same length as the labels', () => {
    const ragged: ChartSpec = {
      ...spec(),
      data: {
        source: 'inline',
        labels: ['Q1', 'Q2', 'Q3'],
        series: [
          { name: 'A', values: [1] },
          { name: 'B', values: [1, 2, 3, 4, 5] },
        ],
      },
    };

    const fixed = normalizeShape(ragged);

    expect(fixed.data.series[0].values).toEqual([1, null, null]);
    expect(fixed.data.series[1].values).toEqual([1, 2, 3]);
  });

  it('pads with null rather than zero', () => {
    // A category with no reading has no reading. A zero would be a measurement.
    const widened = addRow(spec());
    expect(widened.data.series[0].values).toEqual([10, 20, null]);
  });

  it('removes a category from every series at once', () => {
    const narrowed = removeRow(spec(), 0);

    expect(narrowed.data.labels).toEqual(['Q2']);
    expect(narrowed.data.series.map((s) => s.values)).toEqual([[20], [40]]);
  });

  it('adds a series sized to the categories', () => {
    const wider = addSeries(spec());

    expect(wider.data.series).toHaveLength(3);
    expect(wider.data.series[2]).toEqual({ name: 'Series 3', values: [null, null] });
  });

  it('refuses to remove the last series', () => {
    // A chart with no series has nothing to draw, and an editor that reaches
    // that state has to explain the way out of it.
    const one: ChartSpec = {
      ...spec(),
      data: { source: 'inline', labels: ['Q1'], series: [{ name: 'Only', values: [1] }] },
    };

    expect(removeSeries(one, 0)).toBe(one);
  });

  it('does not reuse a name that is already taken', () => {
    const taken: ChartSpec = {
      ...spec(),
      data: { ...spec().data, series: [{ name: 'Series 2', values: [1, 2] }] },
    };

    expect(addSeries(taken).data.series[1].name).toBe('Series 3');
  });

  it('drops the extra series when switching to a pie, and says so first', () => {
    // The core refuses a pie of several series, so this would otherwise save
    // something that cannot render.
    expect(typeChangeDiscardsSeries(spec(), 'pie')).toBe(true);
    expect(typeChangeDiscardsSeries(spec(), 'line')).toBe(false);

    const pie = setType(spec(), 'pie');
    expect(pie.data.series).toHaveLength(1);
    expect(pie.data.series[0].name).toBe('North');
  });

  it('keeps every series when switching between cartesian types', () => {
    expect(setType(spec(), 'line').data.series).toHaveLength(2);
  });

  it('edits labels, names and cells in place by index', () => {
    let next = setLabel(spec(), 1, 'Second quarter');
    next = setSeriesName(next, 1, 'Southern');
    next = setCell(next, 1, 0, null);

    expect(next.data.labels).toEqual(['Q1', 'Second quarter']);
    expect(next.data.series[1].name).toBe('Southern');
    expect(next.data.series[1].values).toEqual([null, 40]);
  });

  it('knows whether there is anything worth drawing', () => {
    // A spec with categories but no readings renders an empty frame rather than
    // failing, so the preview needs to ask this before drawing one.
    expect(hasAnyValue(spec())).toBe(true);

    const blank: ChartSpec = {
      ...spec(),
      data: {
        source: 'inline',
        labels: ['Q1', 'Q2'],
        series: [{ name: 'North', values: [null, null] }],
      },
    };

    expect(hasAnyValue(blank)).toBe(false);
    // One number anywhere is enough — a chart of a single reading is a chart.
    expect(hasAnyValue(setCell(blank, 0, 1, 0))).toBe(true);
  });

  it('keeps the chart settings when the data is replaced wholesale', () => {
    const next = replaceData(spec(), ['A'], [{ name: 'X', values: [1] }]);

    expect(next.title).toBe('Revenue');
    expect(next.type).toBe('bar');
    expect(next.data.labels).toEqual(['A']);
  });
});

describe('pasting a spreadsheet', () => {
  it('reads a tab-separated paste with a header row', () => {
    // What copying a range out of Excel or Sheets actually produces.
    const result = parseDelimited('\tRevenue\tCosts\nQ1\t420\t310\nQ2\t610\t480');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.labels).toEqual(['Q1', 'Q2']);
    expect(result.table.series).toEqual([
      { name: 'Revenue', values: [420, 610] },
      { name: 'Costs', values: [310, 480] },
    ]);
  });

  it('numbers the series when there is no header', () => {
    const result = parseDelimited('Q1,420,310\nQ2,610,480');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.series.map((s) => s.name)).toEqual(['Series 1', 'Series 2']);
    expect(result.table.notes.join(' ')).toContain('No header row');
  });

  it('prefers semicolons to commas, so a European file is not shredded', () => {
    // 1.234,5 is one number. Splitting on the comma would make it two.
    const result = parseDelimited('Region;Revenue\nNorth;1.234,5\nSouth;987,25');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.series[0].values).toEqual([1234.5, 987.25]);
  });

  it('keeps a quoted delimiter inside its cell', () => {
    const result = parseDelimited('Region,Revenue\n"North, inland",420');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.labels).toEqual(['North, inland']);
    expect(result.table.series[0].values).toEqual([420]);
  });

  it('turns an unreadable cell into a gap and mentions it', () => {
    const result = parseDelimited('Region,Revenue\nNorth,420\nSouth,n/a');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.table.series[0].values).toEqual([420, null]);
    expect(result.table.notes.join(' ')).toContain('became gaps');
  });

  it('explains itself when the paste cannot be a chart', () => {
    expect(parseDelimited('   ')).toEqual({ ok: false, reason: 'Nothing to paste.' });

    const single = parseDelimited('just\none\ncolumn');
    expect(single.ok).toBe(false);
    if (single.ok) return;
    expect(single.reason).toContain('two columns');
  });
});

describe('reading a number out of a cell', () => {
  it.each([
    ['420', 420],
    ['1,234', 1234],
    ['1,234,567', 1234567],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['1,5', 1.5],
    ['€1 234,50', 1234.5],
    ['-42', -42],
    ['3.2e3', 3200],
    ['', null],
    ['n/a', null],
    ['—', null],
  ])('reads %s as %s', (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});
