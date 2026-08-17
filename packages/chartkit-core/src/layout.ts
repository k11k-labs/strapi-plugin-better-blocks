/**
 * Deciding where things go.
 *
 * Axes and labels are the expensive part of drawing a chart - far more than the
 * shapes. A bar is four numbers; an axis has to work out how much room its
 * labels need, whether they collide, and what to do when they do.
 *
 * Doing that on a server means doing it without `measureText`, so widths here
 * are **estimates** from character counts. That is a deliberate trade: a real
 * measurement needs a DOM or a font file, and neither belongs in a package
 * whose promise is that it runs anywhere. The estimate is tuned to run slightly
 * wide, because a label with too much room looks fine and a label clipped by
 * the viewBox does not.
 */

export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 400;

export const TITLE_FONT_SIZE = 16;
export const LABEL_FONT_SIZE = 12;
export const LEGEND_FONT_SIZE = 12;

/** Gap between the plot and anything drawn outside it. */
const GUTTER = 8;

/**
 * Vertical room a 45°-rotated label needs, as a fraction of its length.
 * `sin(45°)`, hoisted out of the layout arithmetic so the trigonometry is
 * stated once rather than inlined as a magic 0.7071.
 */
const SIN_45 = Math.SQRT1_2;

/**
 * Approximate width of a string, in user units.
 *
 * The factor is the average advance width of a character in a typical UI sans
 * at a given size - digits and lowercase run near 0.5em, uppercase wider. 0.58
 * sits above the average on purpose; see the note at the top of the file about
 * erring wide.
 */
export function estimateTextWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.58;
}

/**
 * Shortens a label to fit, with an ellipsis.
 *
 * Returns the original when it already fits, so the common case adds nothing.
 * Below about three characters there is no honest abbreviation left, so it
 * gives up and returns the ellipsis alone rather than a misleading single
 * letter.
 */
export function truncateToWidth(value: string, fontSize: number, maxWidth: number): string {
  if (estimateTextWidth(value, fontSize) <= maxWidth) return value;

  const perChar = fontSize * 0.58;
  const fits = Math.floor(maxWidth / perChar) - 1;

  if (fits < 1) return '…';
  return `${value.slice(0, fits).trimEnd()}…`;
}

/** The rectangle the data is drawn inside. */
export type PlotArea = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Convenience: `left + width`. */
  right: number;
  /** Convenience: `top + height`. */
  bottom: number;
};

/**
 * How the category labels along the bottom are drawn.
 *
 * Rotation is chosen, not configured. Horizontal labels are easiest to read, so
 * they are used whenever they fit; when they do not, rotating is what keeps a
 * chart of 50 categories legible instead of a grey smear of overlapping text.
 */
export type AxisLabelPlan = {
  rotate: boolean;
  /** Degrees, negative so text tilts up to the right. Zero when not rotated. */
  angle: number;
  /** Room the labels need below the plot. */
  height: number;
  /** Longest label this plan allows before truncation. */
  maxWidth: number;
  /**
   * Draw every `stride`-th label, starting at the first. 1 draws them all.
   *
   * Past a certain density no amount of rotating or shrinking helps: fifty
   * labels in four hundred units cannot all be read, and drawing them anyway
   * produces a grey smudge that is strictly worse than nothing, because it
   * hides that there was ever anything to read. Thinning keeps the axis
   * scannable and leaves the bars to carry the density.
   */
  stride: number;
};

/**
 * Smallest gap between adjacent labels that still reads as two labels.
 *
 * Rotated text needs less horizontal room than upright text - the glyphs run
 * away diagonally - so this is expressed against the font size rather than
 * against label length.
 */
const MIN_LABEL_GAP = LABEL_FONT_SIZE * 1.1;

/** How many labels to skip so the ones that remain are `MIN_LABEL_GAP` apart. */
function strideFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  return Math.max(1, Math.ceil(MIN_LABEL_GAP / step));
}

/**
 * Works out how the category labels can fit in the width available.
 *
 * `step` is the horizontal room one label gets. Three outcomes, in order of
 * preference: they fit as they are; they fit rotated; they are rotated *and*
 * truncated because even rotated they would run off the bottom of the viewBox.
 *
 * Rotated labels are bounded to a quarter of the chart height. Without a bound,
 * one 40-character label turns the entire chart into an axis.
 */
export function planCategoryLabels(
  labels: readonly string[],
  step: number,
  chartHeight: number
): AxisLabelPlan {
  const longest = labels.reduce(
    (widest, label) => Math.max(widest, estimateTextWidth(label, LABEL_FONT_SIZE)),
    0
  );

  if (longest <= step) {
    return {
      rotate: false,
      angle: 0,
      height: LABEL_FONT_SIZE + GUTTER,
      maxWidth: step,
      stride: 1,
    };
  }

  const angle = -45;
  const budget = Math.max(LABEL_FONT_SIZE * 2, chartHeight * 0.25);
  // A label rotated 45° needs its length times sin(45°) of vertical room.
  const projected = longest * SIN_45;

  const height = Math.min(projected, budget) + GUTTER;
  const maxWidth = height / SIN_45;
  const stride = strideFor(step);

  // With labels thinned, the ones left have `stride` bands of room each, so
  // they may well fit upright after all - which is easier to read than a
  // rotated axis, and worth re-checking rather than rotating out of habit.
  if (stride > 1 && longest <= step * stride) {
    return {
      rotate: false,
      angle: 0,
      height: LABEL_FONT_SIZE + GUTTER,
      maxWidth: step * stride,
      stride,
    };
  }

  return { rotate: true, angle, height, maxWidth, stride };
}

/**
 * Computes the plot rectangle from what has to sit around it.
 *
 * The left margin follows the widest value label, because an axis reading in
 * millions needs room a percentage axis does not. Everything else is a fixed
 * gutter plus whatever the caller says the title, legend and category labels
 * need.
 */
export function computePlotArea(input: {
  width: number;
  height: number;
  valueLabels: readonly string[];
  titleHeight: number;
  legendHeight: number;
  categoryLabelHeight: number;
}): PlotArea {
  const { width, height, valueLabels, titleHeight, legendHeight, categoryLabelHeight } = input;

  const widestValue = valueLabels.reduce(
    (widest, label) => Math.max(widest, estimateTextWidth(label, LABEL_FONT_SIZE)),
    0
  );

  const left = widestValue + GUTTER * 2;
  const top = titleHeight + GUTTER;
  // Room on the right so the last category label, drawn centered on the final
  // band, does not overhang the viewBox.
  const rightMargin = GUTTER * 2;
  const bottomMargin = categoryLabelHeight + legendHeight + GUTTER;

  // Clamped to at least 1: a chart sized smaller than its own furniture would
  // otherwise produce a negative width, and every coordinate derived from it
  // comes out backwards rather than merely cramped.
  const plotWidth = Math.max(1, width - left - rightMargin);
  const plotHeight = Math.max(1, height - top - bottomMargin);

  return {
    left,
    top,
    width: plotWidth,
    height: plotHeight,
    right: left + plotWidth,
    bottom: top + plotHeight,
  };
}
