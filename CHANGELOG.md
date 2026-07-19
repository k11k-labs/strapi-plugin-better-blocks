# @k11k/strapi-plugin-better-blocks

## 0.19.0

### Minor Changes

- [#77](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/77) [`6e4c106`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/6e4c106e56d02007c29c253ce9cb26bf7f56d6de) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: generic Embed block and provider-aware Video block (closes [#44](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/44))

  **Embed block** — insert any third-party embed from the `+` Insert menu, the
  `/embed` slash command, or the toolbar's media button. Two modes: **URL**
  (YouTube, Vimeo, Loom, Wistia, Dailymotion and api.video are converted to an
  iframe automatically) and **Embed code** (paste any platform's `<iframe>`).
  Pasted markup is never stored verbatim — the iframe is rebuilt from an attribute
  allowlist over an https-only `src`, so `<script>`, event handlers, inline styles
  and unknown attributes cannot reach your frontend, and the `allow` attribute is
  filtered to a safe permission set. Adds live in-editor preview, aspect ratio
  (16:9 / 21:9 / 4:3 / 1:1 / custom), alignment, caption and an accessible title.

  **Video block** — source a video from the Media Library, a direct URL, or a
  hosting provider. Mux, api.video and Cloudinary URLs are detected automatically,
  and a bare Mux playback ID fills in the stream URL and poster frame. When
  `strapi-plugin-mux-video-uploader` is installed and configured, a **Mux** button
  lists and searches your Mux assets inline with thumbnails (assets with a signed
  playback policy are not selectable, since they need a per-request JWT that a
  stored token could not satisfy). Supports poster image, title, caption, WebVTT
  captions/transcript, alignment, aspect ratio and player settings.

  The YouTube/Vimeo-only `media-embed` block is **deprecated**: nothing inserts it
  any more and the toolbar media button now creates an `embed` node instead, but
  existing `media-embed` content still renders, and renderers should keep handling
  it.

  Both blocks' JSON shapes are documented in the README for frontend renderers,
  along with the `frame-src` / `img-src` / `media-src` CSP hosts they need.

## 0.18.0

### Minor Changes

- [#75](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/75) [`2bcbe8b`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/2bcbe8bb5f39a676ee634c9de5ff84dbdb0b17cf) Thanks [@kkukielka](https://github.com/kkukielka)! - Social embeds can now show the real post inside the editor. Each card gets a
  **Show live post** toggle that swaps in the platform's script-free iframe embed
  (X, Instagram, Facebook, TikTok, LinkedIn, Pinterest) — no widget JavaScript
  runs in the admin, so the `script-src 'self'` CSP is untouched.

  Third-party frames load only after that click, never on page load, and the
  choice isn't persisted in the content. Add the platform hosts you use to
  `frame-src` in `config/middlewares.ts` (see the README) — without them the card
  still works, the frame just renders empty.

### Patch Changes

- [#75](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/75) [`2bcbe8b`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/2bcbe8bb5f39a676ee634c9de5ff84dbdb0b17cf) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix social embeds that rely on a pasted embed code, and stop TikTok/Pinterest
  posts from degrading to a bare link on the frontend.
  - **Embed code alone is now enough** — Save is enabled when either a post URL or
    an embed code is present, so platforms without a tokenless oEmbed (Instagram,
    Facebook) can be embedded by pasting their snippet. Pasting a snippet also
    recovers the permalink from it (`data-instgrm-permalink`, `cite`, `href`) and
    auto-detects the platform.
  - **Widget scripts are stripped** from both fetched oEmbed markup and pasted
    embed codes. A `<script>` injected via `innerHTML` never executes, and its
    inert tag made renderers believe the platform widget was already loaded — the
    cause of TikTok posts rendering as a raw blockquote of links.
  - **Failed oEmbed lookups now surface an error** instead of silently storing an
    empty payload. Pinterest answers HTTP 200 with `{"error": …}` for unresolvable
    pins, which previously saved an embed with no markup that rendered as a
    "View on Pinterest" fallback card.
  - **`pin.it` short links are resolved** to their canonical `/pin/<id>/` URL
    before the Pinterest oEmbed request, which rejects short links.
  - **LinkedIn embeds keep their URN type.** Every id was rewritten to
    `urn:li:share:<id>`, which LinkedIn 404s for the activity ids that appear in
    share URLs, so no LinkedIn post ever loaded. The type from the URL
    (`activity` / `ugcPost` / `share`) is now preserved.

## 0.17.1

### Patch Changes

- [#72](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/72) [`59d2da7`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/59d2da704d257ba4c449fb0065d721b9000ca070) Thanks [@kkukielka](https://github.com/kkukielka)! - fix: typing in the audio editor no longer deletes the audio block

  The audio editor was a hand-rolled overlay rendered inline inside the Slate
  `Editable` tree, so every keystroke in its Title/Caption inputs also bubbled to
  the editor's key handlers — which acted on the selected void node and removed
  the block, taking the popup with it. The editor now uses the Strapi
  `Modal` primitive (portalled out of the editable, like the Button and Social
  embed editors), so form input stays in the form.

  Fixes [#70](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/70).

## 0.17.0

### Minor Changes

- [#68](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/68) [`3a0bb2b`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/3a0bb2b32b998d41dc754d027b6b8fb3e419f758) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: audio block with Media Library integration and a customizable HTML5 player

  Adds a new **Audio** block that lets authors embed audio directly inside the
  Blocks field. Pick a file from the Strapi Media Library (upload included) or
  paste a direct URL, then set a title, caption, alignment (left / center / right
  / none) and player behaviour — controls, autoplay, loop and preload
  (none / metadata / auto). A native `<audio>` player renders inline in the editor
  so authors can test playback before saving.

  The block serialises to a stable JSON shape (`type: "audio"`, `file`, `title`,
  `caption`, `player`, `alignment`) that frontend renderers turn into an HTML5
  `<audio>` element — see issue [#43](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/43) for the React and Astro renderer contract.

  The playground now seeds a short sample audio file so the showcase article ships
  with a working example.

## 0.16.1

### Patch Changes

- [#66](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/66) [`77b96b3`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/77b96b33b958cd605d3a366ec6b95c5aaf37c9d3) Thanks [@kkukielka](https://github.com/kkukielka)! - fix: consistent, always-visible scrollbar on toolbar dropdowns

  The toolbar's block-type ("Text"), font-size and font-family pickers were built
  on the design-system `SingleSelect`, which wraps its options in a Radix
  ScrollArea. That produced an inconsistent, sometimes doubled scrollbar compared
  to the `Menu`-based dropdowns (insert "+", alignment, line height).

  These three pickers are now built on the same `Menu` component as the other
  dropdowns, so every toolbar menu shares one scroll container and renders a
  single, always-visible, theme-aware scrollbar that makes it clear the list can
  be scrolled up and down.

## 0.16.0

### Minor Changes

- [#63](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/63) [`71dd48c`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/71dd48c425116533d44a4aff6b61481815f10bfb) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: Social media embed block (Twitter/X, Instagram, Facebook, TikTok, LinkedIn, Pinterest)

  Adds a dedicated **Social embed** block to the editor. Authors pick a platform and
  paste a post URL; the plugin fetches the post's official embed server-side via a
  new oEmbed proxy (`GET /better-blocks/oembed`) so no platform tokens ever reach
  the browser. Responses are cached (configurable TTL). Supports per-embed caption,
  alignment, and a manual embed-code override.

  Configure enabled platforms and the Instagram/Facebook access tokens under
  `config.social` in `config/plugins.{js,ts}`.

## 0.15.0

### Minor Changes

- [#61](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/61) [`0656f70`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/0656f7003005a0d796176c66880b8fd016dda165) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: Shiki syntax highlighting in the editor code block

  Code blocks in the editor now render with Shiki syntax highlighting that follows
  the admin's light/dark theme. The language selector is no longer hidden — it is
  an always-visible, colored pill in the top-right corner of the block — and the
  code block has a distinct background so it stands out from surrounding text.
  Grammars load on demand; `plaintext` renders without highlighting.

## 0.14.0

### Minor Changes

- [#58](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/58) [`ed21eac`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/ed21eac16ab221e9406d322d8b2e61c26fc48f6c) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: Button (file mode) preview-vs-download toggle

  Adds a `filePreview` option to file-download buttons. When enabled the file
  opens in a new tab (preview); when disabled it downloads directly. Exposed as a
  "Preview file instead of downloading" checkbox in the button editor and stored as
  `filePreview` on the block, so the frontend renderers can map it to
  `target="_blank"` vs `download`. Closes [#57](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/57).

## 0.13.0

### Minor Changes

- [#55](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/55) [`c2d106c`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c2d106cd479bdf1f0dfbec6b77f24e3ef5f28d4e) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: Button block style presets (Primary, Secondary, Outline, Filled)

  Adds a **Style preset** picker to the Button editor so authors can apply on-brand
  variants (Primary / Secondary / Outline / Filled) in one click. Editing any color
  or the border switches the selection to **Custom**. Presets are configurable per
  project via `config/plugins` (`better-blocks.button.presets`); the selected preset
  is stored as `style.variant`. Closes [#54](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/54).

## 0.12.0

### Minor Changes

- [#51](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/51) [`d8679f7`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/d8679f7fd82e8f64de266f879b62942ccab6c302) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: WordPress-style Button block with full styling, link & file-download modes

  Adds a new **Button** block (insert from the blocks selector, the `+` menu, or by typing `[button]`). Two modes:
  - **Link** — URL, open-in-new-tab (auto `rel="noopener noreferrer"`), ARIA label.
  - **File** — pick any Media Library asset to render a download button with optional file size and type icon.

  A full-screen editor with live preview controls alignment, background/text colors (incl. hover), border radius, font size/weight, padding presets, a structured border (toggle + thickness + style + color), and a custom CSS class. Admins can set default button colors via `config/plugins` or per field. Stored as `{ "type": "button", "buttonType": "link" | "file", "label": "…", … }`.

## 0.11.0

### Minor Changes

- [#49](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/49) [`c4ece53`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c4ece53b7b250633f733b67f41f7b993583da6e3) Thanks [@kkukielka](https://github.com/kkukielka)! - feat: add GitHub-style Details / Summary collapsible block

  Adds a native collapsible `details` block to the editor. Insert it from the blocks selector or the `/details` slash command. Each block has a plain-text `summary` label, a `defaultOpen` toggle (maps to the HTML `open` attribute), and full rich-text block content as children (paragraphs, lists, tables, images, and even nested details). The editor preview renders a bordered/GitHub-style header with a disclosure triangle and animated expand/collapse.

  Admins can set the default summary text and choose between a GitHub-minimal or bordered style — globally via `config/plugins.js` (`config.details.defaultSummary` / `config.details.style`), or per field in the Content-Type Builder (per-field overrides the global config).

  JSON output:

  ```json
  { "type": "details", "summary": "Click to expand", "defaultOpen": false, "children": [ ... ] }
  ```

## 0.10.0

### Minor Changes

- [#47](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/47) [`c5d4410`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c5d4410379cc61070ba5e438bf4c5dcedbb28ff7) Thanks [@kkukielka](https://github.com/kkukielka)! - Rework the Math (LaTeX) and Diagram (Mermaid) editors to fix the broken edit menus and improve usability.

  The previous anchored popover overflowed with long sources and was dismissed on page scroll, discarding unsaved edits. Both editors now open in a shared, near full-screen modal with a side-by-side source editor and live preview that fill the available height. The diagram/math preview can be zoomed in/out (with a reset) and is centered, so diagrams are no longer rendered too small to read, and the larger LaTeX preview keeps integrals and fractions legible.

## 0.9.0

### Minor Changes

- [#39](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/39) [`9608b68`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/9608b684a35f14895147221bf5e5d783480d35eb) Thanks [@kkukielka](https://github.com/kkukielka)! - Add GitHub-style callout / admonition blocks. A new `callout` block holds
  nested rich-text content (`{ type: 'callout', variant, title?, children }`) in
  five variants — note, tip, important, warning, and caution — with an optional
  custom title. Insert it from the blocks selector or the `/note`, `/tip`,
  `/important`, `/warning`, `/caution` slash commands, and switch variant, edit
  the title, or dissolve the callout from the header popover. Variant colors use
  Strapi's design tokens so they adapt to light and dark mode.

## 0.8.0

### Minor Changes

- [#37](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/37) [`e54d8cc`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/e54d8cc1b84432fad0666686bc456b1e3c6a783d) Thanks [@kkukielka](https://github.com/kkukielka)! - Add block-level Mermaid diagram support. A new `diagram` block stores the raw
  Mermaid definition (`{ type: 'diagram', format: 'mermaid', value }`) and renders
  it to SVG with a live preview. Insert it from the blocks selector, the
  `/mermaid` slash command, or by typing ` ```mermaid ` followed by a space. The
  diagram theme follows Strapi's light/dark mode and Mermaid is loaded lazily so
  it stays out of the main admin bundle.
  </content>
  </invoke>

## 0.7.1

### Patch Changes

- [#32](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/32) [`1a790ba`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/1a790bac5696d572014604d1f58a6b42cff4a89a) Thanks [@kkukielka](https://github.com/kkukielka)! - Document the inline and block math (LaTeX / KaTeX) feature in the README feature list.

## 0.7.0

### Minor Changes

- [#30](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/30) [`e689581`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/e68958134e30614501da8d544936f947e1cb7cae) Thanks [@kkukielka](https://github.com/kkukielka)! - Add inline and block math (LaTeX / KaTeX) to the editor. Math is stored as a void `math` node (`{ type: 'math', format: 'inline' | 'block', value }`) and rendered with KaTeX in the editor preview. Insert block math from the blocks selector, the `/math` slash command, or by typing `$$ `; insert inline math from the toolbar Σ button or by typing `$…$ `. Clicking a formula opens a popover with a LaTeX input and live preview.

## 0.6.1

### Patch Changes

- [#26](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/26) [`fc9ed7d`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/fc9ed7df36c2f0d9393a20d58683a30b65d98103) Thanks [@kkukielka](https://github.com/kkukielka)! - Fix image caption editing (native `beforeinput`/`input`/`keydown` events now stopPropagation past Slate's Editable, so typing, backspace and enter work inside the caption). Fix emoji picker search (filter now matches against per-emoji keywords instead of always returning true). Add per-feature demo GIFs to documentation.

## 0.6.0

### Minor Changes

- [#24](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/24) [`83c9e15`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/83c9e1549f7b1f269c3b0eccba91ec5639ab2650) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Phase 5 editor improvements: font family and size selectors, slash commands (/ menu), auto text transformations ((c)→©, 1/2→½, etc.), and editor placeholder text.

## 0.5.0

### Minor Changes

- [#22](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/22) [`367ca69`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/367ca69cb3c88a942bcfc1c74045fb8fcfefa393) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Phase 4 editor improvements: line height control, special characters picker, image captions and alignment, emoji picker, find and replace with dual-color highlighting, indent/outdent, and responsive toolbar wrapping.

## 0.4.0

### Minor Changes

- [#18](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/18) [`8b08055`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/8b08055105c39f8a00d9e6db770c354b5de7c707) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Phase 1 editor improvements: horizontal line insert button, undo/redo toolbar buttons, remove formatting button, link "open in new tab" option, and word/character count footer bar.

- [#20](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/20) [`5b5296a`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/5b5296a) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Phase 2 editor improvements: text alignment (left/center/right/justify), to-do lists with toggleable checkboxes, tables with header row and add/remove rows/columns, media embed with YouTube/Vimeo thumbnail preview.

- [#21](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/21) [`a730922`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/a730922) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Phase 3 editor improvements: image captions and alignment, emoji picker, find and replace with dual-color highlighting, indent/outdent block-level buttons, responsive toolbar wrapping.

## 0.3.0

### Minor Changes

- [#14](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/14) [`677e545`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/677e5452a3bfa2b71d45bfb7c1eced53aaaaa1af) Thanks [@kkukielka](https://github.com/kkukielka)! - Add nested lists with per-level format switching. Users can infinitely nest lists using Tab to indent and Shift+Tab to outdent, and independently choose ordered or unordered format at each nesting level via the toolbar.

## 0.2.1

### Patch Changes

- [#12](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/12) [`c066f0f`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/c066f0f615d63168c03350fc70fd9ee32df2eeee) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Frontend Rendering section to README with link to @k11k/better-blocks-react-renderer.

## 0.2.0

### Minor Changes

- [#10](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/10) [`5836f32`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/5836f3261dd93f5bf53c4d37f810b1a0004689ac) Thanks [@kkukielka](https://github.com/kkukielka)! - Add Image block support with Media Library integration. Users can now insert images from the block type selector dropdown or by typing `![`. Images are rendered inline with focus highlighting and proper void element handling.

## 0.1.2

### Patch Changes

- [#6](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/6) [`2730567`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/2730567b06e2ac26934553b68b1dcabbd3900680) Thanks [@kkukielka](https://github.com/kkukielka)! - Clarify Slate dependency wording in README.

## 0.1.1

### Patch Changes

- [#4](https://github.com/k11k-labs/strapi-plugin-better-blocks/pull/4) [`406cb1b`](https://github.com/k11k-labs/strapi-plugin-better-blocks/commit/406cb1b0629e8b2f69a6517637981ca428ca5dd8) Thanks [@kkukielka](https://github.com/kkukielka)! - Clarify Slate dependency wording in README.
