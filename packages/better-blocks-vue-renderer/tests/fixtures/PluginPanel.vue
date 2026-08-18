<script setup lang="ts">
defineProps<{ node: { label?: string } }>();
</script>

<template>
  <section class="plugin-panel" :data-label="node.label"><slot /></section>
</template>
