<script setup lang="ts">
defineProps<{ variant: string; title?: string }>();
</script>

<template>
  <section class="custom-callout" :data-variant="variant" :data-title="title"><slot /></section>
</template>
