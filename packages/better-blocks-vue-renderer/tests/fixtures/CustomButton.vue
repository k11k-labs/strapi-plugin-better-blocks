<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  buttonType?: string;
  alignment?: string;
  link?: { url: string; target?: string; rel?: string };
  file?: { url: string; name: string };
  // Declared so the ButtonStyle object arrives as data rather than being
  // applied to this element as CSS - see the README's note on `style`.
  style?: Record<string, string>;
}>();

const href = computed(() => (props.buttonType === 'file' ? props.file?.url : props.link?.url));
</script>

<template>
  <a
    class="custom-button"
    :data-button-type="buttonType"
    :data-alignment="alignment"
    :data-bg="style?.backgroundColor"
    :href="href"
    :target="link?.target"
    :rel="link?.rel"
    :download="buttonType === 'file' ? file?.name : undefined"
    >{{ label }}</a
  >
</template>
