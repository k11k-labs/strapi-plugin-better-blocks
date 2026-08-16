/**
 * Chartkit as a Better Blocks block plugin.
 *
 * `chartBlock` in `@qkix/chartkit-core` carries the framework-free half — the
 * type, the validator, the migrator. This adds the half only React can supply.
 *
 * The `satisfies` below is the load-bearing line: chartkit-core writes its
 * definition structurally rather than importing `BlockDefinition`, because a
 * chart has no business depending on a rich-text document format. This package
 * legitimately depends on both, so this is where the two are checked against
 * each other. If Better Blocks changes the contract, this build fails.
 */

import { chartBlock, type ChartSpec } from '@qkix/chartkit-core';
import type { BlockPlugin, CustomBlockProps } from '@qkix/better-blocks-react-renderer';

import { Chart } from './Chart';

export type ChartBlockOptions = {
  locale?: string;
};

/**
 * Builds the plugin to hand to `BlocksRenderer`'s `blockPlugins`.
 *
 * A function rather than a constant so the locale can be passed in — the chart
 * needs it and the block does not otherwise carry one.
 */
export function chartBlockPlugin(options: ChartBlockOptions = {}): BlockPlugin {
  return {
    ...chartBlock,
    component: ({ node }: CustomBlockProps) => (
      <Chart
        spec={node.spec as ChartSpec}
        locale={options.locale}
        // Charts in one document must not share the ids their accessible names
        // point at. There is no node id to lean on, so the type and title are
        // the most stable thing available.
        idPrefix={`chartkit-${slug(String((node.spec as ChartSpec)?.title ?? 'chart'))}`}
      />
    ),
  } satisfies BlockPlugin;
}

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'chart';
