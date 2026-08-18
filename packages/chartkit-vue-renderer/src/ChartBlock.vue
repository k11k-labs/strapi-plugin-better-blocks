<script setup lang="ts">
/**
 * Adapts a Better Blocks chart node to the Chart component.
 *
 * Better Blocks hands a registered block its whole node, since it cannot know
 * what attributes the block has. Chart takes a spec. This is the one line
 * between them.
 */
import { computed } from 'vue';

import type { ChartSpec } from '@qkix/chartkit-core';

import Chart from './Chart.vue';

const props = defineProps<{
  node: { spec?: ChartSpec; [attribute: string]: unknown };
}>();

const spec = computed(() => props.node.spec);

// Charts in one document must not share the ids their accessible names point
// at. There is no node id to lean on, so the title is the most stable thing
// available.
const idPrefix = computed(() => {
  const slug =
    String(spec.value?.title ?? 'chart')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'chart';
  return `chartkit-${slug}`;
});
</script>

<template>
  <Chart v-if="spec" :spec="spec" :id-prefix="idPrefix" />
</template>
