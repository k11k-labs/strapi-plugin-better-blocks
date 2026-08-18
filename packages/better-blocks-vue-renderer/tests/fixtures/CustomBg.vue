<script setup lang="ts">
defineProps<{ backgroundColor: string }>();
</script>

<template>
  <mark data-testid="custom-bg" :style="{ backgroundColor }"><slot /></mark>
</template>
