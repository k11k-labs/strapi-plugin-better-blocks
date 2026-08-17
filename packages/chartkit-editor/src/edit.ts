/**
 * Every edit the grid can make, as a pure function.
 *
 * Kept out of the components on purpose. Editing a chart is mostly array
 * surgery - insert a column here, keep every series the same length, do not
 * lose a `null` that means "no reading" - and that is exactly the kind of code
 * that is miserable to test through a rendered table and trivial to test
 * directly.
 *
 * Every function returns a new spec. Strapi's form state compares by reference
 * to decide whether a document is dirty, so mutating in place would leave the
 * editor showing changes the save button does not know about.
 */

import type { ChartSpec, ChartType, Series } from '@qkix/chartkit-core';

/** A value as it exists in the grid: a number, or a hole. */
export type CellValue = number | null;

/**
 * Pads or trims every series so each has exactly one value per label.
 *
 * The invariant the rest of this file relies on. A ragged spec is not invalid -
 * the core renders what it has and the validator only warns - but it makes
 * every subsequent edit ambiguous: inserting a column at index 3 means nothing
 * if one series has two values and another has nine.
 *
 * Padding uses `null`, not `0`. A series that has no reading for a category has
 * no reading; writing a zero would invent a measurement.
 */
export function normalizeShape(spec: ChartSpec): ChartSpec {
  const width = spec.data.labels.length;

  const series = spec.data.series.map((one) => ({
    ...one,
    values: Array.from({ length: width }, (_, i) => one.values[i] ?? null),
  }));

  return { ...spec, data: { ...spec.data, series } };
}

/** Replaces one cell. */
export function setCell(
  spec: ChartSpec,
  seriesIndex: number,
  valueIndex: number,
  value: CellValue
): ChartSpec {
  const series = spec.data.series.map((one, i) =>
    i === seriesIndex
      ? { ...one, values: one.values.map((v, j) => (j === valueIndex ? value : v)) }
      : one
  );

  return { ...spec, data: { ...spec.data, series } };
}

/** Renames a category. */
export function setLabel(spec: ChartSpec, index: number, label: string): ChartSpec {
  const labels = spec.data.labels.map((l, i) => (i === index ? label : l));
  return { ...spec, data: { ...spec.data, labels } };
}

/** Renames a series. */
export function setSeriesName(spec: ChartSpec, index: number, name: string): ChartSpec {
  const series = spec.data.series.map((one, i) => (i === index ? { ...one, name } : one));
  return { ...spec, data: { ...spec.data, series } };
}

/** Appends a category, with no reading in any series yet. */
export function addRow(spec: ChartSpec): ChartSpec {
  const labels = [...spec.data.labels, nextLabel(spec.data.labels)];
  const series = spec.data.series.map((one) => ({ ...one, values: [...one.values, null] }));

  return { ...spec, data: { ...spec.data, labels, series } };
}

/** Removes a category, and its value in every series. */
export function removeRow(spec: ChartSpec, index: number): ChartSpec {
  const labels = spec.data.labels.filter((_, i) => i !== index);
  const series = spec.data.series.map((one) => ({
    ...one,
    values: one.values.filter((_, i) => i !== index),
  }));

  return { ...spec, data: { ...spec.data, labels, series } };
}

/** Appends a series, sized to match the categories. */
export function addSeries(spec: ChartSpec): ChartSpec {
  const one: Series = {
    name: nextSeriesName(spec.data.series),
    values: spec.data.labels.map(() => null),
  };

  return { ...spec, data: { ...spec.data, series: [...spec.data.series, one] } };
}

/**
 * Removes a series.
 *
 * Refuses to remove the last one: a chart with no series has nothing to draw,
 * and an editor that lets you reach that state has to explain how to get out of
 * it. Adding a series back is a click; recovering a deleted one is not.
 */
export function removeSeries(spec: ChartSpec, index: number): ChartSpec {
  if (spec.data.series.length <= 1) return spec;

  return {
    ...spec,
    data: { ...spec.data, series: spec.data.series.filter((_, i) => i !== index) },
  };
}

/**
 * Changes the chart type.
 *
 * Switching to a pie or a donut drops every series but the first, because those
 * types show one series as shares of a whole and the core's validator refuses
 * more. Doing it here, visibly, is better than letting the author save
 * something that will not render - but it is a data loss, so the editor warns
 * before offering it.
 */
export function setType(spec: ChartSpec, type: ChartType): ChartSpec {
  const isRadial = type === 'pie' || type === 'donut';

  if (!isRadial || spec.data.series.length <= 1) return { ...spec, type };

  return { ...spec, type, data: { ...spec.data, series: spec.data.series.slice(0, 1) } };
}

/**
 * Whether the spec has a single number anywhere in it.
 *
 * Not a validity check - a spec with none is perfectly valid and renders an
 * empty frame. It is the difference between a chart worth drawing and one worth
 * describing in words, which is a question the preview has to answer.
 */
export function hasAnyValue(spec: ChartSpec): boolean {
  return spec.data.series.some((one) =>
    one.values.some((value) => typeof value === 'number' && Number.isFinite(value))
  );
}

/** Whether switching to `type` would discard data. */
export function typeChangeDiscardsSeries(spec: ChartSpec, type: ChartType): boolean {
  return (type === 'pie' || type === 'donut') && spec.data.series.length > 1;
}

/** Replaces the data wholesale, keeping the chart's own settings. */
export function replaceData(
  spec: ChartSpec,
  labels: string[],
  series: Series[],
  source?: Partial<ChartSpec['data']>
): ChartSpec {
  return {
    ...spec,
    data: { ...spec.data, ...source, labels, series } as ChartSpec['data'],
  };
}

/** `Category 3` for a third unnamed category, skipping names already taken. */
function nextLabel(labels: readonly string[]): string {
  for (let n = labels.length + 1; ; n++) {
    const candidate = `Category ${n}`;
    if (!labels.includes(candidate)) return candidate;
  }
}

function nextSeriesName(series: readonly Series[]): string {
  for (let n = series.length + 1; ; n++) {
    const candidate = `Series ${n}`;
    if (!series.some((one) => one.name === candidate)) return candidate;
  }
}
