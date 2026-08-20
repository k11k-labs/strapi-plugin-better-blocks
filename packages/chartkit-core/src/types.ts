/**
 * The Chartkit chart specification.
 *
 * A `ChartSpec` is the whole chart: what to draw, the numbers to draw it from,
 * and how it should look. It is plain JSON, because it is stored inside a
 * Better Blocks document and travels through Strapi's API untouched.
 *
 * Deliberately free of any framework, DOM or Strapi types - this package turns
 * a spec into an SVG string and nothing else.
 */

// ── Versioning ───────────────────────────────────────────────────────

/**
 * The spec version this build writes.
 *
 * Unlike a Better Blocks document, a `ChartSpec` carries its version
 * explicitly. It has to: the spec sits nested inside someone else's document,
 * and Better Blocks knows nothing about its shape - it only knows to call this
 * package's migrator. Inferring the version from content, the way the document
 * format does, would mean re-deriving it from scratch on every schema change.
 */
export const CHART_SPEC_VERSION = 2;

export type ChartSpecVersion = 2;

// ── Chart types ──────────────────────────────────────────────────────

/**
 * Chart types this package can draw.
 *
 * The union is wider than what is implemented, on purpose: it is the v1 target
 * from the plan, and {@link validateChartSpec} rejects a type that has no
 * renderer yet rather than pretending. That way a spec authored against a newer
 * editor fails loudly instead of rendering as a blank box.
 */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut';

// ── Data ─────────────────────────────────────────────────────────────

/**
 * One line of numbers, named.
 *
 * `null` is a hole, not a zero - a line chart breaks across it rather than
 * interpolating through it, and a bar simply is not drawn. Making that
 * distinction representable is why the array is not `number[]`.
 */
export type Series = {
  name: string;
  values: (number | null)[];
};

/** Numbers typed straight into the editor. */
export type InlineData = {
  source: 'inline';
  labels: string[];
  series: Series[];
};

/**
 * Numbers read from a file already in Strapi's Media Library.
 *
 * The values are **materialized**: parsing happens once, in the editor, and the
 * result is written into the spec alongside a reference to the file it came
 * from. So this renders exactly like `inline` - no fetching, no resolver, and
 * no permission model to get wrong at render time.
 *
 * The reference is kept anyway, so the editor can offer to re-read the file
 * when it changes. That is an explicit action, not something that happens
 * behind a reader's back.
 */
export type MediaData = {
  source: 'media';
  /** Media Library file id, when the file came from there. */
  fileId?: number;
  /** The file's URL at import time - for showing the author what this was. */
  url?: string;
  /** File name at import time, for the same reason. */
  name?: string;
  /** ISO 8601 timestamp of the import, so staleness is visible. */
  importedAt?: string;
  labels: string[];
  series: Series[];
};

/**
 * Where a chart's numbers come from.
 *
 * The discriminant exists from the first version even though it started with
 * one member, so adding a source later does not invalidate documents already
 * written. `collection` - reading live from a Strapi collection - is
 * deliberately absent: it is a design problem about permissions and caching,
 * not a coding one, and a resolver that ignores Strapi's permission model
 * leaks draft content into public API responses while looking perfectly
 * innocent in review.
 */
export type ChartData = InlineData | MediaData;

// ── Options ──────────────────────────────────────────────────────────

/** Explicit bounds for the value axis. Either end may be left to the data. */
export type AxisBounds = {
  min?: number;
  max?: number;
};

/**
 * How a chart with more than one series arranges them.
 *
 * - **`grouped`** - series drawn side by side, or overlaid, and read
 *   individually.
 * - **`stacked`** - series piled on each other, so the height at a category is
 *   the total. Good for parts of a whole.
 *
 * Applies to `bar` and `area`. It has no meaning for `line` - stacked lines are
 * read as cumulative totals, which is what an area chart says visually and a
 * line does not - nor for `pie` and `donut`, which are already a whole divided
 * up.
 *
 * Not a chart `type`, because it changes the arrangement rather than the mark:
 * everything else - axes, legend, baseline - is identical, and a single-series
 * chart looks the same either way.
 */
export type StackMode = 'grouped' | 'stacked';

