/**
 * Turning a spec into an SVG string.
 *
 * The output is finished markup: no script, no stylesheet, nothing to hydrate.
 * A page can drop it in and be done, which is the entire premise — a chart in a
 * CMS should not cost a static site a JavaScript bundle.
 */

import { barValueTicks, renderBar } from './charts/bar';
import { createTickFormatter } from './format';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  LABEL_FONT_SIZE,
  TITLE_FONT_SIZE,
  computePlotArea,
  planCategoryLabels,
} from './layout';
import { NO_LEGEND, planLegend, renderLegend } from './legend';
import { bandScale } from './scale';
import { element, escapeText, round, text } from './svg';
import { TEXT_COLOR } from './theme';
import { validateChartSpec } from './validate';
import type { ChartIssue } from './validate';
import type { ChartSpec } from './types';

export type RenderOptions = {
  /**
   * BCP 47 tag used to format numbers, unless the spec's `valueFormat` names
   * its own. Left undefined, `Intl` uses the runtime's locale — which on a
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
 * belong in front of whoever can fix them — an editor showing the issues, a
 * build log — not disguised as an empty chart on a live page.
 */
export function renderChart(spec: unknown, options: RenderOptions = {}): RenderResult {
  const validation = validateChartSpec(spec);
  if (!validation.valid) return { ok: false, issues: validation.issues };

  return { ok: true, svg: renderValidated(spec as ChartSpec, options) };
}

/**
 * Renders a spec already known to be valid.
 *
 * Skips validation, so only call it with something {@link validateChartSpec}
 * has passed — everything here assumes the shapes it guarantees.
 */
export function renderValidatedChart(spec: ChartSpec, options: RenderOptions = {}): string {
  return renderValidated(spec, options);
}

function renderValidated(spec: ChartSpec, options: RenderOptions): string {
  const width = positive(spec.options?.width, DEFAULT_WIDTH);
  const height = positive(spec.options?.height, DEFAULT_HEIGHT);

  const mode = spec.options?.barMode ?? 'grouped';

  const { ticks } = barValueTicks(spec.data, mode, spec.options?.yAxis);
  const formatValue = createTickFormatter(spec.options?.valueFormat, options.locale, ticks);
  const valueLabels = ticks.map(formatValue);

  const titleHeight = spec.title ? TITLE_FONT_SIZE * 1.6 : 0;

  // The category labels' height depends on the band step, which depends on the
  // plot width, which depends on this height. The loop is broken by measuring
  // against the full width first: the plot is narrower than the chart, so the
  // bands come out slightly wider than the real ones and the label plan errs
  // toward giving them more room. Erring that way costs a few pixels of margin;
  // erring the other way clips labels.
  const provisionalStep = bandScale(spec.data.labels, [0, width]).step;
  const labelPlan = planCategoryLabels(spec.data.labels, provisionalStep, height);

  // A legend only earns its space when there is more than one series to tell
  // apart; with one, the title already says what the bars are. An explicit
  // `legend: false` turns it off even then.
  const wantsLegend = spec.options?.legend ?? spec.data.series.length > 1;
  const legend = wantsLegend
    ? planLegend(
        spec.data.series.map((one) => one.name),
        width
      )
    : NO_LEGEND;

  const plot = computePlotArea({
    width,
    height,
    valueLabels,
    titleHeight,
    legendHeight: legend.height,
    categoryLabelHeight: labelPlan.height,
  });

  const body = renderBar({
    data: spec.data,
    mode,
    plot,
    chartHeight: height,
    bounds: spec.options?.yAxis,
    formatValue,
  });

  // Below the category labels, which sit directly under the plot.
  const legendMarkup = renderLegend(legend, plot.bottom + labelPlan.height, width);

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

  return element(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${round(width)} ${round(height)}`,
      // Sized by its container rather than by these numbers — the viewBox sets
      // the aspect ratio and the page sets the size.
      width: '100%',
      height: 'auto',
      class: `chartkit chartkit-bar chartkit-bar-${mode}`,
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

/** A dimension from the spec, falling back when it is missing or nonsensical. */
function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
