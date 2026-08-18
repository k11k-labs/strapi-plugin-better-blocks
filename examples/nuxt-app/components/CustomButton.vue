<script setup lang="ts">
// A custom button renderer that fully replaces the default markup with a
// pill-shaped gradient CTA. It receives label, link/file, buttonType, alignment,
// filePreview. A preview file button opens in a new tab; otherwise it downloads.
const props = defineProps<{
  label: string;
  buttonType?: string;
  alignment?: string;
  link?: { url: string; target?: string; rel?: string };
  file?: { url: string; name: string };
  filePreview?: boolean;
}>();

const isFile = computed(() => props.buttonType === 'file');
const isPreview = computed(() => isFile.value && props.filePreview === true);
const href = computed(() => (isFile.value ? props.file?.url : props.link?.url));
const target = computed(() => (isPreview.value ? '_blank' : props.link?.target));
const rel = computed(() => (isPreview.value ? 'noopener noreferrer' : props.link?.rel));
const download = computed(() => (isFile.value && !isPreview.value ? props.file?.name : undefined));
const emoji = computed(() => (isFile.value ? (isPreview.value ? '👁' : '⬇') : '✨'));
const wrapperStyle = computed(() => ({
  margin: '12px 0',
  textAlign: props.alignment && props.alignment !== 'none' ? props.alignment : undefined,
}));
</script>

<template>
  <div :style="wrapperStyle">
    <a
      class="custom-button"
      :href="href"
      :target="target"
      :rel="rel"
      :download="download"
      style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        line-height: 1;
        background: linear-gradient(135deg, #7c3aed, #4945ff);
        color: #fff;
        text-decoration: none;
        font-weight: 700;
        padding: 12px 28px;
        border-radius: 999px;
      "
    >
      <span aria-hidden="true">{{ emoji }}</span>
      {{ label }}
    </a>
  </div>
</template>

<style scoped>
.custom-button {
  transition:
    transform 0.15s ease,
    filter 0.15s ease,
    box-shadow 0.15s ease;
}
.custom-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: 0 6px 18px rgba(73, 69, 255, 0.35);
}
.custom-button:focus-visible {
  outline: 2px solid #4945ff;
  outline-offset: 2px;
}
</style>
