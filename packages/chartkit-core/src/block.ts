/**
 * Chartkit as a Better Blocks block type.
 *
 * Better Blocks accepts block types from other packages through a registration
 * API, and this is Chartkit's half of it: what a chart node looks like inside a
 * document, how to tell a valid one from a broken one, and how to bring an old
 * one up to date.
 *
 * **Why the types here are written out rather than imported.** This package is
 * a leaf: it depends on nothing, which is what lets a static site pull it in
 * without dragging a CMS along. Importing `BlockDefinition` from
 * `@qkix/better-blocks-core` would make Chartkit's core depend on Better
 * Blocks' core, and a chart has no business knowing what a rich-text document
 * is. TypeScript is structural, so the object below satisfies `BlockDefinition`
 * without saying so - and the renderer packages, which legitimately depend on
 * both, assert exactly that. If the two ever drift, their builds fail.
 */

import { migrateChartSpec } from './migrate';
import { CHART_SPEC_VERSION } from './types';
import type { ChartSpec } from './types';
import { validateChartSpec } from './validate';

/** The `type` a chart node carries inside a Better Blocks document. */
export const CHART_BLOCK_TYPE = 'chart';

/**
 * A chart as it is stored in a document.
 *
 * The spec is nested under `spec` rather than spread across the node, so the
 * chart's schema and the document's stay separable - Better Blocks migrates
 * nodes, Chartkit migrates specs, and neither has to know the other's shape.
 */
export type ChartBlockNode = {
  type: 'chart';
  spec: ChartSpec;
  /**
   * The empty text placeholder Slate requires of every element. Not decoration:
   * a void block saved without it takes the editor down.
   */
  children: [{ type: 'text'; text: '' }];
};

/** Builds an empty chart node, for the editor's insert action. */
export function createChartBlock(spec?: Partial<ChartSpec>): ChartBlockNode {
  return {
    type: CHART_BLOCK_TYPE,
    spec: {
      version: CHART_SPEC_VERSION,
      type: 'bar',
      data: { source: 'inline', labels: [], series: [] },
      ...spec,
    } as ChartSpec,
    children: [{ type: 'text', text: '' }],
  };
}

/**
 * The registration, minus the part that draws it.
 *
 * Structurally a `BlockDefinition` from `@qkix/better-blocks-core` - see the
 * note at the top of this file. Each renderer adds its own `component` and
 * hands the result to that renderer's `blockPlugins`.
 */
export const chartBlock = {
  type: CHART_BLOCK_TYPE,

  /** A chart draws entirely from its own attributes, so it is a Slate void. */
  content: 'void' as const,

  /**
   * Checks the nested spec, re-rooting the paths so a reported problem points
   * at where it lives in the *document* rather than at the spec in isolation.
   * An editor showing `data.series[0]` for a chart three blocks down is not
   * telling anyone enough to fix it.
   */
  validate(
    node: { type: string; spec?: unknown; [attribute: string]: unknown },
    context: { path: string; fail: (path: string, message: string) => void }
  ) {
    const result = validateChartSpec(node.spec);
    if (result.valid) return;

    for (const issue of result.issues) {
      const suffix = issue.path ? `.${issue.path}` : '';
      context.fail(`${context.path}.spec${suffix}`, issue.message);
    }
  },

  /**
   * Delegates to the spec's own migrator.
   *
   * Better Blocks walks the document and calls this for every chart node; it
   * never learns what a `ChartSpec` is. That is the whole point of the
   * arrangement - a new chart schema is a Chartkit release, not a Better Blocks
   * one.
   */
  migrate(node: { type: string; spec?: unknown; [attribute: string]: unknown }) {
    const result = migrateChartSpec(node.spec);

    if (result.status === 'unchanged') return { status: 'unchanged' as const };
    if (result.status === 'skipped') {
      return { status: 'skipped' as const, reason: result.reason };
    }

    return { status: 'migrated' as const, node: { ...node, spec: result.spec } };
  },
};
