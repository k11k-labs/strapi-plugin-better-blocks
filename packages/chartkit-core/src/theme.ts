/**
 * Colour, expressed so the page decides it.
 *
 * This is the reason Chartkit renders its own SVG instead of wrapping an
 * existing chart library. Libraries that render on the server bake colours into
 * the markup, which means the colours are chosen where the chart is built — on
 * the server — while the reader's light or dark preference is known in the
 * browser, usually as a class on `<html>` flipped by a toggle. Serving baked
 * colours to that leaves you rendering two copies, or falling back to
 * `prefers-color-scheme` and ignoring the toggle.
 *
 * So every colour here is a `var()` with a fallback. The chart inherits the
 * page's theme by doing nothing at all, and a site that wants its own palette
 * sets the custom properties in its own stylesheet — no rebuild, no rerender.
 */

/**
 * Fallback palette, used only when a page defines no `--chart-series-N`.
 *
 * Chosen to stay distinguishable on both light and dark backgrounds, since a
 * default cannot know which it is landing on. A real site should override
 * these; they exist so an unstyled chart is legible rather than beautiful.
 */
const FALLBACK_SERIES_COLORS = [
  '#4269d0',
  '#efb118',
  '#ff725c',
  '#6cc5b0',
  '#3ca951',
  '#ff8ab7',
  '#a463f2',
  '#97bbf5',
];

/**
 * The paint for series `index`, as a CSS value.
 *
 * Wraps around when there are more series than palette entries. Running out of
 * distinguishable colours is a data problem rather than a rendering one — eight
 * series on one chart is already more than most readers can follow — so this
 * repeats rather than generating ever-closer hues that only look distinct.
 */
export function seriesColor(index: number): string {
  const fallback = FALLBACK_SERIES_COLORS[index % FALLBACK_SERIES_COLORS.length];
  return `var(--chart-series-${index + 1}, ${fallback})`;
}

/**
 * Ink for axis lines, ticks and rules.
 *
 * Falls back to `currentColor` so that, absent any custom property, the chart's
 * furniture takes the surrounding text colour — which is already correct in
 * both themes, because the page set it.
 */
export const AXIS_COLOR = 'var(--chart-axis, currentColor)';

/** Ink for text: titles, axis labels, legend entries. */
export const TEXT_COLOR = 'var(--chart-text, currentColor)';

/**
 * Gridlines, which must read as background rather than data.
 *
 * `currentColor` at low opacity rather than a grey, so the line stays subtle
 * against a light or a dark page instead of disappearing into one of them.
 */
export const GRID_COLOR = 'var(--chart-grid, currentColor)';

/** Opacity applied to gridlines. See {@link GRID_COLOR}. */
export const GRID_OPACITY = 0.15;
