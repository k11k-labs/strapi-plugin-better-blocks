<script setup lang="ts">
defineProps<{ url: string; originalUrl?: string }>();
</script>

<template>
  <div data-testid="custom-embed" :data-original="originalUrl">{{ url }}</div>
</template>
