# @k11k/strapi-plugin-better-blocks

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
