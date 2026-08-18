<script setup lang="ts">
/**
 * A Mermaid diagram, rendered to SVG on the server.
 *
 * `beautiful-mermaid` turns Mermaid source into an SVG string synchronously and
 * without a browser, so the markup is identical on the server and on the client
 * - the page ships a finished diagram and hydrates over it, with no client-side
 * rendering pass and no mismatch.
 */
import { computed } from 'vue';

import { renderMermaidSVG, THEMES } from 'beautiful-mermaid';

import type { CustomBlocksConfig, DiagramNode, DiagramTheme } from './types';

import { rawComponent } from './utils';

const props = defineProps<{
  node: DiagramNode;
  blocks?: CustomBlocksConfig;
  diagramTheme?: DiagramTheme;
}>();

const DiagramComp = computed(() => rawComponent(props.blocks?.diagram));
const source = computed(() => props.node.value ?? '');
const format = computed(() => props.node.format ?? 'mermaid');

// The palette handed to beautiful-mermaid. Without one it renders monochrome
// (every color derived from a single dark `fg`). The built-in themes only set an
// accent, which colors arrows but leaves node fills/borders near-white - so our
// default mirrors mermaid.js's familiar look: lavender node fills (`surface`)
// with purple borders (`border`) and dark edges (`line`). A theme name selects a
// built-in palette; an object is used as custom colors.
const DEFAULT_DIAGRAM_COLORS = {
  bg: '#ffffff',
  fg: '#333333',
  line: '#333333',
  accent: '#9370db',
  muted: '#666666',
  surface: '#ececff',
  border: '#9370db',
};

const themeOptions = computed(() => {
  const theme = props.diagramTheme;
  if (theme == null) return DEFAULT_DIAGRAM_COLORS;
  if (typeof theme === 'object') return theme;
  return THEMES[theme] ?? DEFAULT_DIAGRAM_COLORS;
});

// It throws on empty or invalid input and on unsupported diagram types (gantt,
// pie, mindmap, gitGraph, …); in that case we fall back to the raw source in a
// <pre> so content is never lost.
const svg = computed<string | null>(() => {
  if (DiagramComp.value || !source.value) return null;
  try {
    const out = renderMermaidSVG(source.value, themeOptions.value);
    return typeof out === 'string' && out.includes('<svg') ? out : null;
  } catch {
    return null;
  }
});
</script>

<template>
  <component :is="DiagramComp" v-if="DiagramComp" :code="source" :format="format" />
  <div v-else-if="svg !== null" class="mermaid-diagram" v-html="svg"></div>
  <pre v-else class="mermaid-source">{{ source }}</pre>
</template>
