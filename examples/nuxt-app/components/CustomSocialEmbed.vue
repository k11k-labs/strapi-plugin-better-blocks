<script setup lang="ts">
// A custom social-embed renderer that fully replaces the default figure/embed
// markup with a compact link-out card. It receives platform, url, embedCode,
// oembed, alignment, and caption. This is the zero-third-party-script path: it
// never emits the platform blockquote/iframe, just a styled link.
const props = defineProps<{
  platform: string;
  url?: string;
  oembed?: { author?: string; providerName?: string };
  alignment?: string;
  caption?: string;
}>();

const EMOJI: Record<string, string> = {
  twitter: '🐦',
  instagram: '📸',
  facebook: '👍',
  tiktok: '🎵',
  linkedin: '💼',
  pinterest: '📌',
};

const provider = computed(() => props.oembed?.providerName ?? props.platform);
const emoji = computed(() => EMOJI[props.platform] ?? '🔗');
const wrapperStyle = computed(() => ({ margin: '16px 0', textAlign: props.alignment }));
</script>

<template>
  <div :style="wrapperStyle">
    <a
      class="custom-social-embed"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      style="
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        border: 1px solid #d0d7de;
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        text-align: left;
      "
    >
      <span aria-hidden="true" style="font-size: 22px">{{ emoji }}</span>
      <span style="display: flex; flex-direction: column">
        <strong>{{ oembed?.author ?? provider }}</strong>
        <span style="font-size: 13px; color: #57606a">View on {{ provider }} →</span>
      </span>
    </a>
    <p v-if="caption" style="font-size: 13px; color: #666; margin: 6px 0 0">{{ caption }}</p>
  </div>
</template>

<style scoped>
.custom-social-embed {
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.custom-social-embed:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(28, 126, 214, 0.18);
}
.custom-social-embed:focus-visible {
  outline: 2px solid #1c7ed6;
  outline-offset: 2px;
}
</style>
