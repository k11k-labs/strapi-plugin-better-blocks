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
    // it is worth asserting separately from the snapshots — a snapshot happily
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
    // Five categories, two of them null — so three bars, not five.
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
  // test — every one of them rendered "successfully" and looked wrong.

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

  it('rejects a chart type that has no renderer yet', () => {
    const spec = { ...fixtureById('ordinary').spec, type: 'pie' as const };
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
