<script setup lang="ts">
defineProps<{ url: string; target?: string; rel?: string }>();
</script>

<template>
  <a data-testid="custom-link" :href="url" :target="target" :rel="rel"><slot /></a>
</template>
