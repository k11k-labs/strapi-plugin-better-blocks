<script setup lang="ts">
defineProps<{
  provider?: string;
  url?: string;
  playbackId?: string;
  poster?: string;
  title?: string;
  caption?: string;
  alignment?: string;
}>();
</script>

<template>
  <div
    class="custom-video"
    :data-provider="provider"
    :data-url="url"
    :data-playback-id="playbackId"
    :data-poster="poster"
    :data-alignment="alignment"
  >
    <span v-if="title" class="custom-video-title">{{ title }}</span>
    <span v-if="caption" class="custom-video-caption">{{ caption }}</span>
  </div>
</template>
