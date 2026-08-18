<script setup lang="ts">
/**
 * One table row and its cells.
 *
 * Split out of `Table.vue` because the same row markup is needed in three
 * places - a custom table's flat children, `<thead>` and `<tbody>` - and a
 * component is how a Vue template shares markup.
 */
import { computed, type Component } from 'vue';

import type {
  CustomBlocksConfig,
  CustomModifiersConfig,
  StyleValue,
  TableCellNode,
  TableHeaderCellNode,
  TableRowNode,
} from './types';

import Inline from './Inline.vue';
import { rawComponent } from './utils';

type Cell = TableCellNode | TableHeaderCellNode;

const props = defineProps<{
  row: TableRowNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
}>();

const rowWrapper = computed<Component | string>(
  () => rawComponent(props.blocks?.['table-row']) ?? 'tr'
);

const isHeader = (cell: Cell) => cell.type === 'table-header-cell';

/** The custom component for this cell, or the element that stands in for it. */
const cellWrapper = (cell: Cell): Component | string => {
  const custom = isHeader(cell)
    ? props.blocks?.['table-header-cell']
    : props.blocks?.['table-cell'];
  if (custom) return rawComponent(custom);
  return isHeader(cell) ? 'th' : 'td';
};

/**
 * Props for one cell. A custom renderer gets the raw attributes; a plain
 * `<th>`/`<td>` gets the HTML spelling of them - `align` as a style (it is
 * omitted when left), and the spans only past 1, where they carry meaning.
 */
const cellProps = (cell: Cell): Record<string, unknown> => {
  const custom = isHeader(cell)
    ? props.blocks?.['table-header-cell']
    : props.blocks?.['table-cell'];
  if (custom) return { align: cell.align, colSpan: cell.colSpan, rowSpan: cell.rowSpan };
  const span = (value: number | undefined) => (value && value > 1 ? value : undefined);
  const style: StyleValue | undefined = cell.align ? { textAlign: cell.align } : undefined;
  return {
    scope: isHeader(cell) ? 'col' : undefined,
    // Omitted rather than set to undefined: a `style` key with no value still
    // renders as an empty attribute on the server.
    ...(style ? { style } : {}),
    colspan: span(cell.colSpan),
    rowspan: span(cell.rowSpan),
  };
};
</script>

<template>
  <component :is="rowWrapper">
    <component
      :is="cellWrapper(cell)"
      v-for="(cell, index) in row.children"
      :key="index"
      v-bind="cellProps(cell)"
    >
      <Inline :nodes="cell.children" :blocks="blocks" :modifiers="modifiers" />
    </component>
  </component>
</template>
