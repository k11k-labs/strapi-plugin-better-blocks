/**
 * Turning a spec into an SVG string.
 *
 * The output is finished markup: no script, no stylesheet, nothing to hydrate.
 * A page can drop it in and be done, which is the entire premise - a chart in a
 * CMS should not cost a static site a JavaScript bundle.
 */

import { renderAxes } from './axes';
import { barDomain, renderBar } from './charts/bar';
import { lineDomain, renderLine } from './charts/line';
import { renderPie } from './charts/pie';
import { createTickFormatter, createTimeTickFormatter } from './format';
import { migrateChartSpec } from './migrate';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  LABEL_FONT_SIZE,
  TITLE_FONT_SIZE,
  computePlotArea,
  estimateTextWidth,
  planCategoryLabels,
} from './layout';
import { NO_LEGEND, planLegend, renderLegend } from './legend';
import {
  bandPlacement,
  bandScale,
  computeTimeDomain,
  linearScale,
  parseTimes,
  timePlacement,
  timeScale,
} from './scale';
import { element, escapeText, round, text } from './svg';
import { TEXT_COLOR } from './theme';
import { validateChartSpec } from './validate';
import type { ChartIssue } from './validate';
import type { ChartData, ChartSpec } from './types';

export type RenderOptions = {
  /**
   * BCP 47 tag used to format numbers, unless the spec's `valueFormat` names
   * its own. Left undefined, `Intl` uses the runtime's locale - which on a
   * server is whatever the container happened to be built with, so passing this
   * explicitly is worth doing.
   */
  locale?: string;
  /**
   * Written as the SVG's `id` prefix, so several charts on one page cannot
   * collide on the ids their `aria-labelledby` points at.
   */
  idPrefix?: string;
};

export type RenderResult = { ok: true; svg: string } | { ok: false; issues: ChartIssue[] };

/**
 * Renders a spec, or explains why it cannot.
 *
 * Returns a result rather than throwing, and rather than emitting a placeholder
 * chart. A spec that fails validation is bad content, and content problems
 * belong in front of whoever can fix them - an editor showing the issues, a
 * build log - not disguised as an empty chart on a live page.
 */
export function renderChart(spec: unknown, options: RenderOptions = {}): RenderResult {
  // An older spec is brought up to date in memory first. Migrating stored
  // content is opt-in and someone else's job, but a renderer handed a version 1
  // chart should draw it rather than refuse it - the alternative is that
  // publishing a new Chartkit blanks every chart already in a database.
  const migration = migrateChartSpec(spec);
  const current = migration.status === 'skipped' ? spec : migration.spec;

  const validation = validateChartSpec(current);
  if (!validation.valid) return { ok: false, issues: validation.issues };

  return { ok: true, svg: renderValidated(current as ChartSpec, options) };
}

/**
 * Renders a spec already known to be valid.
 *
 * Skips validation, so only call it with something {@link validateChartSpec}
 * has passed - everything here assumes the shapes it guarantees.
 */
export function renderValidatedChart(spec: ChartSpec, options: RenderOptions = {}): string {
  return renderValidated(spec, options);
}

/** Chart types drawn as wedges around a center rather than against axes. */
const RADIAL_TYPES = new Set<ChartSpec['type']>(['pie', 'donut']);

