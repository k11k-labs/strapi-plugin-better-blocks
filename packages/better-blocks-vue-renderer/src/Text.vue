<script setup lang="ts">
/**
 * One text node, wrapped in its marks outer → inner.
 *
 * The recursion is the wrapping: each level renders the outermost remaining
 * mark and hands the rest to itself, so a bold + colored + code span nests in
 * the same order here as in the React and Astro renderers.
 */
import { computed } from 'vue';

import type { CustomModifiersConfig, TextNode } from './types';
import {
  buildTextMarks,
  getDefaultMarkRender,
  getModifierProps,
  rawComponent,
  type Mark,
} from './utils';

const props = defineProps<{
  node: TextNode;
  modifiers?: CustomModifiersConfig;
  /** Remaining marks to apply, outer → inner. Built from `node` on first call. */
  marks?: Mark[];
}>();

const activeMarks = computed<Mark[]>(() => props.marks ?? buildTextMarks(props.node));
const rest = computed<Mark[]>(() => activeMarks.value.slice(1));

// The wrapper for the outermost remaining mark: a custom modifier component if
// one is configured, otherwise the default element for that mark.
const wrapper = computed(() => {
  const current = activeMarks.value[0];
  if (!current) return null;
  const custom = props.modifiers?.[current.name as keyof CustomModifiersConfig];
  if (custom) return rawComponent(custom);
  return getDefaultMarkRender(current).tag;
});

const wrapperProps = computed<Record<string, unknown>>(() => {
  const current = activeMarks.value[0];
  if (!current) return {};
  if (props.modifiers?.[current.name as keyof CustomModifiersConfig]) {
    return getModifierProps(current);
  }
  const { style } = getDefaultMarkRender(current);
  return style ? { style } : {};
});
</script>

<template>
  <component :is="wrapper" v-if="wrapper" v-bind="wrapperProps"
    ><Text :node="node" :modifiers="modifiers" :marks="rest"
  /></component>
  <template v-else>{{ node.text }}</template>
</template>
