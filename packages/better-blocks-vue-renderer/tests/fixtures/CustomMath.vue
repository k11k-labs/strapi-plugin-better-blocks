<script setup lang="ts">
defineProps<{ formula: string; inline: boolean }>();
</script>

<template>
  <span data-testid="custom-math" :data-formula="formula" :data-inline="String(inline)"></span>
</template>
