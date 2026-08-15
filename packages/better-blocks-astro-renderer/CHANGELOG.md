# @k11k/better-blocks-astro-renderer

## 0.12.0

### Minor Changes

- [#42](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/42) [`ab64867`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/ab6486756cabdef328d2b4e30d5a3bac64b85a69) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: table cell alignment, spans, and semantic header rows

  Adds renderer support for the table authoring features from Better Blocks.

  - **`align`** — `table-cell` / `table-header-cell` may carry `align` (`left` / `center` / `right`), mapped to inline `text-align`. Omitted means left, so existing documents render unchanged.
  - **`colSpan` / `rowSpan`** — map straight onto the `colspan` / `rowspan` HTML attributes. Omitted (or `1`) emits no attribute, matching hand-written HTML — a spanned-over slot simply has no node.
  - **Semantic header rows** — a leading row whose cells are all header cells is grouped into `<thead>` and its cells render as `<th scope="col">` for screen-reader header announcement; the rest go into `<tbody>` as `<td>`.
  - Cell `children` continue to route through the standard inline renderer, so marks (bold, links, inline math, colors, …) render inside cells.

  Custom `table-cell` / `table-header-cell` overrides now receive `align`, `colSpan`, and `rowSpan` as props.

## 0.11.0

### Minor Changes

- [#39](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/39) [`cfe0405`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/cfe04057e1477beeb22d67884acf4814dc3b1af2) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: render the new `embed` and `video` blocks

  Adds two block types introduced by Better Blocks, both static HTML with no client-side JavaScript.

  - **`embed`** — a generic third-party embed (YouTube, Vimeo, Loom, Wistia, Dailymotion, api.video, generic). Renders the plugin-sanitized `embedHtml` verbatim via `set:html` inside a `<figure class="bb-embed">` with a CSS `aspect-ratio` box and flex alignment. Aligned embeds are capped by the retheme-able `--bb-embed-max-width`; `alignment: none` flows full-width. Optional `title`/`caption` render as `<figcaption>`s. Override via `blocks={{ embed }}`.
  - **`video`** — a provider-aware player (`local`, `mux`, `api-video`, `cloudinary`, `custom`) rendered as a native `<video>`. Picks the source from `url` → `file.url` → a Mux stream derived from `playbackId` (with a derived poster), maps `player.*` 1:1 to the element (`muted` forced on with `autoplay`), adds a `<track kind="captions">` from `transcript`, and wires `caption` via `aria-describedby`. HLS/DASH sources only play natively in Safari, so streaming figures are marked `data-hls` and fall back to the poster plus an open-link — override via `blocks={{ video }}` for a cross-browser player.

  Existing `media-embed` handling is unchanged; the plugin deprecates it but keeps rendering documents that still contain it.

## 0.10.1

### Patch Changes

- [#36](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/36) [`7bee391`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/7bee39190adbb9ae7bb56dfa78855799026fd4d7) Thanks [@kkukielka](https://github.com/kkukielka)! - fix(social-embed): drop duplicate widget scripts, re-process TikTok, and avoid empty fallback hrefs

  - **No duplicate widget scripts.** Widget `<script>` tags shipped inline in the embed markup — TikTok's oEmbed always ships one (there's no `omit_script` parameter) and hand-pasted Instagram/Facebook codes may too — are now stripped before render, so the lazy loader is the single script injector. This also repairs content saved by plugin versions that stored the scripts server-side.
  - **TikTok re-processes.** The lazy loader now calls `tiktokEmbed.lib.render()` for embeds that scroll in after `embed.js` has loaded or that arrive via an `astro:page-load` view-transition navigation, with a fallback to re-injecting the script when the global is absent. Previously such TikTok embeds stayed a raw blockquote.
  - **No empty fallback `href`.** The fallback card renders as a non-interactive `<div>` (instead of `<a href="">`) for embed-code-only nodes that carry no post URL. `SocialEmbedNode.url` is now optional to reflect this.

## 0.10.0

### Minor Changes

- [#34](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/34) [`18c3a13`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/18c3a1393542d55983ac17eb0883d79856b24dd8) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: GitHub-style defaults for tables, blockquotes, and code blocks

  Tables, blockquotes, and code blocks now ship with GitHub-flavored defaults out of the box — no CSS to import.

  - **Tables** render as `<table class="bb-table">` with bordered cells, a shaded header, and zebra-striped body rows. Leading header rows are grouped into `<thead>`, the rest into `<tbody>`, and the table scrolls horizontally on overflow. Retheme via the `--bb-table-*` custom properties.
  - **Blockquotes** render as `<blockquote class="bb-quote">` with a muted left border and dimmed text. Retheme via the `--bb-quote-*` custom properties.
  - **Code blocks** are syntax-highlighted with Shiki via Astro's built-in `<Code />` component (build/SSR, zero client-side JavaScript). The `code` node's new `language` field selects the grammar; unknown or missing languages fall back to `plaintext`. New `codeTheme` prop picks any bundled Shiki theme (`github-dark` default), and the opt-in `codeCopyButton` prop adds a copy button (off by default to preserve zero-JS output).

  Each default carries stable `bb-*` classes and a scoped `<style>`, and — as with every block — can be fully overridden via `blocks={{ table, quote, code }}`.

## 0.9.0

### Minor Changes

- [#30](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/30) [`1a957ad`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/1a957adb44c732191356e9f70243e109ccd346c2) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `audio` block (Media Library + customizable HTML5 player). Embeds audio from the Strapi Media Library or a raw URL via a native `<audio class="bb-audio-player">` element whose player flags map 1:1 (`controls` defaulting to `true`, `autoplay`, `loop`, `preload`), with **zero client-side JavaScript**. `file.url` is rendered as-is (already backend-prefixed, like `image`/`button`). The player is wrapped in a `<figure class="bb-audio align-{alignment}">` (alignment defaults to `center`; `none` = full-width) with an optional `title` above and `caption` below, each in a `<figcaption>`. For accessibility the `<audio>` gets an `aria-label` (the title, falling back to `"Audio player"`) and, when a caption is present, an `aria-describedby` pointing at it, plus fallback text and a download link inside the element for unsupported formats/browsers. Markup, inline styles, and the `bb-audio*` class hooks are byte-for-byte compatible with the [React renderer](https://github.com/k11k-labs/better-blocks-react-renderer), so a shared CSS theme covers both. Overridable through the `blocks['audio']` prop. New exported types: `AudioNode`, `AudioFile`, `AudioPlayer`, `AudioPreload`, `AudioAlignment`.

## 0.8.0

### Minor Changes

- [#27](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/27) [`8b8efb1`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/8b8efb1f038e332dc64df2fe6cf4b1c729d2c317) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `social-embed` block (Twitter/X, Instagram, Facebook, TikTok, LinkedIn, Pinterest). The renderer follows the plugin's source priority — author-pasted `embedCode` → provider `oembed.html` → a graceful `<a>` link card (with author/thumbnail/title when available) — and emits the trusted embed markup verbatim inside an accessible `<figure class="bb-social-embed bb-social-embed-{platform} social-embed align-{alignment}" aria-label="{provider} post by {author}">` with an optional `<figcaption>`. Markup, class hooks, type surface (`SocialEmbedNode`, `SocialPlatform`, `SocialEmbedAlignment`, `SocialEmbedOembed`), and provider labels (Twitter presents as “X”) match the React renderer, so shared CSS themes both. Platform widget scripts (twitter/instagram/tiktok/pinterest/facebook) load **lazily and deduped** via an IntersectionObserver: no third-party JavaScript loads until an embed nears the viewport, each script is injected at most once per page, and embeds are re-processed on `astro:page-load` for view-transition navigations. LinkedIn needs no script (self-contained `<iframe>`), and `loading="lazy"` is added to provider iframes that don't already declare it. The block is overridable through the `blocks['social-embed']` prop.

## 0.7.0

### Minor Changes

- [#22](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/22) [`02fd553`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/02fd553bfcde708c645f665e0cad91575b088ac0) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix cross-origin file downloads and add a `filePreview` toggle for file buttons.

  File-mode download buttons are now tagged `data-bb-download` and force a real download via a small scoped progressive-enhancement script (a blob fetch saved from a same-origin object URL). The native `download` attribute is ignored for cross-origin assets (Strapi/CDN), which made PDFs, videos and images preview inline instead of saving. Without JavaScript the anchor still works via its `href` + `download` attributes, and a CORS-blocked fetch falls back to native navigation.

  Adds the `filePreview` option (mirrors the editor field): when `true`, the file opens in a new tab (`target="_blank" rel="noopener noreferrer"`, no download) for preview instead of downloading — this path stays fully zero-JS. `filePreview` is also passed through to custom `button` renderers.

## 0.6.0

### Minor Changes

- [#18](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/18) [`6b5acfb`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/6b5acfb83e33904e2feb0cbc9b57b386d2a2951c) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `button` block (WordPress-style CTA + Media Library file download). Link mode renders an `<a>` with `href`/`target`/`rel`/`aria-label`; file mode renders a download link with an optional file-type icon (`showFileIcon`) and human-readable size (`showFileSize`). The `style` object is applied as inline CSS, `alignment` controls a block-level wrapper, and hover colors are exposed as `--bb-button-hover-*` custom properties wired up by a scoped stylesheet (hover transition + keyboard focus ring, zero client-side JavaScript). The block is overridable through the `blocks.button` prop.

## 0.5.1

### Patch Changes

- [#16](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/16) [`d61c771`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/d61c77174d9534a12b3c0dcaf53c081d7d8af3c4) Thanks [@kkukielka](https://github.com/kkukielka)! - Render Mermaid diagrams in color. Previously diagrams were passed to `beautiful-mermaid` with no palette, so every color was derived from a single dark foreground and the output looked monochrome. They now default to a palette that mirrors mermaid.js's familiar look (lavender node fills, purple borders, dark edges), and a new `diagramTheme` prop on `BlocksRenderer` accepts either a built-in theme name (`github-light`, `github-dark`, `dracula`, `nord`, `tokyo-night`, …) or a custom color object (`{ bg, fg, line, accent, muted, surface, border }`). The theme also propagates to diagrams nested inside `callout` and `details` blocks.

## 0.5.0

### Minor Changes

- [#12](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/12) [`26e1a4a`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/26e1a4aa212ca34a62f2248577ed786d57b1d720) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `details` (collapsible) block. It renders a native, accessible `<details>` / `<summary>` disclosure with zero client-side JavaScript, honors `defaultOpen` via the HTML `open` attribute, supports arbitrarily nested `details`, and ships a scoped GitHub-inspired stylesheet (retheme via `--bb-details-*` custom properties). Replace the markup entirely through the `blocks.details` prop.

## 0.4.1

### Patch Changes

- [`e242e0a`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/e242e0a8daee451420bf675cb0f7a6c53f73d870) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix bottom-heavy callout spacing and align callout styling with GitHub's light alert palette. The body's outer margins now collapse correctly (the scoped `:first-child`/`:last-child` rules are applied via `:global()` so they reach the cross-component body blocks), an ~8% accent-tinted background is added to match the editor preview, and the title spacing and per-variant colors match GitHub's official tokens.

## 0.4.0

### Minor Changes

- [#6](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/6) [`43d33b5`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/43d33b5c84561f58669282275ff2011229cfe29a) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for `callout` (admonition) nodes from the Better Blocks plugin (`{ type: 'callout', variant, title?, children }`). Callouts render GitHub-style in five variants — note, tip, important, warning, caution — as an `<aside role="note">` with a colored left border, a title row (icon + label, or the node's custom `title`), and the nested block children rendered recursively. Colors ship in a scoped `<style>` (zero client-side JavaScript) and adapt to dark mode via `prefers-color-scheme`; the per-variant accent is exposed as a `--bb-callout-accent` custom property for easy retheming. The block can be overridden with a custom `callout` component that receives `variant` and `title` (children via `<slot />`).

## 0.3.0

### Minor Changes

- [#4](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/4) [`7930308`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/79303080a7d8dade5305d7ce27a5378a5a1b969e) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for block-level Mermaid `diagram` nodes from the Better Blocks plugin (`{ type: 'diagram', format: 'mermaid', value }`). Diagrams are pre-rendered to inline SVG on the server with `beautiful-mermaid`, so the output is static HTML with **zero client-side JavaScript** — no browser, no hydration, no Chromium download. Supported diagram types (flowchart, sequence, state, class, ER, xychart) render to `<div class="mermaid-diagram">`; unsupported types and parse errors fall back to the raw source in `<pre class="mermaid-source">` so content is never lost. The block can be overridden with a custom `diagram` renderer that receives `code` and `format` props.

## 0.2.0

### Minor Changes

- [#1](https://github.com/k11k-labs/better-blocks-astro-renderer/pull/1) [`237946b`](https://github.com/k11k-labs/better-blocks-astro-renderer/commit/237946b5b99b6e581cea7e70443bb5137c77920f) Thanks [@kkukielka](https://github.com/kkukielka)! - Initial release. Native Astro renderer for Strapi v5 Blocks content with full Better Blocks support — paragraphs, headings, lists (ordered/unordered/todo), links, quotes, code, images, horizontal lines, tables, media embeds, and KaTeX math, plus all text modifiers (bold, italic, underline, strikethrough, code, uppercase, super/subscript, color, background color, font family, font size). Renders to static HTML with zero client-side JavaScript and supports custom block/modifier renderers via Astro components.
