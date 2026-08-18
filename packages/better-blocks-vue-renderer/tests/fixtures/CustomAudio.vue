<script setup lang="ts">
defineProps<{
  file?: { url: string };
  title?: string;
  caption?: string;
  alignment?: string;
}>();
</script>

<template>
  <div class="custom-audio" :data-alignment="alignment" :data-url="file?.url">
    <span v-if="title" class="custom-audio-title">{{ title }}</span>
    <span v-if="caption" class="custom-audio-caption">{{ caption }}</span>
  </div>
</template>
