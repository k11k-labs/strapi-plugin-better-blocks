/**
 * The pie chart, and the donut that is a pie with its middle removed.
 *
 * This is the first chart here with no axes, no baseline and no categories
 * along a scale - so it shares almost nothing with the others except the title,
 * the legend and the accessible description. Trying to route it through the
 * cartesian pipeline would mean threading "except for pie" through every step
 * of it.
 *
 * The other difference is what the colors mean. In a bar or line chart a color
 * is a *series*; here there is only one series and a color is a *category*, so
 * the legend names the slices.
 */

import { arc as d3Arc, pie as d3Pie } from 'd3-shape';

import type { PlotArea } from '../layout';
import { LABEL_FONT_SIZE, estimateTextWidth } from '../layout';
import { element, round, tag, text } from '../svg';
import { seriesColor } from '../theme';
import type { ChartData, ChartType } from '../types';

export type PieRenderInput = {
  data: ChartData;
  type: ChartType;
  plot: PlotArea;
};

/** Hole size for a donut, as a fraction of the outer radius. */
const DONUT_RATIO = 0.6;

/**
 * Where along the radius a slice's label sits, as a fraction of the ring.
 *
 * Slightly past the middle, so the label clears the crowded point where the
 * wedge narrows toward the center.
 */
const LABEL_RADIUS_RATIO = 0.55;

/** The slices, and the share labels on the ones with room. */
export function renderPie(input: PieRenderInput): string {
  const { data, type, plot } = input;

  const series = data.series[0];
  if (!series) return '';

  // A slice is a share of a whole, so a hole and a zero come to the same thing:
  // no wedge. Negative values are rejected by the validator, since a slice
  // cannot have a negative share of anything.
  const values = data.labels.map((_, i) => {
    const value = series.values[i];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  });

  const total = values.reduce((sum, value) => sum + value, 0);
  // Nothing to divide up. Better to draw nothing than a full circle of one
  // arbitrary color, which would read as "all of it is this category".
  if (total <= 0) return '';

  const centerX = plot.left + plot.width / 2;
  const centerY = plot.top + plot.height / 2;
  const radius = Math.max(1, Math.min(plot.width, plot.height) / 2);
  const innerRadius = type === 'donut' ? radius * DONUT_RATIO : 0;

  // sort(null) keeps the author's order. Left to itself d3 sorts by size, which
  // would break the correspondence between slice order and legend order - and
  // the legend is the only thing naming these slices.
  const arcs = d3Pie<number>()
    .sort(null)
    .value((value) => value)(values);

  const shape = d3Arc<(typeof arcs)[number]>().innerRadius(innerRadius).outerRadius(radius);
  const labelRadius = innerRadius + (radius - innerRadius) * LABEL_RADIUS_RATIO;
  const labelShape = d3Arc<(typeof arcs)[number]>()
    .innerRadius(labelRadius)
    .outerRadius(labelRadius);

  const slices = arcs
    .map((datum, index) => {
      if (datum.value <= 0) return '';

      const path = tag('path', {
        d: roundPath(shape(datum) ?? ''),
        fill: seriesColor(index),
      });

      const share = formatShare(datum.value, total);
      if (!labelFits(share, datum, labelRadius, radius - innerRadius)) return path;

      // Relative to the group's origin, which the transform below has already
      // moved to the center of the plot.
      const [labelX, labelY] = labelShape.centroid(datum);

      return (
        path +
        text(share, {
          x: round(labelX),
          y: round(labelY),
          'text-anchor': 'middle',
          dy: '0.32em',
          'font-size': LABEL_FONT_SIZE,
          // Slice fills are the page's to theme, so a label cannot know what it
          // is sitting on. White with a dark halo stays legible on any of them.
          fill: '#fff',
          stroke: 'rgba(0,0,0,0.45)',
          'stroke-width': 3,
          'paint-order': 'stroke',
        })
      );
    })
    .join('');

  return element(
    'g',
    {
      class: 'chartkit-series',
      transform: `translate(${round(centerX)} ${round(centerY)})`,
      'aria-hidden': 'true',
    },
    slices
  );
}

/**
 * Whether a label actually fits inside its own wedge.
 *
 * This started as a minimum angle, which was wrong: how much room a slice has
 * depends on the radius and on how wide the text is, not on the angle alone. A
 * 6% slice on a large chart has room that the same slice on a small one does
 * not, and "12.5%" needs half again the width of "9%".
 *
 * So it measures instead. At the label's radius the wedge is about a chord
 * wide, and the text must also fit within the thickness of the ring. A label
 * spilling out of its slice onto its neighbors is worse than no label - the
 * legend already names every category, and the figures are in the description.
 */
function labelFits(
  label: string,
  datum: { startAngle: number; endAngle: number },
  labelRadius: number,
  ringThickness: number
): boolean {
  const angle = datum.endAngle - datum.startAngle;

  // Measured at the text's inner edge rather than its middle: a wedge narrows
  // toward the center, so the bottom of the label is where it runs out of room
  // first. Clamped at half a turn, past which the wedge is wider than its own
  // chord and the formula turns back on itself - a full circle would otherwise
  // report zero width for the slice with the most room of all.
  const tightestRadius = Math.max(1, labelRadius - LABEL_FONT_SIZE / 2);
  const chord = 2 * tightestRadius * Math.sin(Math.min(angle, Math.PI) / 2);

  return (
    estimateTextWidth(label, LABEL_FONT_SIZE) <= chord && LABEL_FONT_SIZE * 1.2 <= ringThickness
  );
}

/**
 * A slice's share, as a percentage.
 *
 * Percentages rather than the raw values: a pie answers "how much of the whole"
 * and nothing else - anyone who needs the figures has the accessible
 * description, and a legend of numbers is what a table is for.
 */
function formatShare(value: number, total: number): string {
  const percent = (value / total) * 100;
  // One decimal only below 10%, where whole numbers hide real differences
  // between small slices.
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

/** Rounds the numbers in a path - see the note in charts/line.ts. */
function roundPath(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (match) => String(round(Number(match))));
}
