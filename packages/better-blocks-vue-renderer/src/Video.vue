<script setup lang="ts">
/**
 * A video, played by the browser's native `<video>` element.
 */
import { computed } from 'vue';

import type { CustomBlocksConfig, MediaAlignment, VideoNode } from './types';

import { MEDIA_JUSTIFY, getAspectRatio, rawComponent } from './utils';

const props = withDefaults(
  defineProps<{
    node: VideoNode;
    blocks?: CustomBlocksConfig;
    /** Position among sibling blocks - last-resort key for the caption id. */
    index?: number;
  }>(),
  { blocks: undefined, index: 0 }
);

const VideoComp = computed(() => rawComponent(props.blocks?.video));
const alignment = computed<MediaAlignment>(() => props.node.alignment ?? 'center');
const aspectRatio = computed(() =>
  getAspectRatio(props.node.aspectRatio, props.node.customAspectRatio)
);

const file = computed(() => props.node.file);
const player = computed(() => props.node.player);

// Preferred playback source: an explicit url, else the Media-Library file url,
// else a Mux public-playback stream derived from the playback id.
const src = computed(
  () =>
    props.node.url?.trim() ||
    file.value?.url?.trim() ||
    (props.node.provider === 'mux' && props.node.playbackId
      ? `https://stream.mux.com/${props.node.playbackId}.m3u8`
      : undefined)
);

// Poster: explicit, else a Mux thumbnail derived from the playback id.
const poster = computed(
  () =>
    props.node.poster?.trim() ||
    (props.node.provider === 'mux' && props.node.playbackId
      ? `https://image.mux.com/${props.node.playbackId}/thumbnail.jpg`
      : undefined)
);

// HLS/DASH only plays natively in Safari; other browsers fall back to the poster
// plus the download/open link inside <video>. Override the block for a JS player.
const isStream = computed(() => /\.(m3u8|mpd)(\?.*)?$/i.test(src.value ?? ''));

const controls = computed(() => player.value?.controls ?? true);
// autoplay is a no-op unless the video is muted, so muted is forced on with it.
const autoplay = computed(() => player.value?.autoplay ?? false);
const muted = computed(() => (player.value?.muted ?? false) || autoplay.value);
const loop = computed(() => player.value?.loop ?? false);

// Stable id linking the caption to the player via aria-describedby. Prefer the
// Media-Library id, fall back to the playback id, then the block index.
const capId = computed(() =>
  props.node.caption
    ? `bb-video-cap-${file.value?.id ?? props.node.playbackId ?? props.index}`
    : undefined
);

const frameMaxWidth = computed(() =>
  alignment.value === 'none' ? '100%' : 'var(--bb-video-max-width, 40rem)'
);
</script>

<template>
  <component
    :is="VideoComp"
    v-if="VideoComp"
    :provider="node.provider"
    :url="node.url"
    :asset-id="node.assetId"
    :playback-id="node.playbackId"
    :file="node.file"
    :poster="node.poster"
    :title="node.title"
    :caption="node.caption"
    :transcript="node.transcript"
    :player="node.player"
    :alignment="node.alignment"
    :aspect-ratio="node.aspectRatio"
    :custom-aspect-ratio="node.customAspectRatio"
  />
  <figure
    v-else
    :class="`bb-video align-${alignment}`"
    :data-hls="isStream ? '' : undefined"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      alignItems: MEDIA_JUSTIFY[alignment],
      gap: '0.5rem',
      margin: '1rem 0',
    }"
  >
    <figcaption v-if="node.title" class="bb-video-title" :style="{ fontWeight: 600 }">
      {{ node.title }}
    </figcaption>
    <div
      class="bb-video-frame"
      :style="{
        position: 'relative',
        width: '100%',
        maxWidth: frameMaxWidth,
        aspectRatio,
        background: '#000',
      }"
    >
      <video
        v-if="src"
        class="bb-video-player"
        :src="src"
        :poster="poster"
        :controls="controls"
        :autoplay="autoplay"
        :muted="muted"
        :loop="loop"
        playsinline
        preload="metadata"
        :aria-label="node.title || 'Video player'"
        :aria-describedby="capId"
      >
        <track v-if="node.transcript" kind="captions" :src="node.transcript" />
        <p>Your browser can&rsquo;t play this video. <a :href="src">Open the video</a>.</p>
      </video>
      <img
        v-else-if="poster"
        class="bb-video-poster"
        :src="poster"
        :alt="node.title || ''"
        loading="lazy"
        :style="{
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }"
      />
    </div>
    <figcaption
      v-if="node.caption"
      :id="capId"
      class="bb-video-caption"
      :style="{ fontSize: '0.875rem', color: '#6b7280' }"
    >
      {{ node.caption }}
    </figcaption>
  </figure>
</template>

<style>
.bb-video-frame > .bb-video-player {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  object-fit: contain;
}
</style>
