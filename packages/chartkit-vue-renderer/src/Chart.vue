<script setup lang="ts">
/**
 * A Chartkit chart, as a Vue component.
 *
 * The work happens in `@qkix/chartkit-core`, which turns a spec into a finished
 * SVG string. This is the thin part - and being thin is the point: the rendered
 * page carries an SVG and nothing else. No hydration work, no client-side chart
 * library, no bytes. The SVG is built synchronously, so the server and the
 * client produce identical markup.
 */
import { computed } from 'vue';

import { renderChart, type ChartSpec } from '@qkix/chartkit-core';

const props = defineProps<{
  spec: ChartSpec;
  /** Locale for number formatting. Worth passing explicitly when building on a server. */
  locale?: string;
  /** Prefix for the ids the accessible name points at. Needed when a page holds several charts. */
  idPrefix?: string;
}>();

// `class`, `style` and anything else the consumer puts on <Chart> is bound to
// the wrapper by hand, so nothing is left dangling when the chart draws nothing.
defineOptions({ inheritAttrs: false });

const result = computed(() =>
  renderChart(props.spec, { locale: props.locale, idPrefix: props.idPrefix })
);

// An invalid spec renders nothing, the same as any other broken content. A
// half-drawn chart would look like real data, which is worse than an absence.
const svg = computed(() => (result.value.ok ? result.value.svg : ''));
</script>

<template>
  <!-- The markup is this library's own output, from a builder that escapes every
       author-controlled value on the way in - see chartkit-core's svg.ts. -->
  <div v-if="svg" v-bind="$attrs" v-html="svg"></div>
</template>
