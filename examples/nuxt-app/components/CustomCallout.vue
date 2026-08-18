<script setup lang="ts">
// A custom callout renderer that fully replaces the default GitHub-style markup.
// It receives `variant` and `title`; nested children arrive in the default slot.
const props = defineProps<{ variant: string; title?: string }>();

const EMOJI: Record<string, string> = {
  note: 'ℹ️',
  tip: '💡',
  important: '📣',
  warning: '⚠️',
  caution: '🛑',
};

const emoji = computed(() => EMOJI[props.variant] ?? '🔖');
</script>

<template>
  <div
    style="
      border-radius: 8px;
      padding: 12px 16px;
      margin: 16px 0;
      background: #f4f0ff;
      border: 1px solid #d7c7ff;
    "
  >
    <div style="font-weight: 700; margin-bottom: 4px">
      {{ emoji }} {{ title ?? variant.toUpperCase() }}
    </div>
    <slot />
  </div>
</template>
