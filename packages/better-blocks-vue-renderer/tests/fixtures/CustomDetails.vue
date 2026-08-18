<script setup lang="ts">
defineProps<{ summary: string; defaultOpen?: boolean }>();
</script>

<template>
  <details class="custom-details" :data-summary="summary" :open="defaultOpen">
    <summary>{{ summary }}</summary>
    <slot />
  </details>
</template>
