<h1 align="center">Better Blocks Vue Renderer</h1>

<p align="center">Native Vue 3 renderer for Strapi v5 Blocks content - supports all standard blocks plus Better Blocks features: color, highlight, text alignment, nested lists, to-do lists, tables, media embeds, image captions, and more. Server-rendered in Nuxt, and just as happy in a plain Vue app.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qkix/better-blocks-vue-renderer">
    <img alt="npm version" src="https://img.shields.io/npm/v/@qkix/better-blocks-vue-renderer.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@qkix/better-blocks-vue-renderer">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@qkix/better-blocks-vue-renderer.svg" />
  </a>
  <a href="https://github.com/qkix/strapi-plugins/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@qkix/better-blocks-vue-renderer.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

---

## Table of Contents

1. [Why?](#why)
2. [Compatibility](#compatibility)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Nuxt](#nuxt)
6. [Supported Blocks](#supported-blocks)
7. [Supported Modifiers](#supported-modifiers)
8. [Custom Renderers](#custom-renderers)
9. [Registered Block Types](#registered-block-types)
10. [TypeScript](#typescript)
11. [Contributing](#contributing)
12. [Support this project](#support-this-project)
13. [License](#license)

---

## Why?

The official Strapi blocks renderers are built for React. If your site is built with [Vue](https://vuejs.org/) or [Nuxt](https://nuxt.com/), you _can_ render Strapi blocks through a React island - but that pulls React into your build for what is purely presentational content.

This package is a **native Vue 3 renderer**. It renders Strapi v5 Blocks content - including every feature the [Better Blocks](https://github.com/qkix/strapi-plugins) plugin adds (color marks, text alignment, to-do lists, tables, media embeds, and more) - using plain Vue single-file components.

Everything that can be finished on the server is: math is typeset with KaTeX and Mermaid diagrams are rendered to SVG **during SSR**, byte-identical to what the client would produce, so a Nuxt page ships finished markup and hydrates over it with no mismatch. The only two things that run in the browser are the ones that cannot run anywhere else - Shiki code highlighting (asynchronous by nature) and the social-platform widget scripts (lazy, and only when an embed nears the viewport).

It is a **drop-in renderer** that handles all Better Blocks features out of the box - no configuration needed. In Nuxt, [one module line](#nuxt) is the whole setup.

## Compatibility

| Strapi Version | Renderer Version | Vue Version | Nuxt Version      |
| -------------- | ---------------- | ----------- | ----------------- |
| v5.x           | v0.x             | &ge; 3.3    | &ge; 3 (optional) |

## Installation

```bash
# Using yarn
yarn add @qkix/better-blocks-vue-renderer

# Using npm
npm install @qkix/better-blocks-vue-renderer
```

**Peer dependencies:** `vue >= 3.3` (and `@nuxt/kit`, only if you use the Nuxt module - Nuxt already ships it).

The package is published **pre-compiled and ESM-only**: Vite does not process `.vue` files inside `node_modules` unless an app opts in, so shipping source would make every consumer add a `build.transpile` entry before the first block rendered.

## Usage

```vue
<script setup lang="ts">
import { BlocksRenderer } from '@qkix/better-blocks-vue-renderer';
import '@qkix/better-blocks-vue-renderer/style.css';

defineProps<{ content: unknown }>();
</script>

<template>
  <BlocksRenderer :content="content" />
</template>
```

That's it. All Better Blocks features - colors, tables, to-do lists, media embeds, alignment, and more - work automatically.

Two stylesheets are worth importing **once** in your app entry (a Nuxt app gets both from the module and can skip this):

```ts
import '@qkix/better-blocks-vue-renderer/style.css'; // tables, quotes, callouts, details, code, buttons
import 'katex/dist/katex.min.css'; // math (see below)
```

The renderer's stylesheet is plain global CSS built from the components' own `<style>` blocks. Every rule is namespaced under a `bb-*` class and every color goes through a custom property, so it themes with your CSS rather than fighting it - and dropping it entirely leaves working, unstyled markup.

A typical page that fetches from Strapi:

```vue
<script setup lang="ts">
import { BlocksRenderer, type BlocksContent } from '@qkix/better-blocks-vue-renderer';

const res = await fetch('https://your-strapi.example.com/api/articles?status=published');
const { data } = await res.json();
const articles = data as { id: number; content: BlocksContent }[];
</script>

<template>
  <article v-for="article in articles" :key="article.id">
    <BlocksRenderer :content="article.content" />
  </article>
</template>
```

### Props

| Prop             | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `content`        | the document. `null`, `undefined` or a non-array renders nothing                         |
| `blocks`         | map of block type → your own component ([custom renderers](#custom-renderers))           |
| `modifiers`      | map of text mark → your own component                                                    |
| `blockPlugins`   | block types owned by another package ([registered block types](#registered-block-types)) |
| `diagramTheme`   | color theme for Mermaid diagrams                                                         |
| `codeTheme`      | Shiki theme for code blocks (default `github-dark`)                                      |
| `codeCopyButton` | adds a copy button to code blocks (off by default)                                       |

## Nuxt

The components are ordinary Vue 3 SFCs, so they work in Nuxt as they are. The module removes the setup you would otherwise write by hand:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@qkix/better-blocks-vue-renderer/nuxt'],
});
```

That registers `<BlocksRenderer>` as an **auto-imported component** (no import in your pages) and adds both stylesheets - the renderer's own and KaTeX's, resolved from this package so it is found even under a strict `node_modules` layout.

```vue
<!-- pages/[slug].vue - no imports needed -->
<template>
  <BlocksRenderer :content="article.content" code-copy-button />
</template>
```

Options, if you want fewer of those defaults:

```ts
export default defineNuxtConfig({
  modules: ['@qkix/better-blocks-vue-renderer/nuxt'],
  betterBlocks: {
    prefix: 'Bb', // registers <BbBlocksRenderer> instead
    css: true, // the renderer's stylesheet
    katexCss: true, // KaTeX's stylesheet
    components: true, // the auto-imported component
  },
});
```

Everything renders on the server. A page of Strapi content - math, diagrams, tables, callouts and all - arrives as HTML; hydration only wires up the two client-side pieces (code highlighting and the lazy widget scripts).

### Math (KaTeX)

Math nodes are rendered with [KaTeX](https://katex.org/) - inline math becomes a `<span class="katex-inline">` and block math a `<div class="katex-block">`. KaTeX turns LaTeX into HTML synchronously and without a DOM, so rendering happens **during SSR**, identically to what the client would produce: the page ships finished math and hydrates over it, with **no client-side typesetting pass**.

KaTeX needs its stylesheet to display correctly. The Nuxt module adds it for you; elsewhere, import it **once** in your app entry:

```ts
import 'katex/dist/katex.min.css';
```

`katex` ships as a dependency of this package, so the stylesheet resolves without a separate install. If KaTeX fails to parse a formula, the renderer falls back to the raw LaTeX source instead of crashing.

### Diagrams (Mermaid)

[Mermaid](https://mermaid.js.org/) diagram blocks (`{ type: 'diagram', format: 'mermaid' }`) are **rendered to inline SVG on the server** using [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid) - a pure-Node renderer that needs **no headless browser** (no Puppeteer, no Chromium download). Like math, it is synchronous and deterministic, so the server and the client produce the same SVG and there is nothing to hydrate.

Supported diagram types - **flowchart, sequence, state, class, ER, and xychart** - render to a `<div class="mermaid-diagram">` wrapping the generated SVG. Diagram types `beautiful-mermaid` does not implement yet (gantt, pie, mindmap, gitGraph, …) and any source that fails to parse fall back gracefully to the raw definition in a `<pre class="mermaid-source">`, so content is never lost.

#### Diagram colors

Diagrams render **in color** by default, with a palette that mirrors mermaid.js's familiar look (lavender node fills, purple borders, dark edges). Pass `diagramTheme` to pick a built-in palette (`github-light`, `github-dark`, `dracula`, `nord`, `tokyo-night`, `catppuccin-mocha`, `solarized-light`, …) or a custom color object (`{ bg, fg, line, accent, muted, surface, border }`):

```vue
<!-- built-in theme -->
<BlocksRenderer :content="content" diagram-theme="github-dark" />

<!-- or a custom palette -->
<BlocksRenderer
  :content="content"
  :diagram-theme="{ bg: '#fff', fg: '#1f2328', accent: '#8250df' }"
/>
```

> `beautiful-mermaid` derives a clean, single-accent palette from these colors - it is intentionally minimal, not a 1:1 clone of mermaid.js's multi-color default theme. To take full control of the markup (e.g. to render with the real mermaid.js on the client), override the `diagram` block via `blocks.diagram`.

### Callouts (Admonitions)

Block-level `callout` nodes render GitHub-style alerts in five variants - `note`, `tip`, `important`, `warning`, and `caution`. Each renders as an `<aside role="note">` with a colored left border, a title row (icon + label), and the nested block children (paragraphs, lists, links, etc.). If a `title` is set on the node it is used; otherwise the variant label is shown.

Colors come from the shipped stylesheet, driven by a `--bb-callout-accent` custom property on the `.bb-callout-{variant}` element, so you can retheme from your own CSS without replacing the markup:

```css
/* Recolor a single variant, or override per color scheme */
.bb-callout-note {
  --bb-callout-accent: #2563eb;
}
```

To replace the markup entirely, override the `callout` block. It receives `variant` and `title`; the nested children arrive in the default slot:

```vue
<BlocksRenderer :content="content" :blocks="{ callout: MyCallout }" />
```

### Details / Summary (Collapsible)

Block-level `details` nodes render a native, keyboard-accessible `<details>` / `<summary>` disclosure with **zero client-side JavaScript** - the open/closed state is handled entirely by the browser. The `summary` field is the plain-text label, the optional `defaultOpen` boolean maps to the HTML `open` attribute (honored on initial render so screen readers get the correct state), and `children` are block-level content (paragraphs, lists, tables, images, and nested `details`) rendered after the summary. The default markup carries stable `bb-details` and `bb-details-summary` classes.

Retheme the shipped GitHub-inspired card from your own CSS via the `--bb-details-*` custom properties (`--bb-details-border`, `--bb-details-bg`, `--bb-details-summary-bg`, `--bb-details-marker`) without replacing the markup:

```css
.bb-details {
  --bb-details-border: #c8c8c8;
  --bb-details-summary-bg: #eee;
}
```

To replace the markup entirely, override the `details` block. It receives `summary` and `defaultOpen`; the nested children arrive in the default slot:

```vue
<BlocksRenderer :content="content" :blocks="{ details: MyDetails }" />
```

### Buttons (CTA & File Download)

Block-level `button` nodes render a WordPress-style call-to-action as a single, accessible `<a>` (or a styled `<span>` when no target is set). Two modes are driven by `buttonType`:

- **Link** (`buttonType: 'link'`) → `<a href={link.url} target rel aria-label>` for a normal CTA. `rel="noopener noreferrer"` is honored when present (the editor adds it automatically for `target="_blank"`).
- **File** (`buttonType: 'file'`) → a download link (`<a href={file.url} :download="file.name">`) for a Media Library asset, optionally prefixed with a file-type icon (`showFileIcon`) and suffixed with a human-readable size (`showFileSize`, e.g. `(5 MB)`).

#### Download vs. preview

By default a file button **force-downloads** the asset. The native `download` attribute only works same-origin, so for cross-origin assets (Strapi/CDN) browsers ignore it and open renderable files (PDF, video, images) inline. The component's click handler fixes that: it fetches the asset as a blob and saves it from a same-origin object URL. This is progressive enhancement - modifier clicks (open in a new tab, …) are left to the browser, and a CORS-blocked fetch falls back to plain navigation.

Set `filePreview: true` to instead **open the file in a new tab** (`target="_blank" rel="noopener noreferrer"`, no download) so users can preview it before saving.

The optional `style` object is applied as inline CSS (`backgroundColor`, `textColor`, `borderRadius`, `fontSize`, `fontWeight`, `padding`, `border`), and `alignment` (`left` / `center` / `right`) wraps the button in a `text-align`ed `.bb-button-wrapper` (`none` renders it inline with no wrapper). A `cssClass` is appended to the default `bb-button` class for theming.

Because inline styles can't express `:hover`, the `hoverBackgroundColor` / `hoverTextColor` are exposed as `--bb-button-hover-bg` / `--bb-button-hover-color` custom properties, and the shipped stylesheet wires up the hover transition and a visible keyboard focus ring by default - no extra CSS required.

To replace the markup entirely, override the `button` block. It receives `label`, `buttonType`, `alignment`, `link`, `file`, `showFileSize`, `showFileIcon`, `filePreview`, `style`, and `cssClass`:

```vue
<BlocksRenderer :content="content" :blocks="{ button: MyButton }" />
```

> **A note on `style`.** Vue treats `style` as an attribute unless a component declares it as a prop. A custom `button` renderer that wants the `ButtonStyle` object as data (rather than as CSS on its root element) should declare it: `defineProps<{ style?: Record<string, string> }>()`. See [Custom Renderers](#custom-renderers).

### Social Embeds

Block-level `social-embed` nodes render a post from Twitter/X, Instagram, Facebook, TikTok, LinkedIn, or Pinterest. The renderer picks the embed HTML in priority order:

1. **`embedCode`** - a manual override pasted by the author, if present.
2. **`oembed.html`** - the markup the plugin fetched from the platform's oEmbed API at author time (a `<blockquote>` for Twitter/TikTok/Instagram, an `<iframe>` for Pinterest/LinkedIn).
3. **Fallback link card** - when neither is available, a card enriched with the oEmbed `thumbnailUrl`, `title`, and `author` when present. It's a plain `<a>` to the original post when a `url` is known, or a non-interactive `<div>` for embed-code-only nodes that carry no post URL (never an empty `<a href="">`).

The embed is wrapped in a `<figure class="bb-social-embed bb-social-embed-{platform} social-embed align-{alignment}">` (alignment defaults to `center`) with an `aria-label` describing it (`"{providerName} post by {author}"`), and the optional `caption` renders below it in a `<figcaption>`. Any `<iframe>` in the embed markup (e.g. LinkedIn) is given `loading="lazy"`. This markup is byte-for-byte compatible with the [React](https://github.com/qkix/strapi-plugins/tree/main/packages/better-blocks-react-renderer) and [Astro](https://github.com/qkix/strapi-plugins/tree/main/packages/better-blocks-astro-renderer) renderers, so shared CSS themes all three.

**Widget scripts (lazy & deduped).** Twitter, Instagram, TikTok, Pinterest, and Facebook enhance their `<blockquote>`/`<div>` markup into a rich embed via a platform script (LinkedIn renders a self-contained `<iframe>` and needs none). The embed markup itself is server-rendered, so the post is in the HTML before any script runs; on mount, each embed watches itself with an **IntersectionObserver** and its platform's script is injected **once per page** only when an embed of that platform nears the viewport. Any widget `<script>` shipped inline in the embed markup (TikTok's oEmbed always ships one; hand-pasted Instagram/Facebook codes may too) is stripped before render, so the loader stays the **single** script injector - no duplicate. After the script loads it re-runs the platform's processor (`twttr.widgets.load()`, `instgrm.Embeds.process()`, `FB.XFBML.parse()`, `tiktokEmbed.lib.render()`, …).

> **Trust boundary.** The embed HTML is emitted verbatim via `v-html` and is **not** sanitized - social embeds rely on `<iframe>`/`<blockquote>` that a sanitizer would strip (widget `<script>` tags are the one exception: they're stripped, and the lazy loader injects them instead - a script injected through `v-html` would never execute anyway). This markup originates from the platform's oEmbed API or a manual override entered by a trusted editor, so treat your CMS content as trusted. If you accept `social-embed` blocks from untrusted authors, sanitize on the server before storing.

To fully control the markup, override the `social-embed` block. It receives `platform`, `url`, `embedCode`, `oembed`, `alignment`, and `caption`:

```vue
<BlocksRenderer :content="content" :blocks="{ 'social-embed': MySocialEmbed }" />
```

### Audio

Block-level `audio` nodes embed an audio file - from the Strapi Media Library or a raw URL - using a native HTML5 `<audio>` player, with **zero client-side JavaScript** (the native player is enough). The `file.url` is rendered as-is: for Media-Library assets the editor already stores the backend-prefixed URL (same convention as the `image`/`button` blocks), so the renderer never re-prefixes it.

The block renders a `<figure class="bb-audio align-{alignment}">` (alignment defaults to `center`) containing an `<audio class="bb-audio-player">` element. The `player` flags map 1:1 to the element: `controls` (default `true`), `autoplay`, `loop`, and `preload` (`none` / `metadata` / `auto`). An optional `title` renders above the player and an optional `caption` below it, each in a `<figcaption>`. For accessibility the player gets an `aria-label` (the `title`, or `"Audio player"` when absent) and an `aria-describedby` pointing at the caption, and inside the `<audio>` element a fallback line plus a download link cover unsupported formats/browsers.

To fully control the markup, override the `audio` block. It receives `file`, `title`, `caption`, `player`, and `alignment`:

```vue
<BlocksRenderer :content="content" :blocks="{ audio: MyAudio }" />
```

### Embeds

Block-level `embed` nodes render a generic third-party embed - YouTube, Vimeo, Loom, Wistia, Dailymotion, api.video, or any generic provider - as a plain `<iframe>` with **zero client-side JavaScript**. Only one field is rendered: **`embedHtml`**, the sanitized iframe markup the plugin built at author time. It's rebuilt from an attribute allowlist over an https-only `src`, with scripts, event handlers, inline styles and unknown attributes stripped, so it's emitted verbatim via `v-html`. The `url` / `iframe` fields exist only to round-trip the editor and are ignored when rendering.

The block renders a `<figure class="bb-embed align-{alignment}">` (alignment defaults to `center`) containing a `<div class="bb-embed-frame">` whose CSS `aspect-ratio` sizes the iframe responsively. Named ratios convert `"16:9"` → `16 / 9`; when `aspectRatio` is `"custom"` the `customAspectRatio` value (e.g. `"3 / 2"`) is used verbatim; both default to `16 / 9`. Alignment positions the box (`left`/`center`/`right` → `flex-start`/`center`/`flex-end`; `none` = full-width). An optional `title` renders above and an optional `caption` below, each in a `<figcaption>`.

Aligned embeds are capped at a retheme-able `--bb-embed-max-width` (default `40rem`); `alignment: none` removes the cap and flows full-width.

> **Trust boundary.** `embedHtml` is emitted verbatim via `v-html` and is **not** re-sanitized here - it relies on the `<iframe>` that a sanitizer would strip. The plugin sanitizes it at author time (allowlisted attributes over an https-only `src`); treat your CMS content as trusted, and sanitize on the server before storing if you accept `embed` blocks from untrusted authors.

To fully control the markup, override the `embed` block. It receives `embedHtml`, `embedSrc`, `provider`, `thumbnail`, `aspectRatio`, `customAspectRatio`, `alignment`, `caption`, and `title`:

```vue
<BlocksRenderer :content="content" :blocks="{ embed: MyEmbed }" />
```

### Video

Block-level `video` nodes render a provider-aware video (`local`, `mux`, `api-video`, `cloudinary`, or `custom`) as a native HTML5 `<video>` player, with **zero client-side JavaScript**. The playback source is picked in order: an explicit `url`, then the Media-Library `file.url`, then - for `provider: "mux"` - a public-playback stream derived from `playbackId` (`https://stream.mux.com/{playbackId}.m3u8`, with a matching `https://image.mux.com/{playbackId}/thumbnail.jpg` poster when none is set). The `player` flags map 1:1 to the element - `controls` (default `true`), `autoplay`, `loop`, and `muted` (forced on whenever `autoplay` is set, since browsers block unmuted autoplay). A `transcript` URL renders as a `<track kind="captions">`, and the `caption` is associated via `aria-describedby`.

The block renders a `<figure class="bb-video align-{alignment}">` with the same alignment / aspect-ratio behavior (and `--bb-video-max-width`, default `40rem`) as embeds. A `<video class="bb-video-player">` carries a `poster`, `playsinline`, and an inner fallback line with an open-link for browsers that can't play the source. When there is no playable source (e.g. a Mux node without `url`/`playbackId`) the poster renders as an `<img class="bb-video-poster">` instead.

> **HLS/DASH (Mux).** Streaming sources (`url` ending `.m3u8` / `.mpd`) only play natively in **Safari**; other browsers show the poster and the fallback link. Shipping a cross-browser player (`<mux-player>`, `hls.js`, …) would mean loading a third-party script for every visitor of every page, so the default renderer stays script-free and marks streaming figures with `data-hls`. To play HLS everywhere, **override the `video` block** with your own player - it receives `playbackId`, `url`, `poster`, and everything else below.

To fully control the markup, override the `video` block. It receives `provider`, `url`, `assetId`, `playbackId`, `file`, `poster`, `title`, `caption`, `transcript`, `player`, `alignment`, `aspectRatio`, and `customAspectRatio`:

```vue
<BlocksRenderer :content="content" :blocks="{ video: MyVideo }" />
```

Both blocks need CSP `frame-src` / `img-src` / `media-src` hosts for the providers you use (YouTube, Vimeo, Mux, Cloudinary, …) - see the plugin README's "Embed / Video JSON shapes" for the exact directive list.

### Tables, Blockquotes & Code Blocks (GitHub-style)

Tables, blockquotes, and code blocks ship with **GitHub-flavored defaults** out of the box. Each default carries stable `bb-*` classes and lives in the package stylesheet, rethemable from your own CSS via custom properties without replacing the markup. As with every block, supply a `:blocks="{ … }"` override to take full control.

**Tables** render as `<table class="bb-table">` with bordered cells, a shaded header, and zebra-striped body rows. Leading header rows (rows whose cells are all header cells) are grouped into a `<thead>` and their cells render as `<th scope="col">` for screen-reader header announcement; the remaining rows go into `<tbody>` as `<td>`. Cell `children` are the full set of inline nodes and marks (bold, links, inline math, colors, …) and render through the same inline renderer as paragraphs. Each cell honors three optional properties, all following the "absent means default" convention so existing content renders unchanged: `align` (`left` / `center` / `right`) maps to `text-align` (omitted ⇒ left), and `colSpan` / `rowSpan` map to the matching HTML attributes (omitted ⇒ 1). The table scrolls horizontally on overflow. Retheme via `--bb-table-border`, `--bb-table-header-bg`, `--bb-table-row-bg`, and `--bb-table-stripe-bg`.

**Blockquotes** render as `<blockquote class="bb-quote">` with a muted left border and dimmed, indented text. Retheme via `--bb-quote-border` and `--bb-quote-fg`.

**Code blocks** are **syntax-highlighted with [Shiki](https://shiki.style/)**. Shiki resolves grammars and themes asynchronously, so - unlike KaTeX and Mermaid - it cannot highlight during SSR. The server and the first client render both emit the raw source in a plain `<pre class="bb-code-pre">`, so **hydration matches**, and the highlighted markup replaces it after mount. Shiki is loaded on demand (one highlighter per theme, shared by every code block on the page) and stays out of the server bundle entirely; if it fails to load or the grammar is unavailable, the plain `<pre>` remains as a graceful fallback.

The block's `language` (attached in the editor) selects the grammar; unknown or missing languages fall back to `plaintext`, so a stray value never breaks a page.

Two props tune the defaults:

- `codeTheme` - any bundled Shiki theme name (`github-dark` default, or `github-light`, `dracula`, `nord`, …).
- `codeCopyButton` - set `true` to add a copy button to each code block.

```vue
<BlocksRenderer :content="content" code-theme="github-light" code-copy-button />
```

The copy button is themed via `--bb-code-copy-fg`, `--bb-code-copy-bg`, `--bb-code-copy-border`, and `--bb-code-copy-hover-bg`, and the pre-highlight fallback via `--bb-code-fg` / `--bb-code-bg`.

## Supported Blocks

| Block                           | Default element         | Source                      |
| ------------------------------- | ----------------------- | --------------------------- |
| `paragraph`                     | `<p>`                   | Strapi core                 |
| `heading` (1&ndash;6)           | `<h1>`&ndash;`<h6>`     | Strapi core                 |
| `list` (ordered/unordered/todo) | `<ol>` / `<ul>`         | Strapi core + Better Blocks |
| `list-item`                     | `<li>`                  | Strapi core                 |
| `link`                          | `<a>`                   | Strapi core                 |
| `quote`                         | `<blockquote>`          | Strapi core                 |
| `code`                          | `<pre>` (Shiki)         | Strapi core                 |
| `image`                         | `<figure><img>`         | Strapi core                 |
| `horizontal-line`               | `<hr>`                  | Better Blocks               |
| `table`                         | `<table>` (thead/tbody) | Better Blocks               |
| `media-embed`                   | `<iframe>` (16:9)       | Better Blocks               |
| `math` (inline/block)           | `<span>` / `<div>`      | Better Blocks               |
| `diagram` (mermaid)             | `<div>` (inline SVG)    | Better Blocks               |
| `callout` (admonition)          | `<aside>`               | Better Blocks               |
| `details` (collapsible)         | `<details>`             | Better Blocks               |
| `button` (CTA / file download)  | `<a>` / `<span>`        | Better Blocks               |
| `social-embed`                  | `<figure>`              | Better Blocks               |
| `audio` (HTML5 player)          | `<figure><audio>`       | Better Blocks               |
| `embed` (generic iframe)        | `<figure><iframe>`      | Better Blocks               |
| `video` (provider-aware)        | `<figure><video>`       | Better Blocks               |

### Block properties

| Property            | Applies to                | Description                                                                                            |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `textAlign`         | paragraph, heading, quote | Text alignment (`left`, `center`, `right`, `justify`)                                                  |
| `lineHeight`        | paragraph, heading, quote | CSS line-height value (e.g. `1.5`, `2.0`)                                                              |
| `indent`            | paragraph, heading, quote | Block indentation level (`marginLeft: N * 2rem`)                                                       |
| `indentLevel`       | list                      | Cycling list-style-type per nesting depth                                                              |
| `format`            | list                      | `ordered`, `unordered`, or `todo`                                                                      |
| `checked`           | list-item (in todo lists) | Checkbox state (`true`/`false`)                                                                        |
| `target`            | link                      | `_blank` for new-tab links                                                                             |
| `rel`               | link                      | `noopener noreferrer` for new-tab links                                                                |
| `language`          | code                      | Shiki grammar for syntax highlighting (e.g. `typescript`, `python`); falls back to `plaintext`         |
| `caption`           | image                     | Text displayed below the image                                                                         |
| `imageAlign`        | image                     | Image alignment (`left`, `center`, `right`)                                                            |
| `url`               | media-embed               | Embed URL (YouTube/Vimeo iframe src)                                                                   |
| `originalUrl`       | media-embed               | Original user-provided URL                                                                             |
| `format`            | math                      | `inline` (`<span>`) or `block` (`<div>`)                                                               |
| `value`             | math                      | LaTeX source rendered with KaTeX                                                                       |
| `format`            | diagram                   | `mermaid` (the only supported diagram format)                                                          |
| `value`             | diagram                   | Mermaid source, rendered to SVG on the server                                                          |
| `summary`           | details                   | Plain-text label for the `<summary>`                                                                   |
| `defaultOpen`       | details                   | Open on initial render (HTML `open` attribute)                                                         |
| `buttonType`        | button                    | `link` (CTA) or `file` (Media Library download)                                                        |
| `label`             | button                    | Visible button text                                                                                    |
| `alignment`         | button                    | `left`, `center`, `right`, or `none` (inline)                                                          |
| `link`              | button                    | `{ url, target?, rel?, ariaLabel? }` (link mode)                                                       |
| `file`              | button                    | `{ url, name, size?, ext?, mime? }` (file mode)                                                        |
| `showFileIcon`      | button                    | Prefix a file-type icon (file mode)                                                                    |
| `showFileSize`      | button                    | Suffix a human-readable size, e.g. `(5 MB)`                                                            |
| `filePreview`       | button                    | `true` opens the file in a new tab instead of downloading                                              |
| `style`             | button                    | Inline CSS + `hover*` colors via custom properties                                                     |
| `cssClass`          | button                    | Extra class appended to `bb-button`                                                                    |
| `platform`          | social-embed              | `twitter`, `instagram`, `facebook`, `tiktok`, `linkedin`, `pinterest`                                  |
| `url`               | social-embed              | Original post URL (used by the fallback link card)                                                     |
| `embedCode`         | social-embed              | Optional manual HTML override (highest priority)                                                       |
| `oembed`            | social-embed              | Fetched oEmbed payload `{ html, title, author, authorUrl, thumbnailUrl, providerName, width, height }` |
| `alignment`         | social-embed              | `left`, `center` (default), or `right`                                                                 |
| `caption`           | social-embed              | Optional caption rendered in a `<figcaption>`                                                          |
| `file`              | audio                     | `{ url, id?, name?, ext?, hash?, mime?, size?, provider?, duration? }` (`url` is rendered as-is)       |
| `title`             | audio                     | Optional heading rendered above the player                                                             |
| `caption`           | audio                     | Optional caption rendered below the player in a `<figcaption>`                                         |
| `player`            | audio                     | `{ controls (default true), autoplay, loop, preload }` (mapped 1:1 to `<audio>`)                       |
| `alignment`         | audio                     | `left`, `center` (default), `right`, or `none` (full-width, inline)                                    |
| `embedHtml`         | embed                     | Sanitized `<iframe>` markup - the only field rendered (via `v-html`)                                   |
| `provider`          | embed                     | `youtube`, `vimeo`, `loom`, `wistia`, `dailymotion`, `api-video`, or `generic`                         |
| `aspectRatio`       | embed, video              | `16:9` (default), `21:9`, `4:3`, `1:1`, or `custom` (→ CSS `aspect-ratio`)                             |
| `customAspectRatio` | embed, video              | Verbatim `aspect-ratio` value (e.g. `3 / 2`) used when `aspectRatio` is `custom`                       |
| `alignment`         | embed, video              | `left`, `center` (default), `right`, or `none` (full-width)                                            |
| `caption`           | embed, video              | Optional caption rendered below in a `<figcaption>`                                                    |
| `title`             | embed, video              | Optional heading rendered above the media                                                              |
| `provider`          | video                     | `local`, `mux`, `api-video`, `cloudinary`, or `custom`                                                 |
| `url`               | video                     | Direct/stream URL (preferred source; for Mux, derivable from `playbackId`)                             |
| `playbackId`        | video                     | Mux public playback id - streams and posters are derived from it                                       |
| `file`              | video                     | Media-Library asset `{ url, id?, name?, ext?, mime?, size?, duration?, provider? }`                    |
| `poster`            | video                     | Poster image URL (derived from a Mux `playbackId` when omitted)                                        |
| `transcript`        | video                     | WebVTT captions URL rendered as `<track kind="captions">`                                              |
| `player`            | video                     | `{ controls (default true), autoplay, loop, muted }` (`muted` forced on with `autoplay`)               |

## Supported Modifiers

| Modifier          | Default element                   | Source        |
| ----------------- | --------------------------------- | ------------- |
| `bold`            | `<strong>`                        | Strapi core   |
| `italic`          | `<em>`                            | Strapi core   |
| `underline`       | `<span>`                          | Strapi core   |
| `strikethrough`   | `<del>`                           | Strapi core   |
| `code`            | `<code>`                          | Strapi core   |
| `uppercase`       | `<span style="text-transform">`   | Better Blocks |
| `superscript`     | `<sup>`                           | Better Blocks |
| `subscript`       | `<sub>`                           | Better Blocks |
| `color`           | `<span style="color">`            | Better Blocks |
| `backgroundColor` | `<span style="background-color">` | Better Blocks |
| `fontFamily`      | `<span style="font-family">`      | Better Blocks |
| `fontSize`        | `<span style="font-size">`        | Better Blocks |

## Custom Renderers

Override any block type or text modifier with your own Vue component. Pass a map of type → component via the `blocks` and `modifiers` props. Each custom component receives its props as ordinary props and its inner content in the **default slot**.

### Custom block renderers

```vue
<script setup lang="ts">
import { BlocksRenderer } from '@qkix/better-blocks-vue-renderer';

import MyParagraph from './MyParagraph.vue';
import MyImage from './MyImage.vue';
import MyTable from './MyTable.vue';

defineProps<{ content: unknown }>();
</script>

<template>
  <BlocksRenderer
    :content="content"
    :blocks="{ paragraph: MyParagraph, image: MyImage, table: MyTable }"
  />
</template>
```

```vue
<!-- MyImage.vue -->
<script setup lang="ts">
defineProps<{
  image: { url: string; alternativeText?: string };
  caption?: string;
  imageAlign?: string;
}>();
</script>

<template>
  <figure :style="{ textAlign: imageAlign }">
    <img :src="image.url" :alt="image.alternativeText || ''" loading="lazy" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>
```

The props each custom block component receives:

| Block                              | Props (children arrive in the default slot where applicable)                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paragraph`                        | `{ style? }`                                                                                                                                      |
| `heading`                          | `{ level: 1–6; style? }`                                                                                                                          |
| `list`                             | `{ format: 'ordered' \| 'unordered' \| 'todo'; indentLevel }`                                                                                     |
| `list-item`                        | `{ checked? }`                                                                                                                                    |
| `link`                             | `{ url; target?; rel? }`                                                                                                                          |
| `quote`                            | `{ style? }`                                                                                                                                      |
| `code`                             | `{ plainText; language? }` (also in the slot)                                                                                                     |
| `image`                            | `{ image; caption?; imageAlign? }` (no slot)                                                                                                      |
| `horizontal-line`                  | _none_                                                                                                                                            |
| `table` / `table-row`              | children in the slot                                                                                                                              |
| `table-cell` / `table-header-cell` | `{ align?; colSpan?; rowSpan? }`, children in the slot                                                                                            |
| `media-embed`                      | `{ url; originalUrl? }` (no slot)                                                                                                                 |
| `math`                             | `{ formula; inline }` (no slot) - bring your own math engine                                                                                      |
| `diagram`                          | `{ code; format }` (no slot) - bring your own diagram engine                                                                                      |
| `callout`                          | `{ variant; title? }`, children in the slot                                                                                                       |
| `details`                          | `{ summary; defaultOpen? }`, children in the slot                                                                                                 |
| `button`                           | `{ label; buttonType; alignment?; link?; file?; showFileSize?; showFileIcon?; filePreview?; style?; cssClass? }`                                  |
| `social-embed`                     | `{ platform; url; embedCode?; oembed?; alignment?; caption? }`                                                                                    |
| `audio`                            | `{ file; title?; caption?; player?; alignment? }`                                                                                                 |
| `embed`                            | `{ embedHtml; embedSrc?; provider?; thumbnail?; aspectRatio?; customAspectRatio?; alignment?; caption?; title? }`                                 |
| `video`                            | `{ provider; url?; playbackId?; assetId?; file?; poster?; title?; caption?; transcript?; player?; alignment?; aspectRatio?; customAspectRatio? }` |

> **`style` is a Vue special case.** Vue routes `class` and `style` to a component's root element unless the component declares them as props. For `paragraph`, `heading` and `quote` that is usually what you want - the alignment/line-height/indent CSS lands on your root element with no work. The `button` block's `style` is **not** CSS but a `ButtonStyle` object (it carries `hoverBackgroundColor` and friends), so a custom `button` renderer should declare `style` as a prop to receive it as data.

### Custom modifier renderers

```vue
<BlocksRenderer :content="content" :modifiers="{ backgroundColor: Highlight }" />
```

```vue
<!-- Highlight.vue -->
<script setup lang="ts">
defineProps<{ backgroundColor: string }>();
</script>

<template>
  <mark :style="{ backgroundColor }"><slot /></mark>
</template>
```

The color/size/font modifiers receive a value prop (`color`, `backgroundColor`, `fontFamily`, `fontSize`); the rest receive only their slot.

## Registered Block Types

`blocks` overrides how a **known** block is drawn. `blockPlugins` adds a block
type this renderer has never heard of - one owned by another package, such as a
chart.

```vue
<script setup lang="ts">
import { BlocksRenderer, type VueBlockPlugin } from '@qkix/better-blocks-vue-renderer';

import Chart from './Chart.vue';

const chart: VueBlockPlugin = {
  type: 'chart',
  // 'void' (attributes only, the default), 'inline' (text), or 'blocks' (nested blocks).
  content: 'void',
  component: Chart,
};
</script>

<template>
  <BlocksRenderer :content="content" :block-plugins="[chart]" />
</template>
```

The component receives the whole node as `node` - this renderer does not know
what attributes the block has, which is the point - and, when the content model
is `inline` or `blocks`, its rendered children in the default slot:

```vue
<script setup lang="ts">
defineProps<{ node: { spec?: { title?: string } } }>();
</script>

<template>
  <figure class="chart" :data-title="node.spec?.title"><!-- … --></figure>
</template>
```

A registered block works at any depth, including inside a callout or a details.

A `VueBlockPlugin` is a core `BlockDefinition` plus `component`, so the same
object that teaches `validateDocument` and `migrateDocument` about the block
also teaches this renderer to draw it. See
[`@qkix/better-blocks-core`](https://www.npmjs.com/package/@qkix/better-blocks-core#registering-a-block-type),
and [`@qkix/chartkit-vue-renderer`](https://www.npmjs.com/package/@qkix/chartkit-vue-renderer)
for a package that ships one.

Passing plugins explicitly, rather than registering them into a global, is
deliberate: this renderer runs on servers handling concurrent requests, where
mutable module state leaks one page's registrations into another's.

A block type nobody registered renders nothing, exactly as an unknown one does.

## TypeScript

All types are exported:

```ts
import type {
  BlocksContent,
  BlocksRendererProps,
  BlockNode,
  TextNode,
  LinkNode,
  ListNode,
  ListItemNode,
  ParagraphNode,
  HeadingNode,
  QuoteNode,
  CodeNode,
  ImageNode,
  HorizontalLineNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  TableHeaderCellNode,
  MediaEmbedNode,
  MathNode,
  DiagramNode,
  DiagramTheme,
  CalloutNode,
  DetailsNode,
  ButtonElement,
  SocialEmbedNode,
  SocialPlatform,
  AudioNode,
  EmbedNode,
  VideoNode,
  TextAlign,
  CustomBlocksConfig,
  CustomModifiersConfig,
  VueBlockPlugin,
  ExtendedBlocksContent,
} from '@qkix/better-blocks-vue-renderer';
```

## Contributing

Contributions are welcome! This package lives in the
[strapi-plugin-better-blocks](https://github.com/qkix/strapi-plugins)
monorepo, next to the Strapi plugin and the React and Astro renderers. The
easiest way to get started is with Docker:

```bash
git clone https://github.com/qkix/strapi-plugins.git
cd strapi-plugin-better-blocks

docker compose up --build
```

That brings up a Strapi v5 instance running the Better Blocks plugin, seeded
with the showcase articles, plus every renderer displaying the same content.

- **Strapi admin:** http://localhost:1337/admin (login: `admin@example.com` / `admin12#`)
- **Nuxt example:** http://localhost:3000
- **Astro example:** http://localhost:4321
- **React example:** http://localhost:5173

### Development workflow

1. Edit the `.vue` components in `packages/better-blocks-vue-renderer/src/`
2. Rebuild with `docker compose up --build` - the renderer is compiled into the image
3. Editing `examples/nuxt-app/` hot-reloads on its own, with no rebuild

### Without Docker

```bash
pnpm install
pnpm build   # every publishable package, this one included

pnpm --filter @qkix/example-strapi-app develop
pnpm --filter @qkix/example-nuxt-app dev   # in another terminal
```

### Running tests

```bash
pnpm test        # every package, from the repo root
pnpm typecheck
pnpm lint

pnpm --filter @qkix/better-blocks-vue-renderer test   # just this one
```

## Community & Support

- [GitHub Issues](https://github.com/qkix/strapi-plugins/issues) - Bug reports and feature requests

## Related

- [@qkix/better-blocks-react-renderer](https://github.com/qkix/strapi-plugins/tree/main/packages/better-blocks-react-renderer) - React renderer with the same Better Blocks support
- [@qkix/better-blocks-astro-renderer](https://github.com/qkix/strapi-plugins/tree/main/packages/better-blocks-astro-renderer) - Astro renderer, zero client-side JavaScript
- [@qkix/chartkit-vue-renderer](https://github.com/qkix/strapi-plugins/tree/main/packages/chartkit-vue-renderer) - charts as a registered block type
- [@qkix/strapi-plugin-better-blocks](https://github.com/qkix/strapi-plugins) - Strapi plugin that extends the Blocks editor with colors, tables, to-do lists, media embeds, and more

## Support this project

This package is built and maintained in my free time, and it's free for everyone. If it has saved you time on a project, you can help keep it caffeinated and actively developed:

<a href="https://buymeacoffee.com/qkix">
  <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black&style=for-the-badge" />
</a>

Every coffee goes toward fixing bugs, reviewing PRs, writing docs, and shipping the features you ask for. Thank you! &#9749;

## License

[MIT License](LICENSE) &copy; [qkix](https://github.com/qkix)
