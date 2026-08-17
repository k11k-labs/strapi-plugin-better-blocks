/**
 * The bar chart, in its grouped and stacked arrangements.
 *
 * Vertical bars, one band per category. With several series the mode decides
 * what happens inside a band: `grouped` splits it into one bar per series,
 * `stacked` piles the series into a single bar. A single-series chart draws the
 * same either way.
 */

import { bandScale, computeStackedDomain, computeValueDomain, type Domain } from '../scale';
import { element, round, tag } from '../svg';
import { seriesColor } from '../theme';
import type { AxisBounds, StackMode, ChartData, Series } from '../types';

export type BarRenderInput = {
  data: ChartData;
  mode: StackMode;
  x: ReturnType<typeof bandScale>;
  y: (value: number) => number;
  /** Where the baseline sits, in SVG coordinates. */
  zero: number;
};

/**
 * Widest a single bar is allowed to get, in user units.
 *
 * Without a cap, a chart of one category gives that category the whole plot and
 * draws a bar the width of the chart - which reads as a filled panel rather
 * than a measurement, because there is no baseline width to compare it against.
 * The cap keeps a one-bar chart looking like a bar chart.
 */
const MAX_BAR_WIDTH = 72;

/**
 * The value domain, which depends on the arrangement.
 *
 * Grouped bars are measured individually, so the domain spans the values.
 * Stacked bars are measured as totals, so it spans the sums - see
 * {@link computeStackedDomain}. Either way zero is included: a bar encodes
 * magnitude by length from the baseline, so an axis starting at 90 makes a 2%
 * difference look like a tenfold one.
 */
export function barDomain(
  series: readonly Series[],
  mode: StackMode,
  bounds: AxisBounds | undefined
): Domain {
  return mode === 'stacked'
    ? computeStackedDomain(series, { bounds })
    : computeValueDomain(series, { includeZero: true, bounds });
}

/** The bars themselves. Axes and legend are drawn by the caller. */
export function renderBar(input: BarRenderInput): string {
  const { data, mode, x, y, zero } = input;

  return mode === 'stacked' ? renderStackedBars(data, x, y) : renderGroupedBars(data, x, y, zero);
}

/**
 * Bars side by side within each category.
 *
 * The category band is subdivided once per series. With one series that is the
 * band itself, so this is also the single-series path - there is no separate
 * case for it, and therefore no way for the two to drift apart.
 */
function renderGroupedBars(
  data: ChartData,
  x: ReturnType<typeof bandScale>,
  y: (value: number) => number,
  zero: number
): string {
  const series = data.series;
  if (series.length === 0) return '';

  // Room for one bar, capped so a chart of one category and one series draws a
  // bar rather than a filled panel. The cap is per bar, so a grouped chart of
  // four series may still be four times as wide.
  const slot = x.bandwidth / series.length;
  const barWidth = Math.min(slot, MAX_BAR_WIDTH);
  // Center the whole group when the cap has narrowed it, so the bars stay over
  // their own category label.
  const groupInset = (x.bandwidth - barWidth * series.length) / 2;

  const groups = series
    .map((one, seriesIndex) => {
      const bars = data.labels
        .map((label, i) => {
          const value = one.values[i];
          // A hole is not a zero-height bar: drawing one would put a mark on
          // the baseline that reads as a measured zero.
          if (typeof value !== 'number' || !Number.isFinite(value)) return '';

          const top = y(value);

          return tag('rect', {
            x: round(x(label) + groupInset + seriesIndex * barWidth),
            // A negative value draws downward from the baseline, so the rect's
            // origin is the baseline rather than the value.
            y: round(Math.min(top, zero)),
            width: round(barWidth),
            height: round(Math.abs(top - zero)),
            fill: seriesColor(seriesIndex),
          });
        })
        .join('');

      return bars;
    })
    .join('');

  return element('g', { class: 'chartkit-series', 'aria-hidden': 'true' }, groups);
}

/**
 * Series piled into one bar per category.
 *
 * Positive and negative values stack away from the baseline in opposite
 * directions, each keeping its own running offset. Letting them share one would
 * make a −50 sit on top of a +50 and hide it, rather than hanging below the
 * axis where it belongs.
 *
 * Segments are emitted per category rather than per series, because a stack is
 * built by walking the series in order for one category at a time.
 */
function renderStackedBars(
  data: ChartData,
  x: ReturnType<typeof bandScale>,
  y: (value: number) => number
): string {
  const series = data.series;
  if (series.length === 0) return '';

  const barWidth = Math.min(x.bandwidth, MAX_BAR_WIDTH);
  const inset = (x.bandwidth - barWidth) / 2;

  const stacks = data.labels
    .map((label, i) => {
      let positiveTop = 0;
      let negativeBottom = 0;

      const segments = series
        .map((one, seriesIndex) => {
          const value = one.values[i];
          if (typeof value !== 'number' || !Number.isFinite(value)) return '';
          // A zero contributes nothing and would draw a zero-height rect, which
          // is invisible but still markup.
          if (value === 0) return '';

          const isPositive = value >= 0;
          const from = isPositive ? positiveTop : negativeBottom;
          const to = from + value;

          if (isPositive) positiveTop = to;
          else negativeBottom = to;

          const top = y(Math.max(from, to));
          const bottom = y(Math.min(from, to));

          return tag('rect', {
            x: round(x(label) + inset),
            y: round(top),
            width: round(barWidth),
            height: round(Math.abs(bottom - top)),
            fill: seriesColor(seriesIndex),
          });
        })
        .join('');

      return segments;
    })
    .join('');

  // No baseline argument needed: a stack accumulates in data space from 0, and
  // the scale puts it where the baseline already is.
  return element('g', { class: 'chartkit-series', 'aria-hidden': 'true' }, stacks);
}
