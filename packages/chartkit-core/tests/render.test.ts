import { describe, it, expect } from 'vitest';

import { renderChart, validateChartSpec, migrateChartSpec, CHART_SPEC_VERSION } from '../src';
import type { ChartSpec } from '../src';
import { fixtures, fixtureById } from '../src/fixtures';

/** Renders a fixture, failing the test with its issues rather than a type error. */
const svgOf = (spec: ChartSpec): string => {
  const result = renderChart(spec, { locale: 'en-US' });
  if (!result.ok) throw new Error(`render failed: ${JSON.stringify(result.issues)}`);
  return result.svg;
};

/** The value-axis label texts, in order. */
const axisLabels = (svg: string): string[] =>
  [
    ...(/chartkit-axis-value[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? '').matchAll(
      /<text[^>]*>([^<]*)<\/text>/g
    ),
  ].map((m) => m[1].replace(/,/g, ''));

/** The first path `d` in the markup. */
const pathOf = (svg: string): string => /<path[^>]*d="([^"]*)"/.exec(svg)?.[1] ?? '';

describe('renderChart', () => {
  it.each(fixtures.map((f) => [f.id, f] as const))(
    'renders the %s fixture to stable markup',
    (_id, fixture) => {
      // The snapshot is the point: geometry has no natural assertion, and a
      // refactor that silently moves every bar two pixels is exactly what this
      // catches. Reviewing the diff is reviewing the chart.
      expect(svgOf(fixture.spec)).toMatchSnapshot();
    }
  );

  it('produces no NaN coordinates for any fixture', () => {
    // NaN in an attribute renders as nothing at all and gives no clue why, so
    // it is worth asserting separately from the snapshots - a snapshot happily
    // records NaN forever once it is baked in.
    for (const fixture of fixtures) {
      expect(svgOf(fixture.spec), fixture.id).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('escapes markup in titles, descriptions and labels', () => {
    const svg = svgOf(fixtureById('markup-in-labels').spec);

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('a &amp; b');
    // The closing </title> in the fixture's title must not be able to end the
    // real <title> element early.
    expect(svg.match(/<\/title>/g)).toHaveLength(1);
  });

  it('describes itself to a screen reader', () => {
    const svg = svgOf(fixtureById('ordinary').spec);

    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="chartkit-title chartkit-desc"');
    expect(svg).toContain('<title id="chartkit-title">Quarterly revenue</title>');
    expect(svg).toContain('Revenue by quarter');
  });

  it('scopes ids so two charts on one page cannot collide', () => {
    const spec = fixtureById('ordinary').spec;
    const first = renderChart(spec, { idPrefix: 'chart-a' });
    const second = renderChart(spec, { idPrefix: 'chart-b' });

    if (!first.ok || !second.ok) throw new Error('expected both to render');
    expect(first.svg).toContain('id="chart-a-title"');
    expect(second.svg).toContain('id="chart-b-title"');
  });

  it('draws no bar where a value is null', () => {
    // Five categories, two of them null - so three bars, not five.
    const svg = svgOf(fixtureById('null-hole').spec);
    expect(svg.match(/<rect/g)).toHaveLength(3);
  });

  it('keeps a flat zero series inside the plot instead of dividing by zero', () => {
    const svg = svgOf(fixtureById('all-zeros').spec);

    // A degenerate domain is padded to [0, 1], so the axis still has ticks.
    expect(svg).toContain('chartkit-axis-value');
    expect(svg).not.toMatch(/height="-/);
  });

  // The three below were all found by looking at the gallery, not by a failing
  // test - every one of them rendered "successfully" and looked wrong.

  it('caps how wide a single bar can get', () => {
    const svg = svgOf(fixtureById('single-point').spec);
    const width = Number(/<rect[^>]*width="([\d.]+)"/.exec(svg)?.[1]);

    // One category used to be given the whole plot, which drew a filled panel
    // rather than a bar.
    expect(width).toBeLessThanOrEqual(72);
    expect(width).toBeGreaterThan(0);
  });

  it('thins category labels rather than overlapping them', () => {
    const svg = svgOf(fixtureById('fifty-categories').spec);
    const categoryAxis = /chartkit-axis-category[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? '';
    const drawn = categoryAxis.match(/<text/g)?.length ?? 0;

    // All fifty used to be drawn on top of each other, which reads as a smear
    // and hides that there was anything to read.
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(50);
  });

  it('never writes the same axis label against two different ticks', () => {
    // Compact notation wrote 1,000,000 / 1,200,000 / 1,400,000 all as "1M", so
    // the axis appeared to stall across three gridlines.
    const svg = svgOf(fixtureById('orders-of-magnitude').spec);
    const axis = /chartkit-axis-value[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? '';
    const labels = [...axis.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

    expect(labels.length).toBeGreaterThan(2);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives each series its own color when grouped', () => {
    const svg = svgOf(fixtureById('grouped').spec);
    const fills = new Set(
      [...svg.matchAll(/fill="(var\(--chart-series-[^"]*)"/g)].map((m) => m[1])
    );

    // Three series, three distinct swatch variables - a shared one would make
    // the grouping unreadable.
    expect(fills.size).toBe(3);
    expect(svg).toContain('--chart-series-1');
    expect(svg).toContain('--chart-series-3');
  });

  it('sizes the stacked axis to the totals, not the largest single value', () => {
    const stacked = svgOf(fixtureById('stacked').spec);
    const labels = [
      ...(/chartkit-axis-value[^>]*>(.*?)<\/g>/s.exec(stacked)?.[1] ?? '').matchAll(
        /<text[^>]*>([^<]*)<\/text>/g
      ),
    ].map((m) => Number(m[1].replace(/,/g, '')));

    // Q4 totals 720 + 400 + 510 = 1630. The top tick need not reach the domain
    // max - d3 picks round numbers - but it must be far above the largest
    // single value (720), or the axis is scaled to values instead of totals and
    // two thirds of the stack is drawn off the plot.
    expect(Math.max(...labels)).toBeGreaterThan(720 * 1.5);

    // And nothing may escape the top of the viewBox.
    const tops = [...stacked.matchAll(/<rect[^>]*y="([\d.]+)"/g)].map((m) => +m[1]);
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(0);
  });

  it('stacks positive and negative segments away from the baseline separately', () => {
    const svg = svgOf(fixtureById('stacked-diverging').spec);
    const zero = Number(/chartkit-axis-category[^>]*><line[^>]*y1="([\d.]+)"/.exec(svg)?.[1]);

    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*height="([\d.]+)"/g)].map(
      (m) => ({ x: +m[1], top: +m[2], height: +m[3] })
    );

    // Every segment sits wholly on one side of the baseline. A shared running
    // offset would let a loss cancel a gain and land a segment across it.
    for (const rect of rects) {
      const straddles = rect.top < zero - 0.5 && rect.top + rect.height > zero + 0.5;
      expect(straddles, `segment at x=${rect.x} straddles the baseline`).toBe(false);
    }

    expect(rects.some((r) => r.top + r.height <= zero + 0.5)).toBe(true);
    expect(rects.some((r) => r.top >= zero - 0.5)).toBe(true);
  });

  it('leaves no gap in a stack where a series has no value', () => {
    // Q1 has Alpha 30 and Gamma 15 but no Beta, so the two segments must sit
    // flush: a hole closes up rather than leaving a floating segment.
    const svg = svgOf(fixtureById('stacked-holes').spec);
    const all = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*height="([\d.]+)"/g)].map(
      (m) => ({ x: +m[1], top: +m[2], height: +m[3] })
    );

    const leftmost = Math.min(...all.map((r) => r.x));
    const firstColumn = all.filter((r) => r.x === leftmost).sort((a, b) => b.top - a.top);

    expect(firstColumn).toHaveLength(2);
    const [lower, upper] = firstColumn;
    expect(upper.top + upper.height).toBeCloseTo(lower.top, 1);
  });

  it('draws a legend only when there is more than one series', () => {
    expect(svgOf(fixtureById('grouped').spec)).toContain('chartkit-legend');
    expect(svgOf(fixtureById('ordinary').spec)).not.toContain('chartkit-legend');
  });

  it('wraps a legend that will not fit on one row', () => {
    const svg = svgOf(fixtureById('eight-series').spec);
    const legend = /chartkit-legend[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? '';
    const rows = new Set([...legend.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => m[1]));

    // Eight long names cannot sit on one row at 640 units wide; without
    // wrapping they run off the side of the viewBox.
    expect(rows.size).toBeGreaterThan(1);
    expect(legend.match(/<rect/g)).toHaveLength(8);
  });

  it('crops a line axis to the data instead of anchoring it at zero', () => {
    const svg = svgOf(fixtureById('line').spec);
    const ticks = axisLabels(svg).map(Number);

    // Readings run 21.1–24.6. An axis from zero would squash the whole shape
    // into the top tenth of the plot; cropping is what makes a line readable.
    expect(Math.min(...ticks)).toBeGreaterThan(15);
  });

  it('anchors an area axis at zero, because its fill is measured from there', () => {
    const svg = svgOf(fixtureById('area').spec);
    const ticks = axisLabels(svg).map(Number);

    // Values run 120–310, but the fill is meaningless without the baseline.
    expect(Math.min(...ticks)).toBe(0);
  });

  it('breaks the line at a hole rather than joining across it', () => {
    const svg = svgOf(fixtureById('line-gaps').spec);
    const d = /<path[^>]*stroke-width="2"[^>]*d="([^"]*)"/.exec(svg)?.[1] ?? pathOf(svg);

    // Each break starts a new subpath, so an M after the first one is the
    // evidence the line stopped instead of inventing a reading.
    expect((d.match(/M/g) ?? []).length).toBeGreaterThan(1);
  });

  it('draws a dot for a reading with no neighbor to join to', () => {
    // Apr sits between two holes. A path through one point has no segment, so
    // without this the value is simply invisible.
    const svg = svgOf(fixtureById('line-gaps').spec);
    expect(svg).toContain('<circle');

    // And a line whose points all have neighbors needs no dots.
    expect(svgOf(fixtureById('line').spec)).not.toContain('<circle');
  });

  it('shows a single-point line, which has no segment at all', () => {
    const svg = svgOf(fixtureById('line-single-point').spec);
    expect(svg).toContain('<circle');
  });

  it('fills an area on both sides of the baseline', () => {
    const svg = svgOf(fixtureById('area-negative').spec);
    const fill = /<path d="([^"]*)"[^>]*fill-opacity=/.exec(svg)?.[1] ?? '';
    const baseline = Number(/chartkit-axis-category[^>]*><line[^>]*y1="([\d.]+)"/.exec(svg)?.[1]);

    // Values run -20 to 22, so the filled region hinges on the baseline and has
    // to carry coordinates on both sides of it. y grows downward in SVG, so
    // "above the baseline" is a smaller number.
    const ys = [...fill.matchAll(/[ML,]\s*-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));

    expect(ys.length).toBeGreaterThan(0);
    expect(ys.some((y) => y < baseline - 1)).toBe(true);
    expect(ys.some((y) => y > baseline + 1)).toBe(true);
  });

  it('gives every line its own color and a legend to name them', () => {
    const svg = svgOf(fixtureById('line-multi').spec);
    const strokes = new Set(
      [...svg.matchAll(/stroke="(var\(--chart-series-[^"]*)"/g)].map((m) => m[1])
    );

    expect(strokes.size).toBe(3);
    expect(svg).toContain('chartkit-legend');
  });

  it('marks the chart type on the root element', () => {
    expect(svgOf(fixtureById('line').spec)).toContain('class="chartkit chartkit-line"');
    expect(svgOf(fixtureById('area').spec)).toContain('class="chartkit chartkit-area"');
  });

  it('draws no axes for a pie', () => {
    const svg = svgOf(fixtureById('pie').spec);

    expect(svg).not.toContain('chartkit-axis');
    expect(svg).not.toContain('chartkit-grid');
    expect(svg).toContain('chartkit-pie');
  });

  it('names slices in the legend, since nothing else does', () => {
    const svg = svgOf(fixtureById('pie').spec);

    // One series, four categories - so the legend carries the category labels,
    // not the series name.
    expect(svg).toContain('Search');
    expect(svg).toContain('Referral');
    expect(svg).not.toContain('>Sessions<');
  });

  it('keeps slices in the author order rather than sorting by size', () => {
    // d3 sorts by value unless told not to, which would break the
    // correspondence between slice color and legend entry.
    const svg = svgOf(fixtureById('pie-slivers').spec);
    const fills = [...svg.matchAll(/<path[^>]*fill="var\(--chart-series-(\d+)/g)].map((m) =>
      Number(m[1])
    );

    expect(fills).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('cuts a hole in a donut but not in a pie', () => {
    const donut = svgOf(fixtureById('donut').spec);
    const pie = svgOf(fixtureById('pie').spec);

    // An annulus path doubles back to trace its inner edge, so it carries more
    // arc commands than a solid wedge.
    const arcsIn = (svg: string) => (svg.match(/A/g) ?? []).length;
    expect(arcsIn(donut)).toBeGreaterThan(arcsIn(pie));
  });

  it('labels slices with room and leaves slivers to the legend', () => {
    const svg = svgOf(fixtureById('pie-slivers').spec);
    const labels = [...svg.matchAll(/<text[^>]*paint-order="stroke"[^>]*>([^<]*)</g)].map(
      (m) => m[1]
    );

    // Six slices, but only the ones with room get a label - text spilling out
    // of a sliver onto its neighbors is worse than no text.
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(6);
    expect(labels.some((l) => l.endsWith('%'))).toBe(true);
  });

  it('draws nothing when there is nothing to divide up', () => {
    // A full circle of one arbitrary color would read as "all of it is A".
    const svg = svgOf(fixtureById('pie-all-zero').spec);
    expect(svg).not.toContain('<path');
  });

  it('refuses a pie of several series rather than drawing the first', () => {
    const spec = { ...fixtureById('grouped').spec, type: 'pie' as const };
    const issues = validateChartSpec(spec).issues;

    expect(issues.some((i) => i.path === 'data.series')).toBe(true);
    expect(issues[0].message).toContain('shares of a whole');
  });

  it('refuses a negative slice rather than treating it as zero', () => {
    const spec = {
      ...fixtureById('pie').spec,
      data: {
        source: 'inline' as const,
        labels: ['A', 'B'],
        series: [{ name: 'x', values: [5, -3] }],
      },
    };

    expect(validateChartSpec(spec).issues[0]?.message).toContain('cannot be negative');
  });

  it('reports why it will not render, rather than drawing something wrong', () => {
    const result = renderChart({
      version: 1,
      type: 'bar',
      data: { source: 'inline' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.path)).toContain('data.labels');
  });
});

describe('validateChartSpec', () => {
  it('accepts every fixture', () => {
    for (const fixture of fixtures) {
      expect(validateChartSpec(fixture.spec), fixture.id).toEqual({
        valid: true,
        issues: [],
      });
    }
  });

  it('rejects a chart type it does not know', () => {
    // Every type in the union now has a renderer, so this guards the other
    // direction: a spec from a newer editor must fail loudly rather than
    // rendering as a blank box.
    const spec = { ...fixtureById('ordinary').spec, type: 'sunburst' as never };
    expect(validateChartSpec(spec).issues[0]?.path).toBe('type');
  });

  it('rejects non-finite values, which would poison every coordinate', () => {
    const spec = {
      ...fixtureById('ordinary').spec,
      data: {
        source: 'inline' as const,
        labels: ['A'],
        series: [{ name: 'S', values: [Number.NaN] }],
      },
    };
    expect(validateChartSpec(spec).issues[0]?.message).toContain('finite');
  });

  it('flags a series whose length disagrees with the labels', () => {
    const spec = {
      ...fixtureById('ordinary').spec,
      data: {
        source: 'inline' as const,
        labels: ['A', 'B', 'C'],
        series: [{ name: 'S', values: [1, 2] }],
      },
    };
    expect(validateChartSpec(spec).issues[0]?.message).toContain('2 values but there are 3');
  });

  it('reports every problem at once, not just the first', () => {
    const result = validateChartSpec({
      version: 99,
      type: 'sunburst',
      data: null,
    });
    expect(result.issues.length).toBeGreaterThan(2);
  });
});

describe('migrateChartSpec', () => {
  it('leaves a current spec alone', () => {
    const spec = fixtureById('ordinary').spec;
    expect(migrateChartSpec(spec)).toEqual({ status: 'unchanged', spec });
  });

  it('refuses a spec from the future, with a reason', () => {
    const result = migrateChartSpec({
      version: CHART_SPEC_VERSION + 1,
      type: 'bar',
    });

    expect(result.status).toBe('skipped');
    if (result.status !== 'skipped') return;
    expect(result.reason).toContain('newer than this build');
  });

  it('refuses anything with no version marker', () => {
    const result = migrateChartSpec({ type: 'bar' });
    expect(result).toEqual({
      status: 'skipped',
      reason: 'chart spec has no version marker',
    });
  });
});

describe('spec version 2', () => {
  it('renames barMode to stackMode, keeping the value', () => {
    const v1 = {
      version: 1,
      type: 'bar',
      data: { source: 'inline', labels: ['A'], series: [{ name: 'S', values: [1] }] },
      options: { barMode: 'stacked', legend: false },
    };

    const result = migrateChartSpec(v1);

    expect(result.status).toBe('migrated');
    if (result.status !== 'migrated') return;
    expect(result.spec.version).toBe(2);
    expect(result.spec.options?.stackMode).toBe('stacked');
    expect((result.spec.options as Record<string, unknown>).barMode).toBeUndefined();
    // Everything else is carried across untouched.
    expect(result.spec.options?.legend).toBe(false);
  });

  it('renders a version 1 spec rather than refusing it', () => {
    // Publishing a new Chartkit must not blank every chart already stored.
    const v1 = {
      version: 1,
      type: 'bar',
      title: 'Old chart',
      data: {
        source: 'inline',
        labels: ['A', 'B'],
        series: [
          { name: 'S', values: [1, 2] },
          { name: 'T', values: [3, 4] },
        ],
      },
      options: { barMode: 'stacked' },
    };

    const result = renderChart(v1, { locale: 'en-US' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).toContain('chartkit-bar-stacked');
  });
});

describe('stacked area', () => {
  it('sizes the axis to the totals, not the tallest single band', () => {
    const svg = svgOf(fixtureById('area-stacked').spec);
    const ticks = axisLabels(svg).map(Number);

    // Friday totals 310 + 160 + 70 = 540; the tallest single value is 310.
    expect(Math.max(...ticks)).toBeGreaterThan(310 * 1.4);
  });

  it('stacks each band on the one below it', () => {
    const svg = svgOf(fixtureById('area-stacked').spec);
    const fills = [...svg.matchAll(/<path d="([^"]*)"[^>]*fill-opacity=/g)].map((m) => m[1]);

    // One filled band per series, and they cannot all share the baseline.
    expect(fills).toHaveLength(3);
    expect(new Set(fills).size).toBe(3);
  });

  it('leaves an unstacked area sitting on the baseline', () => {
    const svg = svgOf(fixtureById('area').spec);
    expect(svg).toContain('chartkit-area');
  });
});
