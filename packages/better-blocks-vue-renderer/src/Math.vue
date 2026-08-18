<script setup lang="ts">
/**
 * A math node, rendered with KaTeX.
 *
 * KaTeX turns LaTeX into HTML synchronously and without a DOM, so this renders
 * the same on the server as in the browser - a Nuxt page ships finished math and
 * hydrates over identical markup, with no client-side typesetting pass.
 */
import { computed } from 'vue';

import katex from 'katex';

import type { CustomBlocksConfig, MathNode } from './types';

import { rawComponent } from './utils';

const props = defineProps<{
  node: MathNode;
  blocks?: CustomBlocksConfig;
}>();

const MathComp = computed(() => rawComponent(props.blocks?.math));
const isBlock = computed(() => props.node.format === 'block');
const formula = computed(() => props.node.value ?? '');
// With `throwOnError: false` KaTeX renders parse errors inline instead of
// throwing; the try/catch is a last-resort guard that falls back to the raw
// LaTeX source, so a broken formula never takes the page down.
const html = computed<string | null>(() => {
  if (MathComp.value) return null;
  try {
    return katex.renderToString(formula.value, {
      displayMode: isBlock.value,
      throwOnError: false,
    });
  } catch {
    return null;
  }
});
</script>

<template>
  <component :is="MathComp" v-if="MathComp" :formula="formula" :inline="!isBlock" />
  <div v-else-if="html !== null && isBlock" class="katex-block" v-html="html"></div>
  <span v-else-if="html !== null" class="katex-inline" v-html="html"></span>
  <div v-else-if="isBlock" class="katex-block">{{ formula }}</div>
  <span v-else class="katex-inline">{{ formula }}</span>
</template>
