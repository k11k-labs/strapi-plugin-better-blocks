<script setup lang="ts">
/**
 * A table. Leading all-header rows become `<thead>`; everything from the first
 * non-header row onward is `<tbody>`.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, CustomModifiersConfig, TableNode, TableRowNode } from './types';

import TableRow from './TableRow.vue';
import { rawComponent } from './utils';

const props = defineProps<{
  node: TableNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();

const TableComp = computed(() => rawComponent(props.blocks?.table));

// A row is a header row when every cell is a header cell.
const isHeaderRow = (row: TableRowNode) =>
  row.children.length > 0 && row.children.every((cell) => cell.type === 'table-header-cell');

const split = computed(() => {
  let index = 0;
  const rows = props.node.children;
  while (index < rows.length && isHeaderRow(rows[index])) index++;
  return index;
});
const headRows = computed(() => props.node.children.slice(0, split.value));
const bodyRows = computed(() => props.node.children.slice(split.value));
</script>

<template>
  <!-- Custom table renderer: keep the flat rows contract the override API has
       always used (no forced thead/tbody split). -->
  <component :is="TableComp" v-if="TableComp">
    <TableRow
      v-for="(row, index) in node.children"
      :key="index"
      :row="row"
      :blocks="blocks"
      :modifiers="modifiers"
    />
  </component>
  <table v-else class="bb-table">
    <thead v-if="headRows.length > 0">
      <TableRow
        v-for="(row, index) in headRows"
        :key="index"
        :row="row"
        :blocks="blocks"
        :modifiers="modifiers"
      />
    </thead>
    <tbody>
      <TableRow
        v-for="(row, index) in bodyRows"
        :key="index"
        :row="row"
        :blocks="blocks"
        :modifiers="modifiers"
      />
    </tbody>
  </table>
</template>

<style>
/* GitHub-style table: bordered cells, a shaded header, zebra-striped body
   rows, and horizontal scroll on overflow. Retheme via the --bb-table-*
   custom properties. */
.bb-table {
  display: block;
  width: max-content;
  max-width: 100%;
  margin: 1rem 0;
  overflow: auto;
  border-collapse: collapse;
  border-spacing: 0;
  border: 1px solid var(--bb-table-border, #d0d7de);
}
.bb-table th,
.bb-table td {
  padding: 0.375rem 0.8125rem;
  border: 1px solid var(--bb-table-border, #d0d7de);
  text-align: left;
}
.bb-table th {
  font-weight: 600;
  background: var(--bb-table-header-bg, #f6f8fa);
}
.bb-table tbody tr {
  background: var(--bb-table-row-bg, #ffffff);
}
.bb-table tbody tr:nth-child(2n) {
  background: var(--bb-table-stripe-bg, #f6f8fa);
}
</style>
