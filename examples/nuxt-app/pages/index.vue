<script setup lang="ts">
import type { BlocksContent } from '@qkix/better-blocks-vue-renderer';

import CustomButton from '../components/CustomButton.vue';
import CustomCallout from '../components/CustomCallout.vue';
import CustomDetails from '../components/CustomDetails.vue';
import CustomSocialEmbed from '../components/CustomSocialEmbed.vue';

interface Article {
  id: number;
  documentId: string;
  title: string;
  content: BlocksContent;
}

const config = useRuntimeConfig();

const { data: articles, error } = await useAsyncData<Article[]>('articles', async () => {
  // The server talks to Strapi directly; the browser goes through the dev proxy,
  // which is also what makes the relative `/uploads/...` media URLs resolve.
  const baseURL = import.meta.server ? config.strapiUrl : '';
  const json = await $fetch<{ data: Article[] }>('/api/articles?status=published', { baseURL });
  return json.data;
});

useHead({ title: 'Better Blocks - Vue renderer' });

/** The blocks of one type, so each section below shows one feature at a time. */
const only = (content: BlocksContent, type: string) =>
  content.filter((block) => block.type === type);
</script>

<template>
  <div style="max-width: 720px; margin: 0 auto; padding: 24px; font-family: system-ui">
    <h1>Better Blocks - Vue renderer</h1>
    <p style="color: #666; margin-bottom: 32px">
      Every showcase article seeded into the Strapi example, rendered with
      <code>@qkix/better-blocks-vue-renderer</code> - native Vue 3 SFCs, server-rendered by Nuxt.
      The React example serves the same content at <code>localhost:5173</code>, the Astro one at
      <code>localhost:4321</code>.
    </p>

    <p v-if="error" style="color: red">
      Error: {{ error.message }}. Make sure the Strapi example is running on port 1337.
    </p>

    <p v-else-if="!articles || articles.length === 0">
      No published articles found. Create one in
      <a href="http://localhost:1337/admin" target="_blank" rel="noopener noreferrer">
        Strapi admin
      </a>
      and publish it.
    </p>

    <article
      v-for="article in articles"
      :key="article.documentId"
      style="margin-bottom: 48px; border-bottom: 1px solid #eee; padding-bottom: 24px"
    >
      <h2 style="margin-bottom: 4px">{{ article.title }}</h2>
      <h3 style="color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em">
        ① Default rendering - callouts are GitHub-style
      </h3>
      <BlocksRenderer :content="article.content" code-copy-button />

      <section
        v-if="only(article.content, 'callout').length > 0"
        style="margin-top: 40px; padding-top: 16px; border-top: 2px dashed #d7c7ff"
      >
        <h2
          style="color: #7c3aed; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em"
        >
          ② Custom callout renderer - same callouts via the <code>blocks</code> override
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The callouts below are the exact same content as above, re-rendered with a custom
          <code>callout</code> component (purple boxes with emoji) instead of the built-in
          GitHub-style default.
        </p>
        <BlocksRenderer
          :content="only(article.content, 'callout')"
          :blocks="{ callout: CustomCallout }"
        />
      </section>

      <section
        v-if="only(article.content, 'details').length > 0"
        style="margin-top: 40px; padding-top: 16px; border-top: 2px dashed #d0d7de"
      >
        <h2
          style="color: #57606a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em"
        >
          ③ Default details - GitHub-style markup shipped by the renderer
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same details blocks as above, rendered with the built-in
          <code>bb-details</code> markup and its stylesheet - a native
          <code>&lt;details&gt;</code> disclosure with zero client-side JavaScript.
        </p>
        <BlocksRenderer :content="only(article.content, 'details')" />

        <h2
          style="
            color: #7c3aed;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 32px;
          "
        >
          ④ Custom details renderer - same details via the <code>blocks</code> override
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same details blocks re-rendered with a custom <code>details</code> component (purple
          box, emoji marker) instead of the built-in default.
        </p>
        <BlocksRenderer
          :content="only(article.content, 'details')"
          :blocks="{ details: CustomDetails }"
        />
      </section>

      <section
        v-if="only(article.content, 'button').length > 0"
        style="margin-top: 40px; padding-top: 16px; border-top: 2px dashed #c7d2fe"
      >
        <h2
          style="color: #4945ff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em"
        >
          ⑤ Buttons - default rendering (inline styles + hover via CSS variables)
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same buttons as in the article above. Hover them - the
          <code>hoverBackgroundColor</code> / <code>hoverTextColor</code> from the block are exposed
          as CSS custom properties and wired up by the renderer's stylesheet. The file button
          downloads a real asset, fetching it first when the asset is cross-origin.
        </p>
        <BlocksRenderer :content="only(article.content, 'button')" />

        <h2
          style="
            color: #7c3aed;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 32px;
          "
        >
          ⑥ Custom button renderer - same buttons via the <code>blocks</code> override
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same buttons re-rendered with a custom <code>button</code> component (pill-shaped
          gradient CTA) instead of the built-in default.
        </p>
        <BlocksRenderer
          :content="only(article.content, 'button')"
          :blocks="{ button: CustomButton }"
        />
      </section>

      <section
        v-if="only(article.content, 'social-embed').length > 0"
        style="margin-top: 40px; padding-top: 16px; border-top: 2px dashed #a5d8ff"
      >
        <h2
          style="color: #1c7ed6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em"
        >
          ⑦ Social embeds - default rendering (lazy, deduped widget scripts)
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same social embeds as in the article above. The embed markup is server-rendered;
          platform widget scripts load lazily via an <code>IntersectionObserver</code> once an embed
          nears the viewport, and each platform's script is injected <strong>once</strong>. Widget
          <code>&lt;script&gt;</code> tags shipped inside the embed markup (TikTok's oEmbed,
          hand-pasted embed codes) are stripped so the loader stays the single injector. Pinterest,
          Instagram and LinkedIn here return self-contained <code>&lt;iframe&gt;</code>s that need
          no script at all. Embeds with no <code>embedCode</code>/<code>oembed.html</code> degrade
          to a fallback card, which is a non-interactive <code>&lt;div&gt;</code> (not an empty
          <code>&lt;a href=""&gt;</code>) when the node also has no post URL.
        </p>
        <BlocksRenderer :content="only(article.content, 'social-embed')" />

        <h2
          style="
            color: #7c3aed;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 32px;
          "
        >
          ⑧ Custom social-embed renderer - same embeds via the <code>blocks</code> override
        </h2>
        <p style="color: #666; font-size: 14px; margin-top: 0">
          The same embeds re-rendered with a custom <code>social-embed</code> component (a compact
          card that just links out) instead of the built-in default.
        </p>
        <BlocksRenderer
          :content="only(article.content, 'social-embed')"
          :blocks="{ 'social-embed': CustomSocialEmbed }"
        />
      </section>
    </article>
  </div>
</template>
