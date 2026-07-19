---
'@k11k/better-blocks-react-renderer': minor
---

GitHub-style defaults for tables, blockquotes and code blocks

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
