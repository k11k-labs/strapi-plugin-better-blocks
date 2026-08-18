<script setup lang="ts">
/**
 * Renders a Strapi Blocks document.
 *
 * The only component a consumer mounts; everything below it is chosen by
 * `Block.vue` from the node type. Nothing here is client-only, so a Nuxt page
 * ships the finished markup and hydrates over it.
 */
import { computed } from 'vue';

import type { AnyBlockNode, BlocksRendererProps } from './types';

import Block from './Block.vue';

const props = defineProps<BlocksRendererProps>();

// An absent or malformed `content` renders nothing rather than throwing - a
// draft entry with an empty field is normal, not an error.
const nodes = computed<AnyBlockNode[]>(() =>
  Array.isArray(props.content) ? (props.content as AnyBlockNode[]) : []
);
</script>

<template>
  <Block
    v-for="(node, index) in nodes"
    :key="index"
    :block="node"
    :blocks="blocks"
    :modifiers="modifiers"
    :diagram-theme="diagramTheme"
    :code-theme="codeTheme"
    :code-copy-button="codeCopyButton"
    :block-plugins="blockPlugins"
    :index="index"
  />
</template>
