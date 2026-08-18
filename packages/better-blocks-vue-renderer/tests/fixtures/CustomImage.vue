<script setup lang="ts">
defineProps<{
  image: { url: string; alternativeText?: string };
  caption?: string;
  imageAlign?: string;
}>();
</script>

<template>
  <div data-testid="custom-img" :data-caption="caption" :data-align="imageAlign">
    <img :src="image.url" :alt="image.alternativeText || ''" />
  </div>
</template>
