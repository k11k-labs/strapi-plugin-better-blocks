/**
 * The furniture every cartesian chart shares: gridlines, the value axis, the
 * category axis.
 *
 * Shared rather than copied because a bar chart and a line chart differ in
 * exactly one thing — the marks inside the plot. If each drew its own axes they
 * would drift, and a chart's axis is the part a reader trusts most.
 */

import { LABEL_FONT_SIZE, planCategoryLabels, truncateToWidth, type PlotArea } from './layout';
import type { bandScale } from './scale';
import { element, round, tag, text } from './svg';
import { AXIS_COLOR, GRID_COLOR, GRID_OPACITY, TEXT_COLOR } from './theme';

export type AxesInput = {
  labels: readonly string[];
  ticks: readonly number[];
  x: ReturnType<typeof bandScale>;
  y: (value: number) => number;
  plot: PlotArea;
  chartHeight: number;
  /** Where the baseline sits, in SVG coordinates. */
  zero: number;
  formatValue: (value: number) => string;
};

/**
 * The axes, split by what they sit relative to the marks.
 *
 * Gridlines and value labels go *behind*: a gridline drawn over a bar cuts it
 * into slices. The category axis goes *in front*, because its baseline is the
 * line every value is measured from, and a crisp edge along the foot of the
 * bars is what makes them look seated on it rather than floating near it.
 *
 * Returning two strings rather than one is the whole point — the caller
 * sandwiches its marks between them.
 */
export function renderAxes(input: AxesInput): { behind: string; front: string } {
  const { labels, ticks, x, y, plot, chartHeight, zero, formatValue } = input;

  return {
    behind: renderGrid(ticks, y, plot) + renderValueAxis(ticks, y, plot, formatValue),
    front: renderCategoryAxis(labels, x, plot, chartHeight, zero),
  };
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
