<script setup lang="ts">
/**
 * A code block, syntax-highlighted with Shiki on the client.
 *
 * Shiki resolves grammars and themes asynchronously, so - unlike KaTeX - it
 * cannot highlight during SSR. The server and the first client render both emit
 * the raw source in a plain `<pre>`, so hydration matches, and the highlighted
 * markup is swapped in after mount. If Shiki fails to load or the grammar is
 * unavailable, the plain `<pre>` stays as a graceful fallback.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { BundledLanguage } from 'shiki';

import type { CodeNode, CustomBlocksConfig } from './types';

import { getPlainText, normalizeCodeLang, rawComponent } from './utils';

type Highlighter = Awaited<ReturnType<typeof import('shiki').createHighlighter>>;

// One highlighter per theme, shared by every code block on the page - building
// one is expensive, and the import is dynamic so Shiki stays out of the server
// bundle and is only fetched when a code block is actually rendered.
const highlighters = new Map<string, Promise<Highlighter>>();

function loadHighlighter(theme: string, lang: string): Promise<Highlighter> {
  const cached = highlighters.get(theme);

  if (!cached) {
    const created = import('shiki').then((shiki) =>
      shiki.createHighlighter({ themes: [theme], langs: [lang] })
    );
    highlighters.set(theme, created);
    return created;
  }

  // A second block on the page may use a different language than the one the
  // highlighter was built with; load it into the existing instance rather than
  // spinning up another highlighter for the same theme.
  return cached.then(async (instance) => {
    if (!instance.getLoadedLanguages().includes(lang)) {
      // normalizeCodeLang only ever returns a bundled grammar id, but it can't
      // be typed as one without leaking Shiki's types into the core.
      await instance.loadLanguage(lang as BundledLanguage);
    }
    return instance;
  });
}

const props = withDefaults(
  defineProps<{
    node: CodeNode;
    blocks?: CustomBlocksConfig;
    /** Shiki theme for the highlighted output. Defaults to `github-dark`. */
    codeTheme?: string;
    /** When true, renders a copy button in the top-right corner. */
    codeCopyButton?: boolean;
  }>(),
  { blocks: undefined, codeTheme: 'github-dark', codeCopyButton: false }
);

const CodeComp = computed(() => rawComponent(props.blocks?.code));
const plainText = computed(() => getPlainText(props.node.children));
const lang = computed(() => normalizeCodeLang(props.node.language));

const html = ref<string | null>(null);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped on every highlight request; a response from an older one is dropped,
// so a fast prop change can't leave the previous language on screen.
let generation = 0;

function highlight(): void {
  const current = ++generation;
  html.value = null;
  if (CodeComp.value || !plainText.value) return;

  loadHighlighter(props.codeTheme, lang.value)
    .then((highlighter) =>
      highlighter.codeToHtml(plainText.value, { lang: lang.value, theme: props.codeTheme })
    )
    .then((highlighted) => {
      if (current === generation) html.value = highlighted;
    })
    .catch(() => {
      // Leave the plain-source fallback in place on load/parse errors.
    });
}

onMounted(highlight);
watch(() => [plainText.value, lang.value, props.codeTheme], highlight);

onBeforeUnmount(() => {
  generation++;
  if (copyTimer) clearTimeout(copyTimer);
});

function copy(): void {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(plainText.value).then(() => {
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
}
</script>

<template>
  <component :is="CodeComp" v-if="CodeComp" :plain-text="plainText" :language="node.language">{{
    plainText
  }}</component>
  <div v-else class="bb-code">
    <div v-if="html" v-html="html"></div>
    <pre v-else class="bb-code-pre"><code>{{ plainText }}</code></pre>
    <button
      v-if="codeCopyButton"
      class="bb-code-copy"
      type="button"
      aria-label="Copy code"
      @click="copy"
    >
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
  </div>
</template>

<style>
/* Wraps Shiki's output. Shiki inlines the theme background and text colors onto
   the <pre> it generates; we only add the GitHub-style padding, rounding and
   typography around it - and give the pre-highlight fallback a neutral skin so
   it doesn't flash as unstyled text. */
.bb-code {
  position: relative;
  margin: 1rem 0;
}
.bb-code pre {
  margin: 0;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.45;
  tab-size: 2;
}
.bb-code-pre {
  color: var(--bb-code-fg, #c9d1d9);
  background: var(--bb-code-bg, #0d1117);
}
/* Opt-in copy button - sits in the top-right corner, styled with neutral
   tokens so it reads on both light and dark themes. */
.bb-code-copy {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1;
  color: var(--bb-code-copy-fg, #e1e4e8);
  background: var(--bb-code-copy-bg, rgba(110, 118, 129, 0.4));
  border: 1px solid var(--bb-code-copy-border, rgba(240, 246, 252, 0.1));
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}
.bb-code:hover .bb-code-copy,
.bb-code-copy:focus-visible {
  opacity: 1;
}
.bb-code-copy:hover {
  background: var(--bb-code-copy-hover-bg, rgba(110, 118, 129, 0.6));
}
</style>
