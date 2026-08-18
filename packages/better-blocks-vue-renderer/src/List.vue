<script setup lang="ts">
/**
 * An ordered, unordered or to-do list. Nested lists arrive as children of the
 * outer list, so this component recurses into itself.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, CustomModifiersConfig, ListNode, StyleValue } from './types';

import ListItem from './ListItem.vue';
import { getListStyleType, rawComponent } from './utils';

const props = defineProps<{
  node: ListNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();

const indentLevel = computed(() => props.node.indentLevel || 0);
const isTodo = computed(() => props.node.format === 'todo');

// The wrapper element and its props; the children are identical in every case,
// so they are written once as slot content.
const wrapper = computed(() => {
  const custom = rawComponent(props.blocks?.list);
  if (custom) return custom;
  if (isTodo.value) return 'ul';
  return props.node.format === 'ordered' ? 'ol' : 'ul';
});

const wrapperProps = computed<Record<string, unknown>>(() => {
  if (props.blocks?.list) return { format: props.node.format, indentLevel: indentLevel.value };
  if (isTodo.value) {
    const style: StyleValue = {
      listStyle: 'none',
      paddingLeft: indentLevel.value > 0 ? '1.5em' : '0',
    };
    return { style };
  }
  const style: StyleValue = {
    listStyleType: getListStyleType(
      props.node.format as 'ordered' | 'unordered',
      indentLevel.value
    ),
  };
  return { style };
});
</script>

<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <template v-for="(child, index) in node.children" :key="index">
      <ListItem
        v-if="child.type === 'list-item'"
        :node="child"
        :is-todo="isTodo"
        :blocks="blocks"
        :modifiers="modifiers"
      />
      <List v-else :node="child" :blocks="blocks" :modifiers="modifiers" />
    </template>
  </component>
</template>
