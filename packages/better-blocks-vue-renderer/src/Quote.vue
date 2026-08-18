<script setup lang="ts">
/**
 * A blockquote.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, CustomModifiersConfig, QuoteNode } from './types';

import Inline from './Inline.vue';
import { getBlockStyle, rawComponent } from './utils';

const props = defineProps<{
  node: QuoteNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();

const QuoteComp = computed(() => rawComponent(props.blocks?.quote));
const style = computed(() => getBlockStyle(props.node));
// Bound as an object so a quote with no alignment renders no `style` attribute
// at all - see the same note in Block.vue.
const styleAttrs = computed(() => (style.value ? { style: style.value } : {}));
</script>

<template>
  <component :is="QuoteComp" v-if="QuoteComp" v-bind="styleAttrs">
    <Inline :nodes="node.children" :blocks="blocks" :modifiers="modifiers" />
  </component>
  <blockquote v-else class="bb-quote" v-bind="styleAttrs">
    <Inline :nodes="node.children" :blocks="blocks" :modifiers="modifiers" />
  </blockquote>
</template>

<style>
/* GitHub-style blockquote: a muted left border with indented, dimmed text.
   Retheme via the --bb-quote-* custom properties without touching markup. */
.bb-quote {
  margin: 1rem 0;
  padding: 0 1rem;
  color: var(--bb-quote-fg, #57606a);
  border-left: 0.25rem solid var(--bb-quote-border, #d0d7de);
}
</style>
