/**
 * The line chart, and the area chart that is a line with the space beneath it
 * filled.
 *
 * Almost every convention here is the opposite of the bar chart's, which is
 * worth stating plainly because the temptation is to share more than is
 * correct:
 *
 * - **Zero is not forced into the domain.** A bar encodes magnitude by length
 *   from a baseline, so cropping the axis lies about proportions. A line
 *   encodes change by slope, and cropping to the data is what makes the shape
 *   readable - a temperature chart starting at zero is mostly empty space.
 *   An *area* chart does force zero, because the filled region is measured from
 *   the baseline and is meaningless without it.
 *
 * - **A hole breaks the line.** In a stack a missing series closes up; in a
 *   line, joining across a gap invents a measurement that was never taken. The
 *   line stops and restarts.
 *
 * - **Points sit at band centers** rather than filling a band, since a line
 *   marks an instant rather than covering an interval.
 */

import { area as d3Area, line as d3Line } from 'd3-shape';

import { computeStackedDomain, computeValueDomain, type Domain, type XPlacement } from '../scale';
import { element, round, tag } from '../svg';
import { seriesColor } from '../theme';
import type { AxisBounds, ChartData, ChartType, Series } from '../types';

export type LineRenderInput = {
  data: ChartData;
  type: ChartType;
  /** Stacking applies to `area` only; a line is always read individually. */
  stacked: boolean;
  x: XPlacement;
  y: (value: number) => number;
  /** Where the baseline sits, in SVG coordinates. Only an area needs it. */
  zero: number;
};

/** Stroke width for the line itself. */
const STROKE = 2;

/** Radius of the dot drawn for a point with no neighbors. */
const ISOLATED_POINT_RADIUS = 3;

/** Opacity of an area's fill, so an overlapped series stays visible. */
const AREA_OPACITY = 0.25;

/**
 * The value domain for a line or an area.
 *
 * See the note at the top of the file: a line crops to its data, an area
 * includes zero because its fill is measured from the baseline.
 */
export function lineDomain(
  series: readonly Series[],
  type: ChartType,
  bounds: AxisBounds | undefined,
  stacked = false
): Domain {
  // A stacked area is measured by its totals, exactly like a stacked bar: three
  // bands of 40 reach 120, and an axis topping out at 40 would draw two of them
  // off the plot.
  if (stacked && type === 'area') return computeStackedDomain(series, { bounds });

  return computeValueDomain(series, { includeZero: type === 'area', bounds });
}

/** The lines, and the fills beneath them when this is an area chart. */
export function renderLine(input: LineRenderInput): string {
  const { data, type, stacked, x, y, zero } = input;
  if (data.series.length === 0) return '';

  // A line marks an instant, so it sits at the middle of its category's band
  // rather than spanning it.
  // Centre of the slot, which on a time axis is the instant itself.
  const centerOf = (index: number) => x.slot(index) + x.bandwidth / 2;

  const stacking = stacked && type === 'area';
  // Running total per category, so each band is drawn on top of the ones below
  // it. A missing value contributes nothing, which means the bands above it sit
  // lower at that category - the total genuinely is smaller there. Holding them
  // at the height they would have had would assert a reading nobody took.
  const baselines = data.labels.map(() => 0);

  const drawn = data.series
    .map((series, seriesIndex) => {
      const points = data.labels.map((label, i) => {
        const value = valueAt(series, i);
        const base = baselines[i];

        if (stacking && value !== null) baselines[i] = base + value;

        return {
          cx: centerOf(i),
          value: value === null ? null : stacking ? base + value : value,
          base: stacking ? base : null,
        };
      });

      const defined = (point: (typeof points)[number]) => point.value !== null;

      const fill =
        type === 'area'
          ? tag('path', {
              d: roundPath(
                d3Area<(typeof points)[number]>()
                  .defined(defined)
                  .x((point) => point.cx)
                  // A stacked band sits on the one below it; an unstacked area
                  // sits on the baseline.
                  .y0((point) => (point.base === null ? zero : y(point.base)))
                  .y1((point) => y(point.value as number))(points) ?? ''
              ),
              fill: seriesColor(seriesIndex),
              'fill-opacity': AREA_OPACITY,
            })
          : '';

      const stroke = tag('path', {
        d: roundPath(
          d3Line<(typeof points)[number]>()
            .defined(defined)
            .x((point) => point.cx)
            .y((point) => y(point.value as number))(points) ?? ''
        ),
        fill: 'none',
        stroke: seriesColor(seriesIndex),
        'stroke-width': STROKE,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });

      return fill + stroke + renderIsolatedPoints(points, y, seriesIndex);
    })
    .join('');

  return element('g', { class: 'chartkit-series', 'aria-hidden': 'true' }, drawn);
}

/**
 * Dots for points with no neighbor to join to.
 *
 * A path through a single point draws nothing at all - there is no segment -
 * so a reading surrounded by gaps would silently vanish from the chart. That is
 * the worst kind of rendering bug: the data is there, the chart is drawn, and
 * the value is simply invisible.
 *
 * Only isolated points get a dot. Marking every point is a different design
 * decision, and one that clutters a chart of fifty readings.
 */
function renderIsolatedPoints(
  points: readonly { cx: number; value: number | null }[],
  y: (value: number) => number,
  seriesIndex: number
): string {
  return points
    .map((point, i) => {
      if (point.value === null) return '';

      const previous = points[i - 1];
      const next = points[i + 1];
      const hasNeighbor = previous?.value != null || next?.value != null;

      if (hasNeighbor) return '';

      return tag('circle', {
        cx: round(point.cx),
        cy: round(y(point.value)),
        r: ISOLATED_POINT_RADIUS,
        fill: seriesColor(seriesIndex),
      });
    })
    .join('');
}

/** A series value at an index, with anything unusable treated as a hole. */
function valueAt(series: Series, index: number): number | null {
  const value = series.values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Rounds the numbers in a path.
 *
 * d3 emits full floating-point precision, which triples the size of the markup
 * and makes a snapshot diff unreadable - a one-pixel change should not rewrite
 * every coordinate in the file. Two decimals is far below what any renderer
 * resolves.
 */
function roundPath(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (match) => String(round(Number(match))));
}
