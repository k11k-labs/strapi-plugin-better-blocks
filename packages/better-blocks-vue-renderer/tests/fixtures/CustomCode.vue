<script setup lang="ts">
defineProps<{ plainText: string; language?: string }>();
</script>

<template>
  <pre data-testid="custom-code" :data-language="language"><code><slot /></code></pre>
</template>
