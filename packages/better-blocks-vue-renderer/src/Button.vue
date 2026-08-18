<script setup lang="ts">
/**
 * A button block: the control itself plus the alignment wrapper around it.
 */
import { computed } from 'vue';

import type { ButtonElement, CustomBlocksConfig } from './types';

import ButtonControl from './ButtonControl.vue';
import { rawComponent } from './utils';

const props = defineProps<{
  node: ButtonElement;
  blocks?: CustomBlocksConfig;
}>();

const ButtonComp = computed(() => rawComponent(props.blocks?.button));
const alignment = computed(() => props.node.alignment ?? 'left');
</script>

<template>
  <component
    :is="ButtonComp"
    v-if="ButtonComp"
    :label="node.label"
    :button-type="node.buttonType"
    :alignment="node.alignment"
    :link="node.link"
    :file="node.file"
    :show-file-size="node.showFileSize"
    :show-file-icon="node.showFileIcon"
    :file-preview="node.filePreview"
    :style="node.style"
    :css-class="node.cssClass"
  />
  <ButtonControl v-else-if="alignment === 'none'" :node="node" />
  <div v-else class="bb-button-wrapper" :style="{ textAlign: alignment, margin: '0.5rem 0' }">
    <ButtonControl :node="node" />
  </div>
</template>
