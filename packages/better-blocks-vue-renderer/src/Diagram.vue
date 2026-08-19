<script setup lang="ts">
/**
 * A Mermaid diagram, rendered to inline SVG by mermaid.js on the client.
 *
 * mermaid needs a real DOM to measure text, so unlike KaTeX it cannot render
 * during SSR. The server and the first client render both emit the raw source
 * in a `<pre>` - so hydration matches - and the SVG is swapped in after mount.
 * This mirrors the React renderer, and it is what makes the output match
 * mermaid.js exactly: rendering to SVG on the server needs a reimplementation
 * of mermaid's layout, which disagreed with the real thing on, among others,
 * flowcharts containing a cycle and the closing actor row of sequence diagrams.
 *
 * If mermaid fails to parse the diagram the raw source simply stays put, so
 * content is never lost.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { applyDiagramTheme } from '@qkix/better-blocks-core';

import type { CustomBlocksConfig, DiagramNode, DiagramTheme } from './types';

import { loadMermaid, nextDiagramId } from './mermaid';
import { rawComponent } from './utils';

const props = defineProps<{
  node: DiagramNode;
  blocks?: CustomBlocksConfig;
  diagramTheme?: DiagramTheme;
}>();

const DiagramComp = computed(() => rawComponent(props.blocks?.diagram));
const source = computed(() => props.node.value ?? '');
const format = computed(() => props.node.format ?? 'mermaid');

// Identity of the theme as a plain string. Watching the prop itself would
// re-render on every parent update for the very common `:diagram-theme="{ … }"`
// inline object, which is a new reference each time.
const themeKey = computed(() =>
  props.diagramTheme == null || typeof props.diagramTheme === 'string'
    ? (props.diagramTheme ?? '')
    : JSON.stringify(props.diagramTheme)
);

const svg = ref<string | null>(null);

// Bumped on every (re-)render and on unmount, so a render that resolves after
// the source changed - or after the component is gone - drops its result.
let generation = 0;

async function renderDiagram() {
  const token = ++generation;
  svg.value = null;

  if (DiagramComp.value || !source.value) return;

  try {
    const mermaid = await loadMermaid();
    // The theme rides along in an `%%{init}%%` directive rather than through
    // `mermaid.initialize`, whose config is global and shared by every diagram
    // on the page.
    const themed = applyDiagramTheme(source.value, props.diagramTheme);
    const { svg: rendered } = await mermaid.render(nextDiagramId(), themed);
    if (token === generation) svg.value = rendered;
  } catch {
    // Leave the raw-source fallback in place on parse/render errors.
  }
}

onMounted(renderDiagram);
watch([source, themeKey], renderDiagram);
onBeforeUnmount(() => {
  generation++;
});
</script>

<template>
  <component :is="DiagramComp" v-if="DiagramComp" :code="source" :format="format" />
  <div v-else-if="svg" class="mermaid-diagram" v-html="svg"></div>
  <pre v-else class="mermaid-source">{{ source }}</pre>
</template>
