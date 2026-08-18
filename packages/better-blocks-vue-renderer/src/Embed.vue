<script setup lang="ts">
/**
 * A third-party embed (the plugin's sanitized `<iframe>` payload), sized by its
 * aspect ratio and positioned by its alignment.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, EmbedNode, MediaAlignment } from './types';

import { MEDIA_JUSTIFY, getAspectRatio, rawComponent } from './utils';

const props = defineProps<{
  node: EmbedNode;
  blocks?: CustomBlocksConfig;
}>();

const EmbedComp = computed(() => rawComponent(props.blocks?.embed));
const alignment = computed<MediaAlignment>(() => props.node.alignment ?? 'center');
const aspectRatio = computed(() =>
  getAspectRatio(props.node.aspectRatio, props.node.customAspectRatio)
);

// Sanitized plugin-side (attribute allowlist over an https-only src, scripts /
// handlers / inline styles / unknown attributes stripped), so it is emitted
// verbatim via v-html - see the README's trust-boundary note.
const embedHtml = computed(() => props.node.embedHtml);

// `none` = full-width; aligned variants are capped by the retheme-able
// `--bb-embed-max-width` custom property and positioned via justify-content.
const frameMaxWidth = computed(() =>
  alignment.value === 'none' ? '100%' : 'var(--bb-embed-max-width, 40rem)'
);
</script>

<template>
  <component
    :is="EmbedComp"
    v-if="EmbedComp"
    :embed-html="node.embedHtml"
    :embed-src="node.embedSrc"
    :provider="node.provider"
    :thumbnail="node.thumbnail"
    :aspect-ratio="node.aspectRatio"
    :custom-aspect-ratio="node.customAspectRatio"
    :alignment="node.alignment"
    :caption="node.caption"
    :title="node.title"
  />
  <figure
    v-else
    :class="`bb-embed align-${alignment}`"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      alignItems: MEDIA_JUSTIFY[alignment],
      gap: '0.5rem',
      margin: '1rem 0',
    }"
  >
    <figcaption v-if="node.title" class="bb-embed-title" :style="{ fontWeight: 600 }">
      {{ node.title }}
    </figcaption>
    <div
      class="bb-embed-frame"
      :style="{ position: 'relative', width: '100%', maxWidth: frameMaxWidth, aspectRatio }"
      v-html="embedHtml"
    ></div>
    <figcaption
      v-if="node.caption"
      class="bb-embed-caption"
      :style="{ fontSize: '0.875rem', color: '#6b7280' }"
    >
      {{ node.caption }}
    </figcaption>
  </figure>
</template>

<style>
/* Make the sanitized iframe fill the aspect-ratio box. */
.bb-embed-frame > iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
