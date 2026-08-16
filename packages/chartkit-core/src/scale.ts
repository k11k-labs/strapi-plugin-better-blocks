/**
 * Domains, scales and ticks.
 *
 * Most of this file is about degenerate data rather than ordinary data. A
 * series of all zeros, a single data point, every value identical — each gives
 * a domain with no extent, and a linear scale over `[k, k]` maps every input to
 * the same pixel, or to `NaN`. Those cases are not exotic: "all zeros so far"
 * is what a chart of this quarter's sales looks like on day one.
 *
 * So the rule here is that a domain always comes out with real width, and every
 * function is written to survive data that carries no information.
 */

import { scaleBand, scaleLinear } from 'd3-scale';
import { ticks as d3Ticks } from 'd3-array';

import type { AxisBounds, Series } from './types';

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
 * rather than treated as zero — a missing measurement is not a measurement of
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
 * chart — the author asked for it, and refusing would be this package deciding
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
 * Gives a domain width when it has none.
 *
 * Three cases reach this, and they want different answers:
 *
 * - **all zeros** — `[0, 0]`. Padding proportionally gives `[0, 0]` again, so
 *   this picks an arbitrary but sane `[0, 1]`: an axis reading 0 to 1 with a
 *   flat line along the bottom is the truthful picture.
 * - **every value the same non-zero k** — pads by 10% of `|k|`, so the line
 *   sits mid-plot with room around it rather than pinned to an edge.
 * - **inverted bounds**, from a spec with `min` above `max` — swapped rather
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
 * bottom-to-top — that is, the first number is larger than the second, because
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
 * than asked for, and for a very narrow domain it can return none at all —
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
