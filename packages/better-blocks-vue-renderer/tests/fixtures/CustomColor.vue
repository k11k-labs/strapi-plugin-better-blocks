<script setup lang="ts">
defineProps<{ color: string }>();
</script>

<template>
  <span data-testid="custom-color" :data-color="color"><slot /></span>
</template>
