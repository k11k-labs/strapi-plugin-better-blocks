<script setup lang="ts">
/**
 * One list item. To-do items render a read-only checkbox and strike through
 * their text when checked, matching the editor.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, CustomModifiersConfig, ListItemNode, StyleValue } from './types';

import Inline from './Inline.vue';
import { rawComponent } from './utils';

const props = defineProps<{
  node: ListItemNode;
  isTodo: boolean;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();

const ListItemComp = computed(() => rawComponent(props.blocks?.['list-item']));
const checked = computed(() => props.node.checked ?? false);
// `checked` is only meaningful in a to-do list; a plain item passes nothing so
// a custom renderer can tell "unchecked" from "not a to-do".
const checkedProp = computed(() => (props.isTodo ? props.node.checked : undefined));
// An unchecked item gets no `style` attribute at all, so bind the whole object.
const textStyleAttrs = computed(() =>
  checked.value ? { style: { textDecoration: 'line-through', opacity: '0.6' } as StyleValue } : {}
);
</script>

<template>
  <component :is="ListItemComp" v-if="ListItemComp" :checked="checkedProp">
    <Inline :nodes="node.children" :blocks="blocks" :modifiers="modifiers" />
  </component>
  <li v-else-if="isTodo" :style="{ listStyle: 'none' }">
    <input type="checkbox" :checked="checked" readonly :style="{ marginRight: '0.5em' }" />
    <span v-bind="textStyleAttrs">
      <Inline :nodes="node.children" :blocks="blocks" :modifiers="modifiers" />
    </span>
  </li>
  <li v-else>
    <Inline :nodes="node.children" :blocks="blocks" :modifiers="modifiers" />
  </li>
</template>
