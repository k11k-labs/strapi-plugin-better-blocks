/**
 * Domains, scales and ticks.
 *
 * Most of this file is about degenerate data rather than ordinary data. A
 * series of all zeros, a single data point, every value identical - each gives
 * a domain with no extent, and a linear scale over `[k, k]` maps every input to
 * the same pixel, or to `NaN`. Those cases are not exotic: "all zeros so far"
 * is what a chart of this quarter's sales looks like on day one.
 *
 * So the rule here is that a domain always comes out with real width, and every
 * function is written to survive data that carries no information.
 */

import { scaleBand, scaleLinear, scaleTime } from 'd3-scale';
import { ticks as d3Ticks } from 'd3-array';

import type { AxisBounds, Series, TimeBounds } from './types';

export type Domain = [min: number, max: number];

/** A linear scale, as this package uses it. */
export type LinearScale = {
  (value: number): number;
  domain: Domain;
  range: [number, number];
  ticks: number[];
  /** Distance between ticks, for deciding how many decimals to print. */
  tickStep: number;
};

/**
 * Every finite number across the given series.
 *
 * `null` holes and any non-finite value that survived validation are dropped
 * rather than treated as zero - a missing measurement is not a measurement of
 * zero, and letting one through would drag the domain to the origin.
 */
export function finiteValues(series: readonly Series[]): number[] {
  const out: number[] = [];

  for (const one of series) {
    for (const value of one.values) {
      if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
    }
  }

  return out;
}

/**
 * The value domain for a chart, after bounds and the zero baseline.
 *
 * `includeZero` is what makes a bar chart honest: bars encode magnitude by
 * length, so an axis that starts at 90 makes a 2% difference look like a 10x
 * one. Line charts pass `false`, where the convention is the opposite and
 * cropping to the data is what makes the shape readable.
 *
 * An explicit bound from the spec always wins, including one that crops a bar
 * chart - the author asked for it, and refusing would be this package deciding
 * it knows better than the person who wrote the spec.
 */
export function computeValueDomain(
  series: readonly Series[],
  options: { includeZero?: boolean; bounds?: AxisBounds } = {}
): Domain {
  const { includeZero = false, bounds } = options;
  const values = finiteValues(series);

  let min = values.length > 0 ? Math.min(...values) : 0;
  let max = values.length > 0 ? Math.max(...values) : 0;

  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (bounds?.min !== undefined && Number.isFinite(bounds.min)) min = bounds.min;
  if (bounds?.max !== undefined && Number.isFinite(bounds.max)) max = bounds.max;

  return padDegenerate(min, max);
}

/**
 * The value domain for a stacked chart.
 *
 * The axis has to cover the *totals*, not the individual values - a category
 * whose three series each read 40 reaches 120, and an axis topping out at 40
 * would draw two of the segments off the top of the plot.
 *
 * Positive and negative values stack in opposite directions from the baseline,
 * so they are accumulated separately. Mixing them into one sum would let a −50
 * cancel a +50 and shrink the axis below the height the bar actually needs.
 *
 * Zero is always included: a stack is measured from the baseline, so the
 * baseline has to be on the chart.
 */
