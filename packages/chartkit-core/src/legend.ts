/**
 * The legend.
 *
 * Only worth drawing when there is more than one series: with one, the title
 * already says what the bars are, and a legend restating it is furniture.
 *
 * The interesting part is wrapping. Series names are author-written and can be
 * any length, so a single row of entries runs off the side of the viewBox at
 * the worst possible moment - the chart with eight series, which is exactly the
 * one that needs its legend. So entries are packed into rows here, and the
 * height that falls out is fed back into the layout before the plot is sized.
 */

import { LEGEND_FONT_SIZE, estimateTextWidth } from './layout';
import { element, round, tag, text } from './svg';
import { TEXT_COLOR, seriesColor } from './theme';

/** Side of the color swatch. */
const SWATCH = 10;

/** Gap between a swatch and its label. */
const SWATCH_GAP = 5;

/** Gap between one entry and the next. */
const ENTRY_GAP = 16;

/** Gap between wrapped rows. */
const ROW_GAP = 4;

/** Space above the legend, separating it from the axis labels. */
const TOP_MARGIN = 10;

export type LegendEntry = {
  name: string;
  /** Index into the series, which decides the swatch color. */
  index: number;
  /** Offset from the start of its row. */
  x: number;
  width: number;
};

export type LegendRow = {
  entries: LegendEntry[];
  width: number;
};

export type LegendPlan = {
  rows: LegendRow[];
  /** Total room the legend needs, including the margin above it. */
  height: number;
};

/** The empty plan, for charts that draw no legend. */
export const NO_LEGEND: LegendPlan = { rows: [], height: 0 };

/**
 * Packs series names into rows no wider than `maxWidth`.
 *
 * An entry wider than the whole chart still gets its own row rather than being
 * dropped - it will overflow, but a legend that silently omits a series is
 * worse than one that looks cramped, because the reader has no way to know a
 * color is unexplained.
 */
export function planLegend(names: readonly string[], maxWidth: number): LegendPlan {
  if (names.length < 2) return NO_LEGEND;

  const rows: LegendRow[] = [];
  let current: LegendEntry[] = [];
  let x = 0;

  for (const [index, name] of names.entries()) {
    const width = SWATCH + SWATCH_GAP + estimateTextWidth(name, LEGEND_FONT_SIZE);

    if (current.length > 0 && x + width > maxWidth) {
      rows.push({ entries: current, width: x - ENTRY_GAP });
      current = [];
      x = 0;
    }

    current.push({ name, index, x, width });
    x += width + ENTRY_GAP;
  }

  if (current.length > 0) rows.push({ entries: current, width: x - ENTRY_GAP });

  const height = TOP_MARGIN + rows.length * LEGEND_FONT_SIZE + (rows.length - 1) * ROW_GAP;

  return { rows, height };
}

/**
 * Draws a planned legend, centered under the chart.
 *
 * `top` is where the legend's first row begins; `width` is the full chart
 * width, which each row is centered within.
 */
export function renderLegend(plan: LegendPlan, top: number, width: number): string {
  if (plan.rows.length === 0) return '';

  const rows = plan.rows
    .map((row, rowIndex) => {
      const rowTop = top + TOP_MARGIN + rowIndex * (LEGEND_FONT_SIZE + ROW_GAP);
      const rowLeft = (width - row.width) / 2;

      const entries = row.entries
        .map((entry) => {
          const x = rowLeft + entry.x;

          const swatch = tag('rect', {
            x: round(x),
            // Nudged up so the swatch centers on the text rather than sitting
            // on its baseline.
            y: round(rowTop - SWATCH + 2),
            width: SWATCH,
            height: SWATCH,
            rx: 2,
            fill: seriesColor(entry.index),
          });

          const label = text(entry.name, {
            x: round(x + SWATCH + SWATCH_GAP),
            y: round(rowTop),
          });

          return swatch + label;
        })
        .join('');

      return entries;
    })
    .join('');

  return element(
    'g',
    {
      class: 'chartkit-legend',
      fill: TEXT_COLOR,
      'font-size': LEGEND_FONT_SIZE,
    },
    rows
  );
}
