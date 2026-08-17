/**
 * Turning numbers into the strings a reader sees.
 *
 * Axis ticks and value labels both go through here, so a chart cannot end up
 * writing 1200 on the axis and 1.2K on the bar.
 */

import type { ValueFormat } from './types';

/**
 * Builds a formatter for a spec's `valueFormat`.
 *
 * `Intl.NumberFormat` construction is not free and a chart formats every tick
 * and potentially every value, so the formatter is built once per render and
 * passed down rather than constructed per call.
 *
 * A malformed format - an unknown currency, a bad locale - throws inside `Intl`.
 * That is content someone typed into a CMS field, not a programming error, so
 * it falls back to plain number formatting instead of taking the page down.
 */
export function createValueFormatter(
  format: ValueFormat | undefined,
  locale: string | undefined
): (value: number) => string {
  const resolvedLocale = format?.locale ?? locale;

  try {
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      style: format?.style,
      currency: format?.currency,
      minimumFractionDigits: format?.minimumFractionDigits,
      maximumFractionDigits: format?.maximumFractionDigits,
      notation: format?.notation,
    });

    return (value) => formatter.format(value);
  } catch {
    const fallback = new Intl.NumberFormat(undefined);
    return (value) => fallback.format(value);
  }
}

/**
 * Formats axis ticks, guaranteeing that distinct ticks read differently.
 *
 * Two separate problems, both of which produce an axis that misinforms:
 *
 * Ticks come off a scale as values like `0.30000000000000004`, so they are
 * rounded to the precision the step actually carries. Without it an axis reads
 * 0, 0.1, 0.2, 0.30000000000000004.
 *
 * The subtler one is collapsing. `compact` notation writes 1,000,000 and
 * 1,200,000 and 1,400,000 all as "1M" at zero decimals, so an axis climbing
 * through three distinct ticks appears to stall - the same label three times,
 * against three different gridlines. Rounding by step does not help, because
 * the values genuinely differ; what is missing is precision in the *output*.
 * So the whole tick set is formatted, and if two distinct values collide the
 * precision goes up and it tries again.
 *
 * Takes the ticks rather than the step for exactly that reason: whether labels
 * collide is a property of the set, not of any one value.
 */
export function createTickFormatter(
  format: ValueFormat | undefined,
  locale: string | undefined,
  ticks: readonly number[]
): (value: number) => string {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 0;
  const baseDecimals = decimalsFor(step);

  // An explicit maximumFractionDigits in the spec wins outright: the author
  // asked for it, and second-guessing them is worse than a repeated label.
  if (format?.maximumFractionDigits !== undefined) {
    return build(format, locale, format.maximumFractionDigits, baseDecimals);
  }

  // Three extra digits is enough to separate any tick set d3 produces, and
  // stops this from chasing precision forever on pathological input.
  for (let decimals = baseDecimals; decimals <= baseDecimals + 3; decimals++) {
    const candidate = build(format, locale, decimals, decimals);
    if (!collapses(ticks, candidate)) return candidate;
  }

  return build(format, locale, baseDecimals + 3, baseDecimals + 3);
}

function build(
  format: ValueFormat | undefined,
  locale: string | undefined,
  maximumFractionDigits: number,
  roundingDecimals: number
): (value: number) => string {
  const base = createValueFormatter(
    {
      ...format,
      maximumFractionDigits,
      minimumFractionDigits: format?.minimumFractionDigits,
    },
    locale
  );

  return (value) => base(roundTo(value, roundingDecimals));
}

/** Whether two ticks that differ would be written identically. */
function collapses(ticks: readonly number[], formatter: (value: number) => string): boolean {
  const seen = new Map<string, number>();

  for (const tick of ticks) {
    const label = formatter(tick);
    const previous = seen.get(label);
    if (previous !== undefined && previous !== tick) return true;
    seen.set(label, tick);
  }

  return false;
}

/** How many decimals a step of this size needs to be written exactly. */
function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  // A step of 0.25 needs 2; a step of 10 needs 0. Capped because beyond ~10
  // decimals the axis is unreadable anyway and floating point stops helping.
  const magnitude = Math.floor(Math.log10(step));
  return Math.min(Math.max(-magnitude, 0), 10);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
