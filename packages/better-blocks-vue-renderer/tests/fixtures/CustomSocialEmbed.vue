<script setup lang="ts">
defineProps<{ platform: string; url?: string; alignment?: string; caption?: string }>();
</script>

<template>
  <div
    class="custom-social-embed"
    :data-platform="platform"
    :data-alignment="alignment"
    :data-url="url"
  >
    <span v-if="caption" class="custom-social-caption">{{ caption }}</span>
  </div>
</template>
