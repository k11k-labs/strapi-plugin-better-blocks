<script setup lang="ts">
defineProps<{ align?: string; colSpan?: number; rowSpan?: number }>();
</script>

<template>
  <div data-testid="custom-th" :data-align="align" :data-colspan="colSpan" :data-rowspan="rowSpan">
    <slot />
  </div>
</template>
