## 0.17.0 (2026-08-15)

### 🚀 Features

- **core:** validate documents and migrate the legacy media-embed block ([c5d7659](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c5d7659))
- **examples:** one Strapi instance and both renderers on the same content ([66465a7](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/66465a7))

### 🩹 Fixes

- keep generated changelogs out of prettier's way ([#96](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/96))

### ❤️ Thank You

- kkukielka

## 0.16.1 (2026-08-15)

### 🚀 Features

- **core:** validate documents and migrate the legacy media-embed block ([c5d7659](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c5d7659))
- **examples:** one Strapi instance and both renderers on the same content ([66465a7](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/66465a7))

### 🩹 Fixes

- keep generated changelogs out of prettier's way ([#96](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/96))

### 🧱 Updated Dependencies

- Updated @k11k/better-blocks-core to 0.1.1

### ❤️ Thank You

- kkukielka

# @k11k/better-blocks-react-renderer

## 0.16.0

### Minor Changes

- [#55](https://github.com/k11k-labs/better-blocks-react-renderer/pull/55) [`a8b0d6e`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/a8b0d6e7a548e0c26a12d715bc6fcc983d718647) Thanks [@kkukielka](https://github.com/kkukielka)! - GitHub-style defaults for tables, blockquotes and code blocks

  Tables, blockquotes, and code blocks previously rendered as bare markup. They now ship with GitHub-flavored defaults out of the box — each with a stable `bb-*` class and styles injected only when the block is present (and skipped when you override it), rethemable via CSS custom properties, and still fully overridable through the existing `blocks={{ … }}` prop.

  **Tables** → `<table class="bb-table">`: bordered cells, a shaded header, zebra-striped body rows, and horizontal scroll on overflow. Retheme via `--bb-table-border`, `--bb-table-header-bg`, `--bb-table-row-bg`, `--bb-table-stripe-bg`.

  **Blockquotes** → `<blockquote class="bb-quote">`: a muted left border with indented, dimmed text. Retheme via `--bb-quote-border`, `--bb-quote-fg`.

  **Code blocks** → syntax highlighting with Shiki, wrapped in `<div class="bb-code">`:
  - Added a `language` field to `CodeNode` — the Strapi editor already stores it, the renderer just dropped it. Values are mapped to Shiki grammar ids (`objectivec` → `objective-c`, `fortran` → `fortran-free-form`, `vbnet` → `vb`, …); unknown or missing languages fall back to themed-but-unhighlighted `plaintext`, so a stray value never breaks the page.
  - Shiki resolves grammars asynchronously, so highlighting happens on the client the same way diagrams do: SSR and first paint emit the raw source in a plain `<pre class="bb-code-pre">` (matching hydration), then the highlighted markup swaps in after mount. If Shiki fails to load, the plain `<pre>` stays. Retheme the pre-hydration colors via `--bb-code-fallback-bg` / `--bb-code-fallback-fg`.
  - New `codeTheme` prop — any bundled Shiki theme (`github-dark` default).
  - New `codeCopyButton` prop — off by default; when enabled, adds a "Copy" button in the top-right corner.

  Custom `code` renderers now also receive `language` (the raw editor value, not the Shiki grammar id) alongside `plainText`.

  The class hooks and custom properties match the Astro renderer, so a single shared CSS theme covers both.

## 0.15.0

### Minor Changes

- [#53](https://github.com/k11k-labs/better-blocks-react-renderer/pull/53) [`9378275`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/9378275aa9e52fabbd4f4972fcda4e7eed7c7073) Thanks [@kkukielka](https://github.com/kkukielka)! - Render the new table cell properties and semantic header rows

  `table-cell` and `table-header-cell` now honor `align` (applied as `text-align`) and `colSpan` / `rowSpan` (mapped onto the HTML attributes of the same name). Each is omitted by the editor at its default — absent `align` means left, absent spans mean 1 — so existing documents render exactly as before.

  Leading rows whose cells are all `table-header-cell` are treated as the table's header: they render inside `<thead>` with each cell as `<th scope="col">`, and the remaining rows in `<tbody>`. Several such rows are supported, so a merged header (a `rowSpan` label above a split sub-header) lands in `<thead>` intact. A `table-header-cell` inside a body row is a row header and gets `scope="row"`.

  Custom `table-cell` / `table-header-cell` renderers receive `align`, `colSpan`, `rowSpan`, and a ready-made `style` alongside `children`.

## 0.14.0

### Minor Changes

- [#51](https://github.com/k11k-labs/better-blocks-react-renderer/pull/51) [`034bd02`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/034bd028b23e94930cff61f1f2805a9280e6e3d9) Thanks [@kkukielka](https://github.com/kkukielka)! - Render the new `embed` and `video` blocks

  `embed` renders the plugin-sanitized `embedHtml` inside an alignment container and a CSS `aspect-ratio` box, with `caption` as a `<figcaption>` and a plain-link fallback when the source was cleared. Override the `embed` block to receive the parsed parts (`embedSrc`, `provider`, `thumbnail`, …) instead of the stored HTML.

  `video` renders a native HTML5 player for direct file URLs, mapping the nested `player` flags 1:1 and adding a `<track kind="captions">` for `transcript`. HLS/DASH sources are upgraded opportunistically with no new dependency: `provider: "mux"` nodes render `<mux-player>` when that custom element is registered, `.m3u8` sources attach `hls.js` when it is exposed as `window.Hls`, and otherwise playback falls back to the native element (Safari) or the `poster`.

  The deprecated `media-embed` block keeps rendering as before, so existing documents are unaffected.

## 0.13.0

### Minor Changes

- [#47](https://github.com/k11k-labs/better-blocks-react-renderer/pull/47) [`e9f0d69`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/e9f0d69e72b7b44e853ca377f5cf64096996bfc5) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix social embeds never hydrating (TikTok, Pinterest) and not re-processing on remount
  - Strip `<script>` tags from the injected embed HTML. Providers that ship their widget script inline in the oEmbed payload (TikTok always; pasted Instagram snippets often) left an inert `<script src="…">` in the DOM — inserted via `dangerouslySetInnerHTML` it never executes, but it matched the loader's `script[src="…"]` dedupe check, so the real widget script was never injected and the embed stayed a raw blockquote.
  - Dedupe the loader on `script[data-bb-social-script="{platform}"]`, a marker only set on scripts the renderer injected itself.
  - Re-process embeds mounted after the widget script has loaded (remount, client-side navigation). TikTok (`tiktokEmbed.lib.render()`) and Pinterest (`PinUtils.build()`) had no processor at all; when a platform global is missing the renderer now re-injects the script once so it rescans the document.
  - `url` is now optional on `SocialEmbedNode` and the `social-embed` block override, matching the plugin allowing an embed saved with only an `embedCode`. The fallback card renders as a `<div>` rather than an `<a href="">` when there is no URL.
  - The fallback card no longer repeats itself. With no oEmbed title or author it used to stack `View on X` over a provider line reading `X`; the provider line is now dropped in that case, and an author-only card reads `Post by <author>` over the provider.

## 0.12.0

### Minor Changes

- [`04a755b`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/04a755bbeb2395f8765750deceec898c4bc8a64d) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: render the new `audio` block (Media Library + customizable HTML5 player)

  Adds a default renderer for the Better Blocks `audio` node. Embeds audio from the
  Strapi Media Library (or a raw URL) via a native `<audio>` element whose player
  flags map 1:1 (`controls` defaulting to `true`, `autoplay`, `loop`, `preload`).
  `file.url` is rendered as-is (already backend-prefixed, like `image`/`button`).

  The player is wrapped in a `<figure className="bb-audio align-{alignment}">`
  (alignment defaults to `center`; `none` = full-width). An optional `title` renders
  above and an optional `caption` below, each in a `<figcaption>`. The `<audio>` gets
  an `aria-label` (the title, falling back to `"Audio player"`) and, when a caption is
  present, an `aria-describedby` pointing at it. Fallback text plus a download link
  render inside `<audio>` for unsupported formats/browsers. Baseline appearance ships
  as inline styles with stable `bb-audio*` classes for consumer overrides.

  Override the built-in with the `blocks={{ audio: … }}` map. New exported types:
  `AudioNode`, `AudioFile`, `AudioPlayer`, `AudioPreload`, `AudioAlignment`.

## 0.11.0

### Minor Changes

- [#40](https://github.com/k11k-labs/better-blocks-react-renderer/pull/40) [`a6fc956`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/a6fc956c7afbf36478afe3c27432130d99e3d698) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: render the new `social-embed` block (Twitter/X, Instagram, Facebook, TikTok, LinkedIn, Pinterest)

  Adds a default renderer for the Better Blocks `social-embed` node. Embed HTML is
  chosen by priority: `embedCode` (manual override) → `oembed.html` → a graceful
  fallback link card built from `oembed` (`thumbnailUrl` / `title` / `author`) when
  neither is present. The embed is wrapped in a `<figure>` with an alignment class
  (`social-embed align-{alignment}`, default `center`), an `aria-label` describing
  the post, an optional `<figcaption>` caption, and `loading="lazy"` on any embed
  `<iframe>`.

  Platform widget scripts (Twitter, Instagram, TikTok, Pinterest, Facebook) are
  loaded once per platform — deduped by URL and guarded against double-injection —
  then their processor is re-run on mount so freshly-mounted embeds get upgraded
  (LinkedIn renders a self-contained `<iframe>` and needs no script). Script
  loading is client-only, keeping SSR/hydration consistent.

  Override the built-in with the `blocks={{ 'social-embed': … }}` map. New exported
  types: `SocialEmbedNode`, `SocialPlatform`, `SocialEmbedAlignment`,
  `SocialEmbedOembed`.

## 0.10.1

### Patch Changes

- [#35](https://github.com/k11k-labs/better-blocks-react-renderer/pull/35) [`a60f6e3`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/a60f6e3eac719a736bd060a0bd25bd066b79bfa4) Thanks [@kkukielka](https://github.com/kkukielka)! - fix: button hover/focus styles now work out of the box

  Button hover colors (`hoverBackgroundColor` / `hoverTextColor`) previously did
  nothing on the frontend unless the consumer manually added a `.bb-button:hover`
  CSS rule — only the `--bb-button-hover-*` custom properties were set. The
  renderer now ships a small default `<style>` (emitted once, only when a default
  button is present) wiring hover and `:focus-visible` to those properties, with a
  fallback to the base colors so buttons without hover colors keep their colors on
  hover. This matches the Astro renderer's zero-setup behavior.

## 0.10.0

### Minor Changes

- [#33](https://github.com/k11k-labs/better-blocks-react-renderer/pull/33) [`e5cc53c`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/e5cc53cd16d2511d7d31ac0fb61fe2c31b82eeec) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: fix cross-origin file downloads and add `filePreview` toggle for file buttons

  File-mode buttons now force a real download via a blob fetch, so cross-origin
  assets (Strapi/CDN) download instead of opening inline in the browser — the
  native `download` attribute is ignored cross-origin, which made PDFs, videos and
  images preview rather than save. CORS-blocked fetches fall back to native
  navigation.

  Adds the `filePreview` option (mirrors the editor field): when `true`, the file
  opens in a new tab (`target="_blank" rel="noopener noreferrer"`) for preview
  instead of downloading. `filePreview` is also passed through to custom `button`
  renderers.

## 0.9.0

### Minor Changes

- [#28](https://github.com/k11k-labs/better-blocks-react-renderer/pull/28) [`7515d84`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/7515d84baaad89308b3c0e60b46f2d3262bc484d) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `button` block (WordPress-style CTA + Media Library file download). Link mode renders an `<a>` with `href`/`target`/`rel`/`aria-label`; file mode renders a download link with an optional file-type icon (`showFileIcon`) and human-readable size (`showFileSize`). The `style` object is applied as inline CSS, `alignment` controls a block-level wrapper, hover colors are exposed as CSS custom properties, and the block is overridable through the `blocks.button` prop.

## 0.8.0

### Minor Changes

- [#25](https://github.com/k11k-labs/better-blocks-react-renderer/pull/25) [`b9a43e3`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/b9a43e3a59285411a4658fd084e2c88509697729) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for the `details` (collapsible) block. It renders a native, accessible `<details>` / `<summary>` disclosure, honors `defaultOpen` via the HTML `open` attribute, supports arbitrarily nested `details`, and can be overridden through the `blocks.details` prop.

## 0.7.1

### Patch Changes

- [`4e64512`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/4e6451222caa8d46fefd7d65f3a57ba780f1c16c) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix callout (admonition) blocks not showing a background color on the frontend. The default callout renderer now applies a subtle accent-tinted background, balances the vertical spacing to match GitHub's alert styling, and uses GitHub's exact Caution accent color.

## 0.7.0

### Minor Changes

- [#19](https://github.com/k11k-labs/better-blocks-react-renderer/pull/19) [`4bb5d32`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/4bb5d32f3d6c353733d904de13c3dc9dc88e9453) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for `callout` (admonition) nodes from the Better Blocks plugin (`{ type: 'callout', variant, title?, children }`). Callouts render GitHub-style in five variants — note, tip, important, warning, caution — as an `<aside role="note">` with a colored left border, a title row (icon + label, or the node's custom `title`), and the nested block children rendered recursively. Colors are inlined so no stylesheet is required. The block can be overridden with a custom `callout` renderer that receives `variant`, `title`, and `children`.

## 0.6.0

### Minor Changes

- [#17](https://github.com/k11k-labs/better-blocks-react-renderer/pull/17) [`f2ca6ba`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/f2ca6ba5118b4f5a8cb4ffea5ffbaa36c0d4cecc) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for block-level Mermaid `diagram` nodes from the Better Blocks plugin (`{ type: 'diagram', format: 'mermaid', value }`). Diagrams render to inline SVG on the client using a lazy-loaded `mermaid` instance. SSR and the first client render emit the raw Mermaid source in a `<pre>` (so hydration matches), then swap in the rendered SVG after mount; if Mermaid fails to parse the source, the raw text remains as a graceful fallback. The block can be overridden with a custom `diagram` renderer that receives `code` and `format` props.

## 0.5.1

### Patch Changes

- [#15](https://github.com/k11k-labs/better-blocks-react-renderer/pull/15) [`bd6f61b`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/bd6f61b4dd6642ce0578ce11f70ea3155cc11eb3) Thanks [@kkukielka](https://github.com/kkukielka)! - Document Astro integration in the README. Adds an "Astro" usage section covering `@astrojs/react`, when a client directive is (and isn't) needed, the `katex/dist/katex.min.css` import, and the island prop serialization caveat for custom renderers.

## 0.5.0

### Minor Changes

- [#13](https://github.com/k11k-labs/better-blocks-react-renderer/pull/13) [`4d8f91b`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/4d8f91b7da484acf0629539d10b77d63b35ab7a1) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for KaTeX/LaTeX math nodes from the Better Blocks plugin. Inline math renders as `<span class="katex-inline">` and block math as `<div class="katex-block">`, using `katex.renderToString` for SSR-safe output. Math falls back to the raw LaTeX source if KaTeX fails to parse, and can be overridden with a custom `math` block renderer (e.g. to use MathJax). Consumers should import `katex/dist/katex.min.css` once in their app.

## 0.4.0

### Minor Changes

- [#9](https://github.com/k11k-labs/better-blocks-react-renderer/pull/9) [`c8de109`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/c8de1095dd051d18d18501ca3f0825228a5be5b3) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for Better Blocks plugin v0.5.0-v0.6.0 features: uppercase, superscript, subscript modifiers, font family and size marks, line height and block indent properties

## 0.3.0

### Minor Changes

- [#7](https://github.com/k11k-labs/better-blocks-react-renderer/pull/7) [`53d7fba`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/53d7fba63ecb6cd7656ad092029568da46ac4def) Thanks [@kkukielka](https://github.com/kkukielka)! - Add support for Better Blocks plugin v0.4.0 features: horizontal line, link target/rel, text alignment, to-do lists, tables, media embeds, image captions and alignment

## 0.2.0

### Minor Changes

- [#5](https://github.com/k11k-labs/better-blocks-react-renderer/pull/5) [`c19439c`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/c19439c1877c25a37a4f5701dff3011e4d55325b) Thanks [@kkukielka](https://github.com/kkukielka)! - Add indentLevel support for nested lists with per-level style cycling

## 0.1.1

### Patch Changes

- [#3](https://github.com/k11k-labs/better-blocks-react-renderer/pull/3) [`535c744`](https://github.com/k11k-labs/better-blocks-react-renderer/commit/535c7444297fde84e47eca86036407d616880840) Thanks [@kkukielka](https://github.com/kkukielka)! - Test changeset workflow
