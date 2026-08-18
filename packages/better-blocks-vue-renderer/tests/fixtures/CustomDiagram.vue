<script setup lang="ts">
defineProps<{ code: string; format?: string }>();
</script>

<template>
  <div class="custom-diagram" :data-format="format">{{ code }}</div>
</template>
