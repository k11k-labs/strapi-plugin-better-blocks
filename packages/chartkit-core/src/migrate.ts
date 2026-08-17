/**
 * Bringing an old spec up to the current version.
 *
 * A `ChartSpec` lives nested inside a Better Blocks document, so migrating one
 * is Better Blocks walking the document and handing each chart node to this
 * package - it never learns what a spec looks like.
 *
 * | Version | What changed |
 * | ------- | ------------ |
 * | 1       | The first. `options.barMode` chose grouped or stacked bars. |
 * | 2       | `barMode` became `stackMode`, because stacking now applies to area charts too and an option named after bars that also governs areas misleads every reader of it. |
 */

import { CHART_SPEC_VERSION } from './types';
import type { ChartSpec } from './types';

export type ChartMigrationResult =
  | { status: 'unchanged'; spec: ChartSpec }
  | { status: 'migrated'; spec: ChartSpec }
  | { status: 'skipped'; reason: string };

/**
 * Migrates one spec.
 *
 * Returns a reason rather than throwing when it will not touch something: this
 * runs across a whole document, and one unreadable chart must not abort the
 * migration of the other forty.
 */
export function migrateChartSpec(value: unknown): ChartMigrationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { status: 'skipped', reason: 'chart spec is not an object' };
  }

  const spec = value as Partial<ChartSpec>;
  const version = spec.version;

  if (version === CHART_SPEC_VERSION) {
    return { status: 'unchanged', spec: spec as ChartSpec };
  }

  if (typeof version !== 'number') {
    // Every spec this package has ever written carries a version. One without
    // is either hand-edited or from something else entirely, and guessing at
    // its shape risks silently rewriting data.
    return { status: 'skipped', reason: 'chart spec has no version marker' };
  }

  if (version > CHART_SPEC_VERSION) {
    return {
      status: 'skipped',
      reason: `chart spec is version ${version}, newer than this build understands (${CHART_SPEC_VERSION})`,
    };
  }

  if (version === 1) return { status: 'migrated', spec: toVersion2(spec) };

  return {
    status: 'skipped',
    reason: `no migration path from chart spec version ${version}`,
  };
}

/**
 * Version 1 to 2: `options.barMode` becomes `options.stackMode`.
 *
 * A rename only. The values are unchanged, so nothing about how a chart looks
 * moves - which is the kind of migration worth doing eagerly rather than
 * carrying a second name forever.
 */
function toVersion2(spec: Partial<ChartSpec> & { options?: Record<string, unknown> }): ChartSpec {
  const { barMode, ...options } = spec.options ?? {};

  return {
    ...spec,
    version: 2,
    options: {
      ...options,
      // An existing stackMode wins, in the unlikely event a spec carries both.
      ...(options.stackMode === undefined && barMode !== undefined ? { stackMode: barMode } : {}),
    },
  } as ChartSpec;
}
