<script setup lang="ts">
/**
 * The inline children of a block: text, links, and inline math.
 */
import type { CustomBlocksConfig, CustomModifiersConfig, InlineNode } from './types';

import Math from './Math.vue';
import Text from './Text.vue';

defineProps<{
  nodes: InlineNode[];
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();
</script>

<template>
  <template v-for="(child, index) in nodes" :key="index">
    <Text v-if="child.type === 'text'" :node="child" :modifiers="modifiers" />
    <Math v-else-if="child.type === 'math'" :node="child" :blocks="blocks" />
    <component
      :is="blocks?.link"
      v-else-if="child.type === 'link' && blocks?.link"
      :url="child.url"
      :target="child.target"
      :rel="child.rel"
    >
      <Text
        v-for="(textNode, textIndex) in child.children"
        :key="textIndex"
        :node="textNode"
        :modifiers="modifiers"
      />
    </component>
    <a v-else-if="child.type === 'link'" :href="child.url" :target="child.target" :rel="child.rel">
      <Text
        v-for="(textNode, textIndex) in child.children"
        :key="textIndex"
        :node="textNode"
        :modifiers="modifiers"
      />
    </a>
  </template>
</template>
