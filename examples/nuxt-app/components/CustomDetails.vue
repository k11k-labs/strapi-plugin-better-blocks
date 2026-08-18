<script setup lang="ts">
// A custom details renderer that fully replaces the default GitHub-style markup.
// It receives `summary` and `defaultOpen`; nested children arrive in the slot.
defineProps<{ summary: string; defaultOpen?: boolean }>();
</script>

<template>
  <details
    class="custom-details"
    :open="defaultOpen"
    style="border-radius: 8px; margin: 16px 0; background: #f4f0ff; border: 1px solid #d7c7ff"
  >
    <summary style="cursor: pointer; font-weight: 700; padding: 10px 16px; color: #7c3aed">
      {{ summary }}
    </summary>
    <div style="padding: 0 16px 8px">
      <slot />
    </div>
  </details>
</template>

<style scoped>
/* Hide the native marker and draw our own emoji that swaps between collapsed
   and expanded states - pure CSS, zero JavaScript. */
.custom-details > summary {
  list-style: none;
}
.custom-details > summary::-webkit-details-marker {
  display: none;
}
.custom-details > summary::before {
  content: '📁 ';
}
.custom-details[open] > summary::before {
  content: '📂 ';
}
/* The body blocks are rendered by the renderer's own components, so they carry
   no scope id of this component - :deep() is how a scoped style reaches them. */
.custom-details > div > :deep(:first-child) {
  margin-top: 0;
}
.custom-details > div > :deep(:last-child) {
  margin-bottom: 0;
}
</style>