export type ChartOptions = {
  /**
   * viewBox width, not pixels. The rendered SVG scales to its container; this
   * sets the coordinate space the geometry is computed in, and with it the
   * effective aspect ratio.
   */
  width?: number;
  /** viewBox height. See {@link ChartOptions.width}. */
  height?: number;
  /** Draw the legend. Defaults to on when there is more than one series. */
  legend?: boolean;
  /**
   * How multiple series are arranged, for `bar` and `area`. Defaults to
   * `grouped`, and has no visible effect on a chart with a single series.
   *
   * Was called `barMode` in spec version 1; {@link migrateChartSpec} renames it.
   */
  stackMode?: StackMode;
  /**
   * How values are written out, as an [Intl.NumberFormat][1] options object.
   * A plain object rather than a format string, because it is JSON that has to
   * survive a round trip through the database.
   *
   * [1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
   */
  valueFormat?: ValueFormat;
  /** Bounds for the value axis. Omitted ends are taken from the data. */
  yAxis?: AxisBounds;
  /**
   * What the labels along the bottom mean. Defaults to `category`, which is
   * what every chart written before this option existed gets.
   */
  xAxis?: XAxis;
};

/**
 * How the labels along the bottom are read.
 *
 * - **`category`** - labels are names. They are placed in the order given, one
 *   slot each, whatever they say.
 * - **`time`** - labels are instants, and are placed by *when* they are. Two
 *   readings a minute apart sit a minute apart; a missing month leaves a gap.
 *
 * This is opt-in rather than sniffed from the data. Labels that happen to look
 * like dates are not necessarily meant to be read as dates - `2024`, `2025`
 * may be intended as two categories with equal weight - and quietly re-spacing
 * an existing chart because its labels parse is the kind of helpfulness nobody
 * asked for.
 */
export type XAxis = {
  type?: 'category' | 'time';
  /**
   * How instants are written on the axis, as an [Intl.DateTimeFormat][1]
   * options object. Omit it and the granularity is chosen from the span being
   * drawn: hours for a day, days for a month, months for a year.
   *
   * [1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
   */
  format?: TimeFormat;
  /**
   * Bounds for a time axis, as ISO 8601 strings. Omitted ends are taken from
   * the data. Strings rather than numbers because that is what the labels are,
   * and a spec that mixed the two would be a trap.
   */
  bounds?: TimeBounds;
};

/** Explicit ends for a time axis, as ISO 8601 strings. */
export type TimeBounds = {
  min?: string;
  max?: string;
};

/**
 * The subset of `Intl.DateTimeFormat` options worth storing in a document.
 *
 * Narrow for the same reason {@link ValueFormat} is: JSON-safe fields with an
 * obvious meaning on an axis, and nothing that invites the renderer to guess.
 */
export type TimeFormat = {
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'short' | 'long';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  /** e.g. `UTC`. Defaults to the renderer's environment. */
  timeZone?: string;
  hour12?: boolean;
  /** BCP 47 tag. Defaults to the renderer's `locale` option. */
  locale?: string;
};

/**
 * The subset of `Intl.NumberFormat` options worth storing in a document.
 *
 * Narrower than the real thing on purpose: every field here is JSON-safe and
 * has an obvious meaning in a chart. Anything else is presentation the renderer
 * should not be guessing at.
 */
export type ValueFormat = {
  style?: 'decimal' | 'percent' | 'currency';
  /** Required by `Intl` when `style` is `currency`, e.g. `EUR`. */
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** e.g. `compact` turns 1200 into 1.2K. */
  notation?: 'standard' | 'compact';
  /** BCP 47 tag. Defaults to the renderer's `locale` option. */
  locale?: string;
};

// ── The spec ─────────────────────────────────────────────────────────

export type ChartSpec = {
  version: ChartSpecVersion;
  type: ChartType;
  /** Rendered into `<title>`, and drawn above the plot when present. */
  title?: string;
  /**
   * The chart in words, for anyone who cannot see it. Rendered into `<desc>`.
   *
   * Worth writing: a screen reader announcing "bar chart" and a list of numbers
   * conveys far less than a sentence saying what the numbers show.
   */
  description?: string;
  data: ChartData;
  options?: ChartOptions;
};
