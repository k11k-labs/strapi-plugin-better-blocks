/**
 * Checking a spec before anything tries to draw it.
 *
 * The bar is the same one Better Blocks' document validator sets: verify what a
 * renderer will crash or lie on, and leave alone what it can survive not
 * knowing. An unrecognized option is forward compatibility — a newer editor
 * wrote it — while a series holding strings is corruption, because the geometry
 * is computed from those numbers.
 */

import { CHART_SPEC_VERSION } from './types';
import type { ChartSpec, ChartType } from './types';

export type ChartIssue = {
  /** Where the problem is, e.g. `data.series[1].values[3]`. */
  path: string;
  message: string;
};

export type ChartValidationResult = {
  valid: boolean;
  issues: ChartIssue[];
};

/**
 * Chart types with a renderer in this build.
 *
 * Narrower than {@link ChartType}, which spans everything planned. A spec
 * naming a type that exists in the union but has no renderer yet is rejected
 * here, so it surfaces as a stated reason rather than an empty box.
 */
const IMPLEMENTED_TYPES = new Set<ChartType>(['bar']);

const DATA_SOURCES = new Set(['inline', 'media']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates a chart specification.
 *
 * Reports every problem it finds, with a path, rather than stopping at the
 * first — an editor showing one error at a time makes fixing a pasted
 * spreadsheet a game of whack-a-mole.
 */
export function validateChartSpec(value: unknown): ChartValidationResult {
  const issues: ChartIssue[] = [];
  const fail = (path: string, message: string) => {
    issues.push({ path, message });
  };

  if (!isObject(value)) {
    return {
      valid: false,
      issues: [{ path: '', message: 'chart spec must be an object' }],
    };
  }

  if (value.version !== CHART_SPEC_VERSION) {
    fail(
      'version',
      `unsupported chart spec version ${String(value.version)}; this build writes ${CHART_SPEC_VERSION}`
    );
  }

  const type = value.type;
  if (typeof type !== 'string') {
    fail('type', 'chart type must be a string');
  } else if (!IMPLEMENTED_TYPES.has(type as ChartType)) {
    fail('type', `chart type "${type}" is not supported by this version`);
  }

  if (value.title !== undefined && typeof value.title !== 'string') {
    fail('title', 'title must be a string');
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    fail('description', 'description must be a string');
  }

  validateData(value.data, fail);

  if (value.options !== undefined && !isObject(value.options)) {
    fail('options', 'options must be an object');
  }

  return { valid: issues.length === 0, issues };
}

function validateData(data: unknown, fail: (path: string, message: string) => void): void {
  if (!isObject(data)) return fail('data', 'data must be an object');

  const source = data.source;
  if (typeof source !== 'string' || !DATA_SOURCES.has(source)) {
    fail('data.source', `unknown data source "${String(source)}"`);
  }

  if (!Array.isArray(data.labels)) {
    fail('data.labels', 'labels must be an array');
  } else {
    data.labels.forEach((label, i) => {
      if (typeof label !== 'string') fail(`data.labels[${i}]`, 'label must be a string');
    });
  }

  if (!Array.isArray(data.series)) {
    return fail('data.series', 'series must be an array');
  }

  const labelCount = Array.isArray(data.labels) ? data.labels.length : 0;

  data.series.forEach((series, i) => {
    const path = `data.series[${i}]`;

    if (!isObject(series)) return fail(path, 'series must be an object');
    if (typeof series.name !== 'string') fail(`${path}.name`, 'series name must be a string');

    if (!Array.isArray(series.values)) {
      return fail(`${path}.values`, 'series values must be an array');
    }

    series.values.forEach((entry, j) => {
      if (entry === null) return;
      if (typeof entry !== 'number') {
        return fail(`${path}.values[${j}]`, 'value must be a number or null');
      }
      // NaN and Infinity would propagate into every coordinate derived from
      // them and produce an SVG full of NaN, which renders as nothing at all
      // and gives no clue why.
      if (!Number.isFinite(entry)) {
        fail(`${path}.values[${j}]`, 'value must be finite');
      }
    });

    // Not fatal — a shorter series is drawn as far as it goes, which is more
    // useful than refusing the whole chart — but it is almost always a paste
    // that went wrong, so it is worth saying.
    if (labelCount > 0 && series.values.length !== labelCount) {
      fail(
        `${path}.values`,
        `series has ${series.values.length} values but there are ${labelCount} labels`
      );
    }
  });
}

/** Narrowing form of {@link validateChartSpec}, for use at a trust boundary. */
export function isChartSpec(value: unknown): value is ChartSpec {
  return validateChartSpec(value).valid;
}