function renderValidated(spec: ChartSpec, options: RenderOptions): string {
  const width = positive(spec.options?.width, DEFAULT_WIDTH);
  const height = positive(spec.options?.height, DEFAULT_HEIGHT);
  const titleHeight = spec.title ? TITLE_FONT_SIZE * 1.6 : 0;
  const radial = RADIAL_TYPES.has(spec.type);

  // What a color means differs by chart. In a bar or line chart it is a series,
  // so the legend names the series; in a pie there is one series and a color is
  // a category, so it names the slices.
  const legendNames = radial ? spec.data.labels : spec.data.series.map((one) => one.name);

  // A legend earns its space when it has something to disambiguate. A pie
  // always does - nothing else names its slices - while a single-series bar
  // chart is already named by its title.
  const wantsLegend = spec.options?.legend ?? legendNames.length > 1;
  const legend = wantsLegend ? planLegend(legendNames, width) : NO_LEGEND;

  const body = radial
    ? renderRadialBody(spec, { width, height, titleHeight, legendHeight: legend.height })
    : renderCartesianBody(spec, {
        width,
        height,
        titleHeight,
        legendHeight: legend.height,
        locale: options.locale,
      });

  // Anchored to the foot of the chart, a gutter clear of the edge so
  // descenders do not touch it. For a cartesian chart this lands exactly where
  // the layout reserved room for it, below the category labels.
  const legendMarkup = renderLegend(legend, height - legend.height - 8, width);

  const prefix = options.idPrefix ?? 'chartkit';
  const titleId = `${prefix}-title`;
  const descId = `${prefix}-desc`;

  const labelledBy = [spec.title && titleId, spec.description && descId].filter(Boolean).join(' ');

  const heading = spec.title
    ? text(spec.title, {
        x: round(width / 2),
        y: round(TITLE_FONT_SIZE * 1.1),
        'text-anchor': 'middle',
        'font-size': TITLE_FONT_SIZE,
        'font-weight': 600,
        fill: TEXT_COLOR,
      })
    : '';

  const accessibleText =
    (spec.title ? element('title', { id: titleId }, escapeText(spec.title)) : '') +
    (spec.description ? element('desc', { id: descId }, escapeText(spec.description)) : '');

  const mode = spec.options?.stackMode ?? 'grouped';

  return element(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${round(width)} ${round(height)}`,
      // Sized by its container rather than by these numbers - the viewBox sets
      // the aspect ratio and the page sets the size.
      width: '100%',
      height: 'auto',
      class:
        spec.type === 'bar'
          ? `chartkit chartkit-bar chartkit-bar-${mode}`
          : `chartkit chartkit-${spec.type}`,
      // Announced as a single image with a name, instead of the screen reader
      // walking dozens of meaningless <rect> elements.
      role: 'img',
      'aria-labelledby': labelledBy || undefined,
      'font-size': LABEL_FONT_SIZE,
      'font-family': 'inherit',
    },
    accessibleText + heading + body + legendMarkup
  );
}

type Frame = {
  width: number;
  height: number;
  titleHeight: number;
  legendHeight: number;
};

/** Bars, lines and areas: everything drawn against a pair of axes. */
function renderCartesianBody(spec: ChartSpec, frame: Frame & { locale?: string }): string {
  const { width, height, titleHeight, legendHeight, locale } = frame;
  const mode = spec.options?.stackMode ?? 'grouped';

  // The domain depends on the chart type - a bar is measured from a baseline, a
  // line is not. See lineDomain for why that is not a detail.
  const domain =
    spec.type === 'bar'
      ? barDomain(spec.data.series, mode, spec.options?.yAxis)
      : lineDomain(spec.data.series, spec.type, spec.options?.yAxis, mode === 'stacked');

  // Ticks depend only on the domain, so they are known before the plot is
  // sized - which matters, because the left margin is sized from the widest
  // tick label. The range here is a placeholder.
  const { ticks } = linearScale(domain, [1, 0]);
  const formatValue = createTickFormatter(spec.options?.valueFormat, locale, ticks);
  const valueLabels = ticks.map(formatValue);

  // The category labels' height depends on the band step, which depends on the
  // plot width, which depends on this height. The loop is broken by measuring
  // against the full width first: the plot is narrower than the chart, so the
  // bands come out slightly wider than the real ones and the label plan errs
  // toward giving them more room. Erring that way costs a few pixels of margin;
  // erring the other way clips labels.
  // A time axis only happens when the spec asks for one and every label
  // actually parses. Falling back to categories rather than refusing keeps a
  // half-edited chart drawable, and validate() is where the author is told.
  const parsed = spec.options?.xAxis?.type === 'time' ? parseTimes(spec.data.labels) : null;

  // A line joins consecutive readings, and on a time axis "consecutive" means
  // in time - not in whatever order the rows happened to arrive. Left in array
  // order, a series exported unsorted draws as a scribble doubling back on
  // itself. The permutation is applied to the labels and to every series at
  // once, so a value never parts company with its own instant.
  const order = parsed ? parsed.map((_, i) => i).sort((a, b) => parsed[a] - parsed[b]) : null;

  const times = parsed && order ? order.map((i) => parsed[i]) : parsed;
  const data = order ? reorder(spec.data, order) : spec.data;

  const provisionalBottom = times
    ? provisionalTimeLabels(times, spec, locale, width)
    : {
        labels: [...data.labels],
        step: bandScale(data.labels, [0, width]).step,
        edgeWidth: 0,
      };

  const labelPlan = planCategoryLabels(provisionalBottom.labels, provisionalBottom.step, height);

  const plot = computePlotArea({
    width,
    height,
    valueLabels,
    titleHeight,
    legendHeight,
    categoryLabelHeight: labelPlan.height,
    // A category label is centred in its band and so cannot reach the edge. A
    // time tick sits on the instant, and the last one is the plot's right edge
    // exactly, so half its label hangs off the chart without this.
    edgeLabelWidth: times ? provisionalBottom.edgeWidth : 0,
  });

  const y = linearScale(domain, [plot.bottom, plot.top]);

  // Where zero sits. With an all-positive domain this is the plot floor; with
  // negatives in the data it floats, and marks sit either side of it. Clamped,
  // because a cropped axis can put zero outside the plot entirely.
  const zero = clampToPlot(y(0), plot.top, plot.bottom);

  // A bar is centred on its instant, so on a bare domain half of the first and
  // last bars falls outside the plot. Half a slot of headroom at each end is
  // what gives them somewhere to sit. Lines need none: a point has no width,
  // and starting hard against the axis is what a time series should look like.
  const barPad = spec.type === 'bar' && times ? halfSmallestGap(times) : 0;

  const timeDomain = times
    ? padDomain(computeTimeDomain(times, spec.options?.xAxis?.bounds), barPad)
    : null;
  const time = timeDomain ? timeScale(timeDomain, [plot.left, plot.right]) : null;

  const x =
    times && time
      ? timePlacement(times, time)
      : bandPlacement(data.labels, bandScale(data.labels, [plot.left, plot.right]));

  const bottom =
    times && time
      ? {
          kind: 'time' as const,
          ticks: time.ticks.map((tick) => ({
            center: time(tick),
            label: createTimeTickFormatter(spec.options?.xAxis?.format, locale, time.ticks)(tick),
          })),
          // Ticks are evenly spaced in time, so the gap between the first two
          // is the budget every label has.
          step:
            time.ticks.length > 1
              ? Math.abs(time(time.ticks[1]) - time(time.ticks[0]))
              : plot.width,
        }
      : {
          kind: 'category' as const,
          ticks: data.labels.map((label, i) => ({
            center: x.slot(i) + x.bandwidth / 2,
            label,
          })),
          step: x.step,
        };

  const axes = renderAxes({
    bottom,
    ticks,
    y,
    plot,
    chartHeight: height,
    zero,
    formatValue,
  });

  const marks =
    spec.type === 'bar'
      ? renderBar({ data, mode, x, y, zero })
      : renderLine({
          data,
          type: spec.type,
          stacked: mode === 'stacked',
          x,
          y,
          zero,
        });

  return axes.behind + marks + axes.front;
}

/**
 * Pie and donut, which have no axes to lay out around.
 *
 * The plot is simply what is left after the title and legend, and the wedges
 * take the largest circle that fits inside it.
 */
function renderRadialBody(spec: ChartSpec, frame: Frame): string {
  const { width, height, titleHeight, legendHeight } = frame;

  const top = titleHeight + 8;
  const plot = {
    left: 8,
    top,
    width: Math.max(1, width - 16),
    height: Math.max(1, height - top - legendHeight - 8),
    right: width - 8,
    bottom: height - legendHeight - 8,
  };

  return renderPie({ data: spec.data, type: spec.type, plot });
}

/** Keeps the baseline inside the plot when a cropped axis puts zero outside it. */
function clampToPlot(value: number, top: number, bottom: number): number {
  if (!Number.isFinite(value)) return bottom;
  return Math.min(Math.max(value, top), bottom);
}

/** A dimension from the spec, falling back when it is missing or nonsensical. */
function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Tick labels measured against the full chart width, before the plot exists.
 *
 * Same circularity as the category case above, broken the same way: ticks
 * chosen over the wider span are at worst more numerous than the real ones, so
 * the label plan errs toward reserving too much room rather than too little.
 */
function provisionalTimeLabels(
  times: readonly number[],
  spec: ChartSpec,
  locale: string | undefined,
  width: number
): { labels: string[]; step: number; edgeWidth: number } {
  const scale = timeScale(computeTimeDomain(times, spec.options?.xAxis?.bounds), [0, width]);
  const format = createTimeTickFormatter(spec.options?.xAxis?.format, locale, scale.ticks);
  const labels = scale.ticks.map(format);

  const step =
    scale.ticks.length > 1 ? Math.abs(scale(scale.ticks[1]) - scale(scale.ticks[0])) : width;

  const widest = labels.reduce(
    (most, label) => Math.max(most, estimateTextWidth(label, LABEL_FONT_SIZE)),
    0
  );

  return { labels, step, edgeWidth: widest / 2 };
}

/**
 * The same data with its points in a different order.
 *
 * Labels and every series are permuted together, so a value never parts
 * company with its own instant. A series shorter than the labels keeps its
 * holes: a missing index becomes the `null` the renderer already draws as a gap.
 */
function reorder(data: ChartData, order: readonly number[]): ChartData {
  return {
    ...data,
    labels: order.map((i) => data.labels[i]),
    series: data.series.map((one) => ({
      ...one,
      values: order.map((i) => one.values[i] ?? null),
    })),
  };
}

/**
 * Half the closest two readings, in milliseconds.
 *
 * The smallest gap is the one that decides how wide a bar may be without
 * touching its neighbour, so it is also the padding that keeps the outermost
 * bars inside the plot.
 */
function halfSmallestGap(times: readonly number[]): number {
  let closest = Infinity;

  for (let i = 1; i < times.length; i += 1) {
    const gap = Math.abs(times[i] - times[i - 1]);
    if (gap > 0 && gap < closest) closest = gap;
  }

  // One reading, or several at the same instant: computeTimeDomain has already
  // given the domain an hour either side, which is room enough.
  return Number.isFinite(closest) ? closest / 2 : 0;
}

function padDomain(domain: [number, number], by: number): [number, number] {
  return by > 0 ? [domain[0] - by, domain[1] + by] : domain;
}
