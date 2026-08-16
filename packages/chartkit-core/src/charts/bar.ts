/**
 * The bar chart, in its grouped and stacked arrangements.
 *
 * Vertical bars, one band per category. With several series the mode decides
 * what happens inside a band: `grouped` splits it into one bar per series,
 * `stacked` piles the series into a single bar. A single-series chart draws the
 * same either way.
 */

import { LABEL_FONT_SIZE, planCategoryLabels, truncateToWidth, type PlotArea } from '../layout';
import { bandScale, computeStackedDomain, computeValueDomain, linearScale } from '../scale';
import { element, round, tag, text } from '../svg';
import { AXIS_COLOR, GRID_COLOR, GRID_OPACITY, TEXT_COLOR, seriesColor } from '../theme';
import type { BarMode, ChartData, Series } from '../types';

export type BarRenderInput = {
  data: ChartData;
  mode: BarMode;
  plot: PlotArea;
  chartHeight: number;
  bounds: { min?: number; max?: number } | undefined;
  formatValue: (value: number) => string;
};

/**
 * Widest a single bar is allowed to get, in user units.
 *
 * Without a cap, a chart of one category gives that category the whole plot and
 * draws a bar the width of the chart — which reads as a filled panel rather
 * than a measurement, because there is no baseline width to compare it against.
 * The cap keeps a one-bar chart looking like a bar chart.
 */
const MAX_BAR_WIDTH = 72;

/**
 * The value ticks a bar chart will draw, needed before the plot area exists.
 *
 * The left margin depends on how wide the widest tick label is, and the tick
 * values depend on the domain — but not on the plot geometry. So this is
 * computed first, the layout is sized from it, and the result is handed back in
 * for the actual draw. Splitting it this way is what avoids a circular
 * dependency between "how wide is the margin" and "where do the ticks go".
 */
export function barValueTicks(
  data: ChartData,
  mode: BarMode,
  bounds: { min?: number; max?: number } | undefined
): { ticks: number[]; tickStep: number } {
  const domain = barDomain(data.series, mode, bounds);
  // The range is a placeholder: ticks depend only on the domain, and the real
  // geometry is not known yet.
  const scale = linearScale(domain, [1, 0]);

  return { ticks: scale.ticks, tickStep: scale.tickStep };
}

/**
 * The value domain, which depends on the arrangement.
 *
 * Grouped bars are measured individually, so the domain spans the values.
 * Stacked bars are measured as totals, so it spans the sums — see
 * {@link computeStackedDomain}.
 */
function barDomain(
  series: readonly Series[],
  mode: BarMode,
  bounds: { min?: number; max?: number } | undefined
) {
  return mode === 'stacked'
    ? computeStackedDomain(series, { bounds })
    : computeValueDomain(series, { includeZero: true, bounds });
}

export function renderBar(input: BarRenderInput): string {
  const { data, mode, plot, chartHeight, bounds, formatValue } = input;

  const domain = barDomain(data.series, mode, bounds);
  const y = linearScale(domain, [plot.bottom, plot.top]);
  const x = bandScale(data.labels, [plot.left, plot.right]);

  // Where zero sits. With an all-positive domain this is the plot floor; with
  // negatives in the data it floats, and bars hang from it in both directions.
  const zero = clamp(y(0), plot.top, plot.bottom);

  const bars =
    mode === 'stacked' ? renderStackedBars(data, x, y) : renderGroupedBars(data, x, y, zero);

  const parts: string[] = [];

  parts.push(renderGrid(y.ticks, y, plot));
  parts.push(renderValueAxis(y.ticks, y, plot, formatValue));
  parts.push(bars);
  parts.push(renderCategoryAxis(data.labels, x, plot, chartHeight, zero));

  return parts.filter(Boolean).join('');
}

function renderGrid(
  ticks: readonly number[],
  y: (value: number) => number,
  plot: PlotArea
): string {
  const lines = ticks
    .map((tick) =>
      tag('line', {
        x1: round(plot.left),
        x2: round(plot.right),
        y1: round(y(tick)),
        y2: round(y(tick)),
      })
    )
    .join('');

  return element(
    'g',
    {
      class: 'chartkit-grid',
      stroke: GRID_COLOR,
      'stroke-opacity': GRID_OPACITY,
      'stroke-width': 1,
      // Gridlines are decoration for a sighted reader; the numbers are already
      // in the axis labels and the accessible description.
      'aria-hidden': 'true',
    },
    lines
  );
}

function renderValueAxis(
  ticks: readonly number[],
  y: (value: number) => number,
  plot: PlotArea,
  formatValue: (value: number) => string
): string {
  const labels = ticks
    .map((tick) =>
      text(formatValue(tick), {
        x: round(plot.left - 8),
        y: round(y(tick)),
        'text-anchor': 'end',
        // Nudges the text down so its middle, not its baseline, lines up with
        // the tick. dominant-baseline is unreliable in older renderers.
        dy: '0.32em',
      })
    )
    .join('');

  return element(
    'g',
    {
      class: 'chartkit-axis chartkit-axis-value',
      fill: TEXT_COLOR,
      'font-size': LABEL_FONT_SIZE,
    },
    labels
  );
}

/**
 * Bars side by side within each category.
 *
 * The category band is subdivided once per series. With one series that is the
 * band itself, so this is also the single-series path — there is no separate
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

function renderCategoryAxis(
  labels: readonly string[],
  x: ReturnType<typeof bandScale>,
  plot: PlotArea,
  chartHeight: number,
  zero: number
): string {
  const plan = planCategoryLabels(labels, x.step, chartHeight);

  const baseline = tag('line', {
    x1: round(plot.left),
    x2: round(plot.right),
    y1: round(zero),
    y2: round(zero),
    stroke: AXIS_COLOR,
    'stroke-width': 1,
  });

  const drawn = labels
    .map((label, i) => {
      // Thinned to whatever the plan says will fit; see AxisLabelPlan.stride.
      if (i % plan.stride !== 0) return '';

      const center = x(label) + x.bandwidth / 2;
      const top = plot.bottom + LABEL_FONT_SIZE;
      const shown = truncateToWidth(label, LABEL_FONT_SIZE, plan.maxWidth);

      if (!plan.rotate) {
        return text(shown, {
          x: round(center),
          y: round(top),
          'text-anchor': 'middle',
        });
      }

      // Rotated labels are anchored at their end and pivot on the point just
      // below the band, so the text runs up-and-right away from its own tick
      // instead of sliding sideways off the one next to it.
      return text(shown, {
        x: round(center),
        y: round(plot.bottom + 4),
        'text-anchor': 'end',
        transform: `rotate(${plan.angle} ${round(center)} ${round(plot.bottom + 4)})`,
      });
    })
    .join('');

  return element(
    'g',
    {
      class: 'chartkit-axis chartkit-axis-category',
      fill: TEXT_COLOR,
      'font-size': LABEL_FONT_SIZE,
    },
    baseline + drawn
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(Math.max(value, min), max);
}
