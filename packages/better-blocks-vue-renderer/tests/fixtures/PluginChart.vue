<script setup lang="ts">
defineProps<{ node: { spec?: { title?: string } } }>();
</script>

<template>
  <figure class="plugin-chart" :data-title="node.spec?.title">{{ node.spec?.title }}</figure>
</template>
