<script setup lang="ts">
defineProps<{
  embedHtml: string;
  provider?: string;
  aspectRatio?: string;
  alignment?: string;
  caption?: string;
  title?: string;
}>();
</script>

<template>
  <div
    class="custom-embed-block"
    :data-provider="provider"
    :data-aspect="aspectRatio"
    :data-alignment="alignment"
  >
    <span v-if="title" class="custom-embed-title">{{ title }}</span>
    <div class="custom-embed-html" v-html="embedHtml"></div>
    <span v-if="caption" class="custom-embed-caption">{{ caption }}</span>
  </div>
</template>
