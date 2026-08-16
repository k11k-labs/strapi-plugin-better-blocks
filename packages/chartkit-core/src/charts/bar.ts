/**
 * The bar chart.
 *
 * Vertical bars, one band per category. Grouped and stacked variants come
 * later; this draws the first series and is the shape everything else in the
 * package was built to support.
 */

import { LABEL_FONT_SIZE, planCategoryLabels, truncateToWidth, type PlotArea } from '../layout';
import { bandScale, computeValueDomain, linearScale } from '../scale';
import { element, round, tag, text } from '../svg';
import { AXIS_COLOR, GRID_COLOR, GRID_OPACITY, TEXT_COLOR, seriesColor } from '../theme';
import type { ChartData } from '../types';

export type BarRenderInput = {
  data: ChartData;
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
  bounds: { min?: number; max?: number } | undefined
): { ticks: number[]; tickStep: number } {
  const domain = computeValueDomain(data.series, { includeZero: true, bounds });
  // The range is a placeholder: ticks depend only on the domain, and the real
  // geometry is not known yet.
  const scale = linearScale(domain, [1, 0]);

  return { ticks: scale.ticks, tickStep: scale.tickStep };
}

export function renderBar(input: BarRenderInput): string {
  const { data, plot, chartHeight, bounds, formatValue } = input;

  const domain = computeValueDomain(data.series, { includeZero: true, bounds });
  const y = linearScale(domain, [plot.bottom, plot.top]);
  const x = bandScale(data.labels, [plot.left, plot.right]);

  // Where zero sits. With an all-positive domain this is the plot floor; with
  // negatives in the data it floats, and bars hang from it in both directions.
  const zero = clamp(y(0), plot.top, plot.bottom);

  const parts: string[] = [];

  parts.push(renderGrid(y.ticks, y, plot));
  parts.push(renderValueAxis(y.ticks, y, plot, formatValue));
  parts.push(renderBars(data, x, y, zero));
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

function renderBars(
  data: ChartData,
  x: ReturnType<typeof bandScale>,
  y: (value: number) => number,
  zero: number
): string {
  const series = data.series[0];
  if (!series) return '';

  const barWidth = Math.min(x.bandwidth, MAX_BAR_WIDTH);
  // Centre the bar in its band when the cap has narrowed it, so the bar still
  // sits over its own category label.
  const inset = (x.bandwidth - barWidth) / 2;

  const bars = data.labels
    .map((label, i) => {
      const value = series.values[i];
      // A hole is not a zero-height bar: drawing one would put a mark on the
      // baseline that reads as a measured zero.
      if (typeof value !== 'number' || !Number.isFinite(value)) return '';

      const top = y(value);
      const height = Math.abs(top - zero);

      return tag('rect', {
        x: round(x(label) + inset),
        // A negative value draws downward from the baseline, so the rect's
        // origin is the baseline rather than the value.
        y: round(Math.min(top, zero)),
        width: round(barWidth),
        height: round(height),
        fill: seriesColor(0),
      });
    })
    .join('');

  return element('g', { class: 'chartkit-series', 'aria-hidden': 'true' }, bars);
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

      const centre = x(label) + x.bandwidth / 2;
      const top = plot.bottom + LABEL_FONT_SIZE;
      const shown = truncateToWidth(label, LABEL_FONT_SIZE, plan.maxWidth);

      if (!plan.rotate) {
        return text(shown, {
          x: round(centre),
          y: round(top),
          'text-anchor': 'middle',
        });
      }

      // Rotated labels are anchored at their end and pivot on the point just
      // below the band, so the text runs up-and-right away from its own tick
      // instead of sliding sideways off the one next to it.
      return text(shown, {
        x: round(centre),
        y: round(plot.bottom + 4),
        'text-anchor': 'end',
        transform: `rotate(${plan.angle} ${round(centre)} ${round(plot.bottom + 4)})`,
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
