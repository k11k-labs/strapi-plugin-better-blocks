/**
 * Getting a chart in and out of a Strapi field value.
 *
 * Small, and separated out anyway, because it is where the field can lose
 * someone's work. Strapi hands a custom field whatever is in the document: a
 * JSON string on one code path and an already-parsed object on another, `null`
 * for a new entry, and - for a field that used to be something else, or a
 * document written by an import script - text that is not a chart at all.
 *
 * None of that may throw. A field that throws while rendering takes the whole
 * edit view down, and the author loses every other field on the page along with
 * this one.
 */

import { CHART_SPEC_VERSION, migrateChartSpec, type ChartSpec } from '@qkix/chartkit-core';

/**
 * What a stored value turned out to be.
 *
 * `empty` and `unreadable` are deliberately different. Empty is a field nobody
 * has filled in yet and the answer is an invitation to make a chart. Unreadable
 * is data that exists and is not a chart, where quietly showing that same
 * invitation would be an offer to overwrite it.
 */
export type ReadValue =
  | { status: 'empty' }
  | { status: 'ok'; spec: ChartSpec }
  | { status: 'unreadable'; reason: string };

/**
 * Reads the stored value into a spec.
 *
 * Migrates on the way in, so an author opening a chart saved against an older
 * schema edits the current shape and saves the current shape. `renderChart`
 * migrates in memory too, which is what keeps the published page correct in the
 * meantime - but a document only stops being old once someone writes it back.
 */
export function readValue(value: unknown): ReadValue {
  if (value === null || value === undefined || value === '') return { status: 'empty' };

  let raw: unknown = value;

  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return {
        status: 'unreadable',
        reason: 'This field contains text that is not JSON.',
      };
    }
    // `null` and `""` survive a round trip through JSON, so an empty field that
    // was saved as a string lands here rather than in the check above.
    if (raw === null || raw === '') return { status: 'empty' };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      status: 'unreadable',
      reason: 'This field contains JSON that is not a chart.',
    };
  }

  const migration = migrateChartSpec(raw);

  if (migration.status === 'skipped') {
    // The migrator's reasons are written for a log line, so they are folded
    // into a sentence rather than shown to an author on their own.
    return {
      status: 'unreadable',
      reason: `Chartkit cannot read what is in this field: ${migration.reason}.`,
    };
  }

  return { status: 'ok', spec: migration.spec };
}

/**
 * The value to store.
 *
 * A string, because Strapi's `json` custom fields are read back as strings and
 * writing an object here makes the field's own round trip asymmetric - it would
 * work until the page is reloaded.
 */
export function writeValue(spec: ChartSpec): string {
  return JSON.stringify(spec);
}

/**
 * The chart a new field starts from.
 *
 * Not empty. An empty chart renders as an error panel, which is a poor first
 * impression of a field someone just added, and a grid with no rows gives
 * nothing to paste over or type into. Four quarters and one series is the
 * smallest thing that is recognisably a chart.
 */
export function starterSpec(): ChartSpec {
  return {
    version: CHART_SPEC_VERSION,
    type: 'bar',
    data: {
      source: 'inline',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [{ name: 'Series 1', values: [null, null, null, null] }],
    },
  };
}
