/**
 * Bringing an old spec up to the current version.
 *
 * There is nothing to migrate yet — version 1 is the first — and that is
 * exactly when this has to exist. A `ChartSpec` lives nested inside a Better
 * Blocks document, so migrating it is Better Blocks walking the document and
 * handing each chart node to this package. That contract has to be in place
 * before anyone stores a spec, because adding it afterwards means changing the
 * block registration API, which is a breaking change in someone else's package.
 *
 * So the shape below is the point, not the (currently empty) list of steps.
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

  // Unreachable while 1 is the only version: anything below it does not exist.
  // The branch stays so that adding version 2 is a matter of filling in steps
  // here rather than reshaping the function.
  return {
    status: 'skipped',
    reason: `no migration path from chart spec version ${version}`,
  };
}
