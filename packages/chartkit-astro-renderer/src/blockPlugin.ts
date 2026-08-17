/**
 * Chartkit as a Better Blocks block plugin.
 *
 * `chartBlock` in `@qkix/chartkit-core` carries the framework-free half - the
 * type, the validator, the migrator. This adds the Astro component.
 *
 * The `satisfies` below is the load-bearing line: chartkit-core writes its
 * definition structurally rather than importing `BlockDefinition`, because a
 * chart has no business depending on a rich-text document format. This package
 * legitimately depends on both, so this is where the two are checked against
 * each other.
 */

import { chartBlock } from '@qkix/chartkit-core';
import type { AstroBlockPlugin } from '@qkix/better-blocks-astro-renderer';

import ChartBlock from './ChartBlock.astro';

/**
 * The plugin to hand to `BlocksRenderer`'s `blockPlugins`.
 *
 * A constant rather than a factory, unlike the React one: an Astro component
 * reads what it needs from its own props, so there is nothing to close over.
 */
export const chartBlockPlugin = {
  ...chartBlock,
  component: ChartBlock,
} satisfies AstroBlockPlugin;
