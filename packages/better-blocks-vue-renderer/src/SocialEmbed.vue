<script setup lang="ts">
/**
 * A social post: the platform's own embed markup when there is any, else a
 * link card.
 *
 * The markup is server-rendered, so the post is in the HTML before any script
 * runs. The platform widget script - the thing that turns a `<blockquote>` into
 * the real card - is loaded lazily on mount, when the embed nears the viewport.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import type { CustomBlocksConfig, SocialEmbedNode, StyleValue } from './types';

import { enhanceSocialEmbed } from './socialScripts';
import {
  SOCIAL_SCRIPTS,
  addLazyLoadingToIframes,
  getSocialAriaLabel,
  getSocialEmbedSource,
  getSocialProviderName,
  rawComponent,
} from './utils';

const props = defineProps<{
  node: SocialEmbedNode;
  blocks?: CustomBlocksConfig;
}>();

const SocialComp = computed(() => rawComponent(props.blocks?.['social-embed']));
const alignment = computed(() => props.node.alignment ?? 'center');

const source = computed(() => getSocialEmbedSource(props.node));
// Trusted markup (platform oEmbed / author-pasted embed code). It intentionally
// contains <iframe>/<blockquote> and must NOT be passed through a sanitizer that
// strips them - see the README's trust-boundary note. Widget <script> tags are
// stripped in getSocialEmbedSource; the lazy loader is the single script injector.
const html = computed<string | null>(() =>
  source.value.kind === 'html' ? addLazyLoadingToIframes(source.value.html) : null
);

// A widget script is only worth loading for platforms that ship one AND when we
// actually rendered embed markup (the fallback link card needs none).
const needsScript = computed(() => html.value !== null && !!SOCIAL_SCRIPTS[props.node.platform]);

const ariaLabel = computed(() => getSocialAriaLabel(props.node));
const providerName = computed(() => getSocialProviderName(props.node));
const oembed = computed(() => props.node.oembed);

// The fallback card links to the post when a URL is known; embed-code-only nodes
// (no tokenless oEmbed) have none, so it renders as a non-interactive <div>
// rather than an empty `<a href="">`.
const fallbackHref = computed(() => props.node.url?.trim() || null);
const fallbackTag = computed(() => (fallbackHref.value ? 'a' : 'div'));
const fallbackLinkAttrs = computed((): Record<string, string> => {
  const href = fallbackHref.value;
  if (!href) return {};
  return { href, target: '_blank', rel: 'noopener noreferrer' };
});

// Fallback link-card title: the oEmbed title, else a descriptive label.
const fallbackTitle = computed(() => {
  const label = oembed.value?.author
    ? `${providerName.value} post by ${oembed.value.author}`
    : `View on ${providerName.value}`;
  return oembed.value?.title ?? label;
});

// Mirrors the other renderers: centered embeds get `1rem auto` so the block
// centers within its column; left/right keep a flush `1rem 0`.
const figureStyle = computed<StyleValue>(() => ({
  margin: alignment.value === 'center' ? '1rem auto' : '1rem 0',
  textAlign: alignment.value,
}));

const figure = ref<HTMLElement | null>(null);
let teardown: (() => void) | null = null;

onMounted(() => {
  if (!needsScript.value || !figure.value) return;
  teardown = enhanceSocialEmbed(figure.value, props.node.platform);
});

onBeforeUnmount(() => {
  teardown?.();
  teardown = null;
});
</script>

<template>
  <component
    :is="SocialComp"
    v-if="SocialComp"
    :platform="node.platform"
    :url="node.url"
    :embed-code="node.embedCode"
    :oembed="node.oembed"
    :alignment="node.alignment"
    :caption="node.caption"
  />
  <figure
    v-else
    ref="figure"
    :class="`bb-social-embed bb-social-embed-${node.platform} social-embed align-${alignment}`"
    :aria-label="ariaLabel"
    :style="figureStyle"
  >
    <div v-if="html !== null" class="bb-social-embed-html" v-html="html"></div>
    <component
      :is="fallbackTag"
      v-else
      class="bb-social-embed-fallback"
      v-bind="fallbackLinkAttrs"
      :style="{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: '1px solid #d0d7de',
        borderRadius: '0.5rem',
        textDecoration: 'none',
        color: 'inherit',
        textAlign: 'left',
      }"
    >
      <img
        v-if="oembed?.thumbnailUrl"
        class="bb-social-embed-fallback-thumb"
        :src="oembed.thumbnailUrl"
        alt=""
        loading="lazy"
        width="48"
        height="48"
        :style="{ borderRadius: '0.25rem', objectFit: 'cover', flexShrink: 0 }"
      />
      <span class="bb-social-embed-fallback-body">
        <span
          class="bb-social-embed-fallback-title"
          :style="{ display: 'block', fontWeight: 600 }"
          >{{ fallbackTitle }}</span
        >
        <span
          class="bb-social-embed-fallback-provider"
          :style="{ opacity: 0.7, fontSize: '0.875em' }"
          >{{ providerName }}</span
        >
      </span>
    </component>
    <figcaption v-if="node.caption" class="bb-social-embed-caption">{{ node.caption }}</figcaption>
  </figure>
</template>
