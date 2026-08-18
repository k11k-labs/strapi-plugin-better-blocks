<script setup lang="ts">
/**
 * A collapsible disclosure. Zero client-side JavaScript - the open/closed state
 * is handled natively by `<details>`/`<summary>`.
 */
import { computed } from 'vue';

import type {
  CustomBlocksConfig,
  CustomModifiersConfig,
  DetailsNode,
  DiagramTheme,
  VueBlockPlugin,
} from './types';

import Block from './Block.vue';
import { rawComponent } from './utils';

const props = defineProps<{
  node: DetailsNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  diagramTheme?: DiagramTheme;
  codeTheme?: string;
  codeCopyButton?: boolean;
  blockPlugins?: readonly VueBlockPlugin[];
}>();

const DetailsComp = computed(() => rawComponent(props.blocks?.details));
</script>

<template>
  <component
    :is="DetailsComp"
    v-if="DetailsComp"
    :summary="node.summary"
    :default-open="node.defaultOpen"
  >
    <Block
      v-for="(child, index) in node.children"
      :key="index"
      :block="child"
      :blocks="blocks"
      :modifiers="modifiers"
      :diagram-theme="diagramTheme"
      :code-theme="codeTheme"
      :code-copy-button="codeCopyButton"
      :block-plugins="blockPlugins"
      :index="index"
    />
  </component>
  <details v-else class="bb-details" :open="node.defaultOpen">
    <summary class="bb-details-summary">{{ node.summary }}</summary>
    <div class="bb-details-body">
      <Block
        v-for="(child, index) in node.children"
        :key="index"
        :block="child"
        :blocks="blocks"
        :modifiers="modifiers"
        :diagram-theme="diagramTheme"
        :code-theme="codeTheme"
        :code-copy-button="codeCopyButton"
        :block-plugins="blockPlugins"
        :index="index"
      />
    </div>
  </details>
</template>

<style>
/* GitHub-inspired collapsible. */
.bb-details {
  border: 1px solid var(--bb-details-border, #d0d7de);
  border-radius: 6px;
  margin: 1rem 0;
  background: var(--bb-details-bg, #fff);
}
.bb-details-summary {
  cursor: pointer;
  padding: 0.5rem 1rem;
  font-weight: 600;
  list-style: none;
  border-radius: 6px;
  background: var(--bb-details-summary-bg, #f6f8fa);
}
/* Hide the browser's native disclosure triangle and draw our own that
   rotates when the disclosure is open. */
.bb-details-summary::-webkit-details-marker {
  display: none;
}
.bb-details-summary::before {
  content: '\25B8';
  display: inline-block;
  margin-right: 0.5rem;
  color: var(--bb-details-marker, #57606a);
  transition: transform 0.15s ease;
}
.bb-details[open] > .bb-details-summary::before {
  transform: rotate(90deg);
}
.bb-details[open] > .bb-details-summary {
  border-bottom: 1px solid var(--bb-details-border, #d0d7de);
  border-radius: 6px 6px 0 0;
}
/* Inset the body content and collapse its outer margins so it sits flush
   within the box (top/bottom balanced). */
.bb-details-body {
  padding: 0.5rem 1rem;
}
.bb-details-body > :first-child {
  margin-top: 0;
}
.bb-details-body > :last-child {
  margin-bottom: 0;
}
</style>
