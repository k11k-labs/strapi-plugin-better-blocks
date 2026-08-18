<script setup lang="ts">
defineProps<{ level: number }>();
</script>

<template>
  <component :is="`h${level}`" :data-testid="`heading-${level}`"><slot /></component>
</template>