export function computeStackedDomain(
  series: readonly Series[],
  options: { bounds?: AxisBounds } = {}
): Domain {
  const length = series.reduce((longest, one) => Math.max(longest, one.values.length), 0);

  let min = 0;
  let max = 0;

  for (let i = 0; i < length; i++) {
    let positive = 0;
    let negative = 0;

    for (const one of series) {
      const value = one.values[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (value >= 0) positive += value;
      else negative += value;
    }

    max = Math.max(max, positive);
    min = Math.min(min, negative);
  }

  const { bounds } = options;
  if (bounds?.min !== undefined && Number.isFinite(bounds.min)) min = bounds.min;
  if (bounds?.max !== undefined && Number.isFinite(bounds.max)) max = bounds.max;

  return padDegenerate(min, max);
}

/**
 * Gives a domain width when it has none.
 *
 * Three cases reach this, and they want different answers:
 *
 * - **all zeros** - `[0, 0]`. Padding proportionally gives `[0, 0]` again, so
 *   this picks an arbitrary but sane `[0, 1]`: an axis reading 0 to 1 with a
 *   flat line along the bottom is the truthful picture.
 * - **every value the same non-zero k** - pads by 10% of `|k|`, so the line
 *   sits mid-plot with room around it rather than pinned to an edge.
 * - **inverted bounds**, from a spec with `min` above `max` - swapped rather
 *   than rejected, since the intent is obvious and a backwards axis renders
 *   as nonsense.
 */
function padDegenerate(min: number, max: number): Domain {
  if (min > max) [min, max] = [max, min];
  if (max > min) return [min, max];

  if (min === 0) return [0, 1];

  const padding = Math.abs(min) * 0.1;
  return [min - padding, max + padding];
}

/**
 * A linear scale over `domain`, mapped onto `range`, with ticks.
 *
 * `range` is given in SVG coordinates, so for a vertical axis it runs
 * bottom-to-top - that is, the first number is larger than the second, because
 * SVG's y grows downward.
 */
export function linearScale(domain: Domain, range: [number, number], tickCount = 5): LinearScale {
  const scale = scaleLinear().domain(domain).range(range);
  const values = niceTicks(domain, tickCount);

  const fn = ((value: number) => scale(value)) as LinearScale;
  fn.domain = domain;
  fn.range = range;
  fn.ticks = values;
  fn.tickStep = values.length > 1 ? values[1] - values[0] : 0;

  return fn;
}

/**
 * Tick values for a domain, at human-readable intervals.
 *
 * d3 picks steps of 1, 2, 5 and powers of ten, which is what makes an axis read
 * as 0, 25, 50, 75, 100 rather than 0, 23.4, 46.8. It can return fewer ticks
 * than asked for, and for a very narrow domain it can return none at all -
 * hence the fallback to the domain's own ends, so an axis is never blank.
 */
export function niceTicks(domain: Domain, count: number): number[] {
  const [min, max] = domain;
  const values = d3Ticks(min, max, Math.max(2, count));

  if (values.length >= 2) return values;
  return [min, max];
}

/** A band scale, as this package uses it. */
export type BandScale = {
  (label: string): number;
  bandwidth: number;
  step: number;
  domain: string[];
  range: [number, number];
};

/**
 * A categorical scale placing one band per label.
 *
 * `padding` is the fraction of each step left as gap. 0.2 reads as bars with
 * clear separation; at 50 categories the gap collapses to sub-pixel and the
 * bars merge into a block, which is a legibility problem the fixture set exists
 * to surface rather than something to paper over here.
 */
export function bandScale(
  labels: readonly string[],
  range: [number, number],
  padding = 0.2
): BandScale {
  // A band scale with an empty domain has bandwidth 0 and maps everything to
  // the range start. Substituting a single anonymous band keeps the geometry
  // finite so an empty chart draws its axes instead of dividing by zero.
  const domain = labels.length > 0 ? [...labels] : [''];

  const scale = scaleBand<string>().domain(domain).range(range).paddingInner(padding);

  const fn = ((label: string) => scale(label) ?? range[0]) as BandScale;
  fn.bandwidth = scale.bandwidth();
  fn.step = scale.step();
  fn.domain = domain;
  fn.range = range;

  return fn;
}

// ── Time ─────────────────────────────────────────────────────────────

/** A time scale, as this package uses it. Domain and ticks are epoch ms. */
export type TimeScale = {
  (time: number): number;
  domain: Domain;
  range: [number, number];
  ticks: number[];
};

/**
 * Parses the axis labels as instants.
 *
 * Returns `null` if any label is not a date, so a caller can fall back to
 * categories rather than draw an axis with holes in it where the unparseable
 * ones were. `Date.parse` is deliberate: it takes ISO 8601, which is what a
 * date in JSON should be, and the spec says labels are strings.
 */
export function parseTimes(labels: readonly string[]): number[] | null {
  const out: number[] = [];

  for (const label of labels) {
    const time = Date.parse(label);
    if (!Number.isFinite(time)) return null;
    out.push(time);
  }

  return out;
}

/**
 * The time domain, after bounds.
 *
 * Unlike a value domain there is no zero to include: an axis of instants has
 * no origin worth anchoring to, and starting a week of readings at 1970 would
 * be absurd rather than honest.
 */
export function computeTimeDomain(times: readonly number[], bounds?: TimeBounds): Domain {
  const finite = times.filter((time) => Number.isFinite(time));

  let min = finite.length > 0 ? Math.min(...finite) : 0;
  let max = finite.length > 0 ? Math.max(...finite) : 0;

  const lower = bounds?.min === undefined ? undefined : Date.parse(bounds.min);
  const upper = bounds?.max === undefined ? undefined : Date.parse(bounds.max);

  if (lower !== undefined && Number.isFinite(lower)) min = lower;
  if (upper !== undefined && Number.isFinite(upper)) max = upper;

  // A single instant, or every reading at the same moment, has no extent. An
  // hour either side gives the scale something to divide without pretending
  // the data covers it.
  if (min === max) return [min - 3_600_000, max + 3_600_000];

  return padDegenerate(min, max);
}

/**
 * A time scale over `domain`, with ticks at calendar boundaries.
 *
 * d3's time ticks land on whole hours, days, months and years rather than on
 * arithmetic divisions of the span, which is what makes an axis read as
 * "1 Feb, 1 Mar, 1 Apr" instead of "3 Feb, 5 Mar, 4 Apr".
 */
export function timeScale(domain: Domain, range: [number, number], tickCount = 6): TimeScale {
  const scale = scaleTime()
    .domain([new Date(domain[0]), new Date(domain[1])])
    .range(range);

  const values = scale.ticks(Math.max(2, tickCount)).map((date) => date.getTime());

  const fn = ((time: number) => scale(new Date(time))) as TimeScale;
  fn.domain = domain;
  fn.range = range;
  // Ends rather than nothing, for the same reason niceTicks falls back: a span
  // narrower than d3's smallest interval must still produce an axis.
  fn.ticks = values.length >= 2 ? values : [domain[0], domain[1]];

  return fn;
}

/**
 * Where a mark sits and how wide it may be, for either kind of x axis.
 *
 * Charts ask for a slot by data index and get a left edge and a width, so
 * nothing in `charts/` has to know which axis it is drawing against. For a time
 * axis the slot is centred on the instant, which means `slot(i) + bandwidth / 2`
 * is exactly the point's own position - the line goes through the timestamp,
 * and the bar straddles it.
 */
export type XPlacement = {
  slot(index: number): number;
  bandwidth: number;
  /** Centre-to-centre distance, for deciding how much label fits. */
  step: number;
};

export function bandPlacement(labels: readonly string[], scale: BandScale): XPlacement {
  return {
    slot: (index: number) => scale(labels[index] ?? ''),
    bandwidth: scale.bandwidth,
    step: scale.step,
  };
}

/**
 * Slots on a time axis, sized by the closest pair of readings.
 *
 * One width for every mark, taken from the smallest gap, because bars of
 * differing widths encode a difference that is not in the data - the eye reads
 * a wider bar as more. The smallest gap is what guarantees no two overlap.
 */
export function timePlacement(
  times: readonly number[],
  scale: TimeScale,
  padding = 0.2
): XPlacement {
  const positions = times.map((time) => scale(time));

  let closest = Infinity;
  for (let i = 1; i < positions.length; i += 1) {
    const gap = Math.abs(positions[i] - positions[i - 1]);
    if (gap > 0 && gap < closest) closest = gap;
  }

  // One reading, or several at the same instant: fall back to the whole plot
  // so a single bar is a bar rather than a hairline.
  const step = Number.isFinite(closest) ? closest : Math.abs(scale.range[1] - scale.range[0]);
  const bandwidth = step * (1 - padding);

  return {
    slot: (index: number) => (positions[index] ?? scale.range[0]) - bandwidth / 2,
    bandwidth,
    step,
  };
}
