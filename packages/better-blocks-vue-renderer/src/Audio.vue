<script setup lang="ts">
/**
 * An audio track, played by the browser's native `<audio>` element.
 */
import { computed } from 'vue';

import type { AudioAlignment, AudioNode, CustomBlocksConfig } from './types';

import { rawComponent } from './utils';

const props = withDefaults(
  defineProps<{
    node: AudioNode;
    blocks?: CustomBlocksConfig;
    /** Position among sibling blocks - last-resort key for the caption id. */
    index?: number;
  }>(),
  { blocks: undefined, index: 0 }
);

// Alignment class → flexbox cross-axis placement of the player within the
// figure. `none` stretches the player to fill the available width.
const AUDIO_ALIGN_ITEMS: Record<AudioAlignment, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
  none: 'stretch',
};

const AudioComp = computed(() => rawComponent(props.blocks?.audio));
const file = computed(() => props.node.file);
const player = computed(() => props.node.player);
const alignment = computed<AudioAlignment>(() => props.node.alignment ?? 'center');

// Stable id linking the caption to the player via aria-describedby. Prefer the
// Media-Library id, fall back to the file hash, then the block index.
const capId = computed(() =>
  props.node.caption ? `bb-audio-cap-${file.value.id ?? file.value.hash ?? props.index}` : undefined
);
</script>

<template>
  <component
    :is="AudioComp"
    v-if="AudioComp"
    :file="node.file"
    :title="node.title"
    :caption="node.caption"
    :player="node.player"
    :alignment="node.alignment"
  />
  <figure
    v-else
    :class="`bb-audio align-${alignment}`"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      margin: '1rem 0',
      alignItems: AUDIO_ALIGN_ITEMS[alignment],
    }"
  >
    <figcaption v-if="node.title" class="bb-audio-title" :style="{ fontWeight: 600 }">
      {{ node.title }}
    </figcaption>
    <audio
      class="bb-audio-player"
      :src="file.url"
      :controls="player?.controls ?? true"
      :autoplay="player?.autoplay ?? false"
      :loop="player?.loop ?? false"
      :preload="player?.preload ?? 'metadata'"
      :aria-label="node.title || 'Audio player'"
      :aria-describedby="capId"
      :style="{ width: '100%', maxWidth: alignment === 'none' ? '100%' : '32rem' }"
    >
      Your browser does not support the audio element.
      <a :href="file.url">Download the audio</a>.
    </audio>
    <figcaption
      v-if="node.caption"
      :id="capId"
      class="bb-audio-caption"
      :style="{ fontSize: '0.875rem', color: '#6b7280' }"
    >
      {{ node.caption }}
    </figcaption>
  </figure>
</template>
